const cloud = require('wx-server-sdk');
const https = require('https');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function calcVolatility(prices) {
  if (!Array.isArray(prices) || prices.length < 3) return 0;
  const rets = [];
  for (let i = 1; i < prices.length; i += 1) {
    const prev = Number(prices[i - 1]);
    const cur = Number(prices[i]);
    if (Number.isFinite(prev) && Number.isFinite(cur) && prev > 0) {
      rets.push((cur - prev) / prev);
    }
  }
  if (rets.length < 2) return 0;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((acc, r) => acc + (r - mean) * (r - mean), 0) / (rets.length - 1);
  return Math.sqrt(Math.max(variance, 0)) * Math.sqrt(252);
}

function ewmaPredict(prices, alpha = 0.35) {
  if (!Array.isArray(prices) || prices.length === 0) return 1;
  let level = Number(prices[0]) || 1;
  for (let i = 1; i < prices.length; i += 1) {
    const p = Number(prices[i]);
    if (Number.isFinite(p)) {
      level = alpha * p + (1 - alpha) * level;
    }
  }
  return level;
}

function scoreRisk(volatility, expectedChangePct) {
  let riskLevel = 'high';
  if (volatility < 0.06) riskLevel = 'low';
  else if (volatility < 0.12) riskLevel = 'medium';

  let signal = 'trend';
  if (expectedChangePct >= 0.4) signal = 'up_breakout';
  else if (expectedChangePct <= -0.4) signal = 'down_breakout';
  else if (Math.abs(expectedChangePct) <= 0.1) signal = 'range';

  return { riskLevel, signal };
}

function fetchJson(url, timeout = 1200) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout }, (res) => {
      let buf = '';
      res.on('data', (chunk) => {
        buf += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(buf || '{}'));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('Request timeout'));
    });
  });
}

async function fetchCurrent(base) {
  const safeBase = String(base || 'USD').toUpperCase();
  const url = `https://open.er-api.com/v6/latest/${safeBase}`;
  const json = await fetchJson(url, 1200);
  const cny = json && json.rates ? Number(json.rates.CNY) : NaN;
  if (Number.isFinite(cny) && cny > 0) return cny;
  throw new Error('Invalid rate response');
}

async function fetchRecentDailyRates(base, days = 45) {
  const safeBase = String(base || 'USD').toUpperCase();
  const now = new Date();
  const start = new Date(now.getTime() - Math.max(days, 30) * 24 * 60 * 60 * 1000);
  const startDate = start.toISOString().slice(0, 10);
  const endDate = now.toISOString().slice(0, 10);
  const url = `https://api.frankfurter.app/${startDate}..${endDate}?from=${safeBase}&to=CNY`;
  const json = await fetchJson(url, 1200);

  const ratesMap = json && json.rates && typeof json.rates === 'object' ? json.rates : {};
  const dates = Object.keys(ratesMap).sort();
  const seq = [];
  for (const d of dates) {
    const cny = Number(ratesMap[d] && ratesMap[d].CNY);
    if (Number.isFinite(cny) && cny > 0) {
      seq.push(cny);
    }
  }
  return seq;
}

exports.main = async (event) => {
  try {
    const symbol = String((event && event.symbol) || 'USD').toUpperCase();
    const seqLen = Math.max(5, Number((event && event.seq_len) || 20));
    const startedAt = Date.now();
    const softDeadlineMs = 2400;
    const hasBudget = (reserveMs = 200) => (Date.now() - startedAt) < (softDeadlineMs - reserveMs);

    let prices = [];
    let dataSource = 'history_api';

    if (hasBudget()) {
      try {
        prices = await fetchRecentDailyRates(symbol, Math.max(seqLen + 20, 45));
      } catch (e) {
        prices = [];
      }
    }

    if (!Array.isArray(prices) || prices.length === 0) {
      dataSource = 'spot_api';
      if (hasBudget()) {
        try {
          const cur = await fetchCurrent(symbol);
          prices = [cur];
        } catch (e) {
          prices = [];
        }
      }
    }

    if (!Array.isArray(prices) || prices.length === 0) {
      throw new Error('Live FX data unavailable');
    }

    while (prices.length > 1 && prices.length < seqLen) {
      prices.push(prices[prices.length - 1]);
    }
    prices = prices.slice(-seqLen);

    const nowPrice = Number(prices[prices.length - 1]);
    const pred = Number(ewmaPredict(prices).toFixed(6));
    const volatility = Number(calcVolatility(prices).toFixed(6));
    const expectedChangePct = nowPrice > 0
      ? Number((((pred - nowPrice) / nowPrice) * 100).toFixed(4))
      : 0;

    const { riskLevel, signal } = scoreRisk(volatility, expectedChangePct);

    return {
      success: true,
      method: 'ewma_js',
      data_source: dataSource,
      symbol,
      current: nowPrice,
      pred,
      expected_change_pct: expectedChangePct,
      volatility,
      risk_level: riskLevel,
      signal,
      sample_size: prices.length
    };
  } catch (err) {
    return {
      success: false,
      msg: err && err.message ? err.message : 'aiFxMonitor failed'
    };
  }
};
