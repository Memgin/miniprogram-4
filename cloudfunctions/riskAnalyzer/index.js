const cloud = require('wx-server-sdk');
const https = require('https');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function fetchJson(url, timeout = 1500) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout }, (res) => {
      let buf = '';
      res.on('data', (chunk) => {
        buf += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(buf || '{}'));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Request timeout')));
  });
}

function normalizeCards(bankCards) {
  return Array.isArray(bankCards) ? bankCards : [];
}

function getRateByCode(currentRates, code) {
  const upper = String(code || '').toUpperCase();
  const lower = upper.toLowerCase();
  const value = currentRates && (currentRates[upper] || currentRates[lower] || (upper === 'RM' ? (currentRates.MYR || currentRates.myr) : 0));
  return Number(value) || 0;
}

async function fetchSpotRate(code) {
  const base = String(code || 'USD').toUpperCase();
  if (base === 'CNY') return 1;
  const json = await fetchJson(`https://open.er-api.com/v6/latest/${base}`);
  const cny = Number(json && json.rates && json.rates.CNY);
  return Number.isFinite(cny) && cny > 0 ? cny : 0;
}

async function getCurrentRate(currentRates, code) {
  const cached = getRateByCode(currentRates, code);
  if (cached > 0) return cached;
  return fetchSpotRate(code);
}

async function getSeriesForCurrency(code, limit = 30) {
  const safeCode = String(code || '').toUpperCase();
  if (!safeCode || safeCode === 'CNY') {
    return {
      prices: Array(limit).fill(1),
      labels: Array.from({ length: limit }, (_, index) => `T-${limit - index - 1}`)
    };
  }

  try {
    const res = await db.collection('rates_history')
      .where({ symbol: safeCode })
      .orderBy('date', 'desc')
      .limit(limit)
      .get();
    const records = (res.data || [])
      .map((item) => ({
        price: Number(item.price || 0),
        label: String(item.date || '')
      }))
      .filter((item) => Number.isFinite(item.price) && item.price > 0)
      .reverse();
    if (records.length >= 8) {
      return {
        prices: records.map((item) => item.price),
        labels: records.map((item) => item.label)
      };
    }
  } catch (error) {
    // ignore db read failures and fallback to API
  }

  try {
    const now = new Date();
    const start = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);
    const url = `https://api.frankfurter.app/${start.toISOString().slice(0, 10)}..${now.toISOString().slice(0, 10)}?from=${safeCode}&to=CNY`;
    const json = await fetchJson(url, 2000);
    const ratesMap = json && json.rates && typeof json.rates === 'object' ? json.rates : {};
    const dates = Object.keys(ratesMap).sort();
    const records = dates
      .map((date) => ({
        label: date,
        price: Number(ratesMap[date] && ratesMap[date].CNY)
      }))
      .filter((item) => Number.isFinite(item.price) && item.price > 0)
      .slice(-limit);
    if (records.length) {
      return {
        prices: records.map((item) => item.price),
        labels: records.map((item) => item.label)
      };
    }
  } catch (error) {
    // ignore fallback failures
  }

  const spot = await fetchSpotRate(safeCode).catch(() => 1);
  return {
    prices: Array(limit).fill(spot || 1),
    labels: Array.from({ length: limit }, (_, index) => `T-${limit - index - 1}`)
  };
}

function percentile(values, p) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[index];
}

function annualizedVolatility(returns) {
  if (!Array.isArray(returns) || returns.length < 2) return 0;
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / (returns.length - 1);
  return Math.sqrt(Math.max(variance, 0)) * Math.sqrt(252);
}

function seriesReturns(series) {
  if (!Array.isArray(series) || series.length < 2) return [];
  const returns = [];
  for (let index = 1; index < series.length; index += 1) {
    const prev = Number(series[index - 1] || 0);
    const curr = Number(series[index] || 0);
    if (prev > 0 && curr > 0) {
      returns.push((curr - prev) / prev);
    }
  }
  return returns;
}

function buildRelativeLabels(length) {
  return Array.from({ length }, (_, index) => `T-${length - index - 1}`);
}

exports.main = async (event) => {
  try {
    const bankCards = normalizeCards(event.bankCards);
    const currentRates = event.currentRates || {};

    const exposures = {};
    const notionals = {};
    const currentRateMap = {};
    for (const card of bankCards) {
      for (const currency of (card.currencies || [])) {
        const code = String(currency.code || '').toUpperCase();
        const amount = Number(currency.amount || 0);
        if (!code || !Number.isFinite(amount) || amount === 0) continue;
        const rate = await getCurrentRate(currentRates, code);
        const cnyValue = amount * rate;
        exposures[code] = (exposures[code] || 0) + cnyValue;
        notionals[code] = (notionals[code] || 0) + amount;
        currentRateMap[code] = rate;
      }
    }

    const exposureEntries = Object.keys(exposures)
      .map((code) => ({ code, cnyValue: Number(exposures[code].toFixed(2)) }))
      .sort((a, b) => b.cnyValue - a.cnyValue);

    const totalValue = exposureEntries.reduce((sum, item) => sum + item.cnyValue, 0);
    if (totalValue <= 0) {
      return {
        success: true,
        totalValue: 0,
        var95: 0,
        var99: 0,
        volatility: 0,
        topExposures: [],
        riskContributions: [],
        portfolioSeries: { labels: [], values: [] }
      };
    }

    const seriesMap = {};
    await Promise.all(exposureEntries.slice(0, 8).map(async (item) => {
      seriesMap[item.code] = await getSeriesForCurrency(item.code, 36);
    }));

    const minLength = Object.values(seriesMap).reduce((min, series) => {
      const prices = series && Array.isArray(series.prices) ? series.prices : [];
      if (!prices.length) return min;
      return Math.min(min, prices.length);
    }, 36);

    const portfolioReturns = [];
    const portfolioValues = [];
    let labelSeries = [];
    if (minLength >= 3) {
      for (const item of exposureEntries.slice(0, 8)) {
        const series = seriesMap[item.code] || {};
        if (!labelSeries.length && Array.isArray(series.labels) && series.labels.length >= minLength) {
          labelSeries = series.labels.slice(series.labels.length - minLength);
        }
      }

      if (!labelSeries.length) {
        labelSeries = buildRelativeLabels(minLength);
      }

      for (let index = 0; index < minLength; index += 1) {
        let total = 0;
        for (const item of exposureEntries.slice(0, 8)) {
          const series = seriesMap[item.code] && Array.isArray(seriesMap[item.code].prices)
            ? seriesMap[item.code].prices
            : [];
          const price = Number(series[series.length - minLength + index] || currentRateMap[item.code] || 0);
          const amount = Number(notionals[item.code] || 0);
          if (price > 0 && Number.isFinite(amount)) {
            total += amount * price;
          }
        }
        portfolioValues.push(Number(total.toFixed(2)));
      }

      for (let index = 1; index < minLength; index += 1) {
        let combined = 0;
        for (const item of exposureEntries.slice(0, 8)) {
          const series = seriesMap[item.code] && Array.isArray(seriesMap[item.code].prices)
            ? seriesMap[item.code].prices
            : [];
          const prev = Number(series[series.length - minLength + index - 1] || 0);
          const curr = Number(series[series.length - minLength + index] || 0);
          if (prev > 0 && curr > 0) {
            const weight = item.cnyValue / totalValue;
            combined += ((curr - prev) / prev) * weight;
          }
        }
        portfolioReturns.push(combined);
      }
    }

    const var95Pct = Math.min(0, percentile(portfolioReturns, 5));
    const var99Pct = Math.min(0, percentile(portfolioReturns, 1));
    const volatility = annualizedVolatility(portfolioReturns);
    const contributionScores = exposureEntries.slice(0, 5).map((item) => {
      const series = seriesMap[item.code] && Array.isArray(seriesMap[item.code].prices)
        ? seriesMap[item.code].prices
        : [];
      const assetVol = annualizedVolatility(seriesReturns(series));
      const weightPct = totalValue > 0 ? (item.cnyValue / totalValue) * 100 : 0;
      return {
        code: item.code,
        cnyValue: item.cnyValue,
        weightPct: Number(weightPct.toFixed(2)),
        assetVol: Number(assetVol.toFixed(6)),
        score: Math.abs((item.cnyValue / totalValue) * assetVol)
      };
    });
    const totalScore = contributionScores.reduce((sum, item) => sum + item.score, 0);
    const riskContributions = contributionScores.map((item) => ({
      code: item.code,
      cnyValue: item.cnyValue,
      weightPct: item.weightPct,
      contributionPct: Number((totalScore > 0 ? (item.score / totalScore) * 100 : 0).toFixed(2)),
      assetVol: item.assetVol
    }));

    return {
      success: true,
      totalValue: Number(totalValue.toFixed(2)),
      var95: Number(Math.abs(var95Pct * totalValue).toFixed(2)),
      var99: Number(Math.abs(var99Pct * totalValue).toFixed(2)),
      volatility: Number(volatility.toFixed(6)),
      topExposures: exposureEntries.slice(0, 5),
      riskContributions,
      portfolioSeries: {
        labels: labelSeries,
        values: portfolioValues
      },
      sampleSize: portfolioReturns.length,
      confidenceHint: portfolioReturns.length >= 15 ? 'history_ok' : 'history_weak'
    };
  } catch (error) {
    return {
      success: false,
      msg: error && error.message ? error.message : 'riskAnalyzer failed'
    };
  }
};
