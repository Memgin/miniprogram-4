import * as echarts from '../../components/ec-canvas/echarts';

const app = getApp();
const exchangeRateUtil = require('../../utils/exchangeRate.js');

function initChart(canvas, width, height, dpr) {
  const chart = echarts.init(canvas, null, {
    width,
    height,
    devicePixelRatio: dpr
  });
  canvas.setChart(chart);
  return chart;
}

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

function formatDate(date) {
  const target = date instanceof Date ? date : new Date(date);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
}

function addMonths(date, count) {
  const target = new Date(date.getTime());
  target.setMonth(target.getMonth() + count);
  return target;
}

function toDateStart(value) {
  const target = new Date(value);
  target.setHours(0, 0, 0, 0);
  return target;
}

function diffDays(fromDate, toDate) {
  return Math.max(0, Math.round((toDateStart(toDate).getTime() - toDateStart(fromDate).getTime()) / (24 * 60 * 60 * 1000)));
}

Page({
  data: {
    navTitle: '银行卡账户',
    navStatusHeight: 20,
    navContentHeight: 44,
    navTotalHeight: 64,
    navCapsuleSpace: 96,
    bankCards: [],
    currencySummary: [],
    totalCny: '0.00',
    cardCount: 0,
    currencyAccountCount: 0,
    uniqueCurrencyCount: 0,
    privacyMode: false,
    biometricEnabled: false,
    topCurrencyExposureText: '暂无数据',
    topCardName: '--',
    topCardValueText: '¥0.00',
    averageAssetText: '¥0.00',
    dashboardTone: 'calm',
    latestRiskSummary: null,
    riskBandScore: 12,
    riskBandLabel: '稳态',
    riskBandSummary: '当前资产分布相对均衡。',
    riskBandLeft: '12%',
    riskBandDrivers: [],
    heatmapXAxis: [],
    heatmapYAxis: [],
    heatmapData: [],
    heatmapRows: [],
    sankeyNodes: [],
    sankeyLinks: [],
    fundsFlowCards: [],
    fundsFlowCurrencies: [],
    shockCurrencyOptions: [],
    shockCurrencyLabels: [],
    shockCodeIndex: 0,
    shockPct: 0,
    shockPctText: '0%',
    shockImpactSummary: null,
    shockImpactedCards: [],
    shockAlertHits: [],
    plannerCurrencyOptions: [],
    plannerCurrencyLabels: [],
    rebalanceSummary: null,
    rebalanceActions: [],
    fxOrderPlans: [],
    showFxOrderEditor: false,
    editingFxOrderId: '',
    fxOrderForm: {},
    fxDirectionLabels: ['低于目标分批买入', '高于目标分批止盈'],
    fxDirectionValues: ['below', 'above'],
    cashflowPlans: [],
    showCashflowEditor: false,
    editingCashflowId: '',
    cashflowForm: {},
    cashflowTypeLabels: ['流入', '流出'],
    cashflowTypeValues: ['inflow', 'outflow'],
    cashflowFrequencyLabels: ['一次性', '每月'],
    cashflowFrequencyValues: ['once', 'monthly'],
    maturityPlans: [],
    showMaturityEditor: false,
    editingMaturityId: '',
    maturityForm: {},
    forecastRangeOptions: [30, 90, 180],
    forecastRangeIndex: 1,
    forecastSummary: null,
    forecastTimeline: [],
    maturityHighlights: [],
    ecAssetHeatmap: { lazyLoad: true },
    ecFundsFlow: { lazyLoad: true }
  },

  onLoad() {
    this.initCustomNavBar();
    this.setData({
      shockCurrencyOptions: [],
      shockCurrencyLabels: [],
      fxOrderForm: this.createFxOrderForm('USD'),
      cashflowForm: this.createCashflowForm('CNY'),
      maturityForm: this.createMaturityForm('CNY')
    });
  },

  onNavBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 });
      return;
    }
    wx.switchTab({ url: '/pages/index/index' });
  },

  initCustomNavBar() {
    try {
      const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      const statusBarHeight = Number(windowInfo.statusBarHeight || 20);
      const windowWidth = Number(windowInfo.windowWidth || 375);
      const menuButton = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null;

      let navContentHeight = 44;
      let navTotalHeight = statusBarHeight + navContentHeight;
      let navCapsuleSpace = 96;

      if (menuButton && menuButton.top && menuButton.bottom && menuButton.height) {
        navTotalHeight = Number(menuButton.bottom + menuButton.top - statusBarHeight);
        navContentHeight = Math.max(32, navTotalHeight - statusBarHeight);
        navCapsuleSpace = Math.max(88, Number(menuButton.width + (windowWidth - menuButton.right) * 2));
      }

      this.setData({
        navStatusHeight: statusBarHeight,
        navContentHeight,
        navTotalHeight,
        navCapsuleSpace
      });
    } catch (error) {
      console.warn('initCustomNavBar failed:', error);
    }
  },

  onShow() {
    this.loadBankCards();
  },

  normalizeCurrencyCode(code) {
    const upper = String(code || '').toUpperCase();
    return upper === 'RM' ? 'MYR' : upper;
  },

  getRateByCode(rates, code) {
    const upper = this.normalizeCurrencyCode(code);
    return Number(rates[upper] || rates[upper.toLowerCase()] || (upper === 'CNY' ? 1 : 0)) || 0;
  },

  buildCardCurrencyExposureMap(card, rates) {
    const exposureMap = {};
    const currencies = Array.isArray(card.currencies) ? card.currencies : [];
    currencies.forEach((currency) => {
      const code = this.normalizeCurrencyCode(currency.code);
      const amount = Number(currency.amount || 0);
      if (!amount) return;
      exposureMap[code] = (exposureMap[code] || 0) + amount * this.getRateByCode(rates, code);
    });
    return exposureMap;
  },

  buildSummary(bankCards, rates) {
    const exposureMap = {};
    const currencyTotals = {};
    let totalCny = 0;
    let currencyAccountCount = 0;

    const cards = (bankCards || []).map((card) => {
      let cardTotal = 0;
      const currencies = Array.isArray(card.currencies) ? card.currencies : [];
      currencyAccountCount += currencies.length;
      currencies.forEach((currency) => {
        const code = this.normalizeCurrencyCode(currency.code);
        const amount = Number(currency.amount || 0);
        const rate = this.getRateByCode(rates, code);
        const cnyValue = amount * rate;
        cardTotal += cnyValue;
        if (amount) {
          exposureMap[code] = (exposureMap[code] || 0) + cnyValue;
          currencyTotals[code] = (currencyTotals[code] || 0) + amount;
        }
      });
      totalCny += cardTotal;
      return {
        ...card,
        totalCny: cardTotal.toFixed(2),
        currencyCount: currencies.length,
        currencyExposureMap: this.buildCardCurrencyExposureMap(card, rates),
        previewCurrencies: currencies.slice(0, 4).map((currency) => ({
          code: this.normalizeCurrencyCode(currency.code),
          amount: Number(currency.amount || 0).toFixed(2)
        }))
      };
    }).sort((a, b) => Number(b.totalCny) - Number(a.totalCny));

    const currencySummary = Object.keys(currencyTotals)
      .sort((a, b) => {
        const aValue = (currencyTotals[a] || 0) * this.getRateByCode(rates, a);
        const bValue = (currencyTotals[b] || 0) * this.getRateByCode(rates, b);
        return bValue - aValue;
      })
      .map((code) => ({
        code,
        totalAmount: Number(currencyTotals[code] || 0).toFixed(2),
        cnyAmount: Number((currencyTotals[code] || 0) * this.getRateByCode(rates, code)).toFixed(2)
      }));

    const topExposure = Object.keys(exposureMap)
      .map((code) => ({ code, cnyValue: exposureMap[code] }))
      .sort((a, b) => b.cnyValue - a.cnyValue)[0];

    const topCard = cards[0];
    const averageAsset = cards.length ? totalCny / cards.length : 0;

    return {
      cards,
      currencySummary,
      totalCny: totalCny.toFixed(2),
      cardCount: cards.length,
      currencyAccountCount,
      uniqueCurrencyCount: Object.keys(exposureMap).length,
      topCurrencyExposureText: topExposure ? `${topExposure.code} · ¥${Number(topExposure.cnyValue || 0).toFixed(2)}` : '暂无数据',
      topCardName: topCard ? topCard.name : '--',
      topCardValueText: `¥${topCard ? topCard.totalCny : '0.00'}`,
      averageAssetText: `¥${averageAsset.toFixed(2)}`,
      dashboardTone: totalCny >= 50000 ? 'strong' : totalCny >= 15000 ? 'active' : 'calm'
    };
  },

  normalizeRiskSummary(summary) {
    if (!summary || typeof summary !== 'object') return null;
    const totalValue = Number(summary.totalValue || 0);
    const var95 = Number(summary.var95 || 0);
    const volatility = Number(summary.volatility || 0);
    const topExposures = (Array.isArray(summary.topExposures) ? summary.topExposures : []).map((item) => ({
      code: this.normalizeCurrencyCode(item.code),
      cnyValue: Number(item.cnyValue || 0),
      cnyText: `¥${Number(item.cnyValue || 0).toFixed(2)}`
    }));
    const riskContributions = (Array.isArray(summary.riskContributions) ? summary.riskContributions : []).map((item) => ({
      code: this.normalizeCurrencyCode(item.code),
      contributionPct: Number(item.contributionPct || 0),
      contributionText: `${Number(item.contributionPct || 0).toFixed(1)}%`,
      weightPct: Number(item.weightPct || 0),
      weightText: `${Number(item.weightPct || 0).toFixed(1)}%`,
      assetVol: Number(item.assetVol || 0)
    }));
    const portfolioSeries = summary.portfolioSeries && typeof summary.portfolioSeries === 'object'
      ? summary.portfolioSeries
      : {};
    return {
      totalValue,
      var95,
      volatility,
      portfolioSeries: {
        labels: Array.isArray(portfolioSeries.labels) ? portfolioSeries.labels : [],
        values: Array.isArray(portfolioSeries.values) ? portfolioSeries.values.map((item) => Number(item || 0)) : []
      },
      topExposures,
      riskContributions
    };
  },

  buildRiskBandState(risk, summary) {
    const totalValue = Number((risk && risk.totalValue) || Number(summary.totalCny || 0) || 0);
    const topExposure = risk && Array.isArray(risk.topExposures) && risk.topExposures.length ? risk.topExposures[0] : null;
    const topContribution = risk && Array.isArray(risk.riskContributions) && risk.riskContributions.length ? risk.riskContributions[0] : null;
    const concentration = topExposure && totalValue > 0 ? topExposure.cnyValue / totalValue : 0;
    const varRatio = totalValue > 0 ? Number((risk && risk.var95) || 0) / totalValue : 0;
    const volatility = Number((risk && risk.volatility) || 0);
    const score = Math.max(8, Math.min(96, Math.round(concentration * 45 + varRatio * 850 + volatility * 220)));

    let label = '稳态';
    let summaryText = '当前资产分布相对均衡。';
    if (score >= 72) {
      label = '高风险';
      summaryText = '敞口集中度和波动压力都偏高，建议优先做守护。';
    } else if (score >= 48) {
      label = '关注';
      summaryText = '组合进入敏感区，建议结合压力测试观察。';
    }

    const drivers = [
      `集中度 ${(concentration * 100).toFixed(1)}%`,
      `VaR95 ${(varRatio * 100).toFixed(2)}%`,
      `波动率 ${(volatility * 100).toFixed(2)}%`
    ];
    if (topContribution) {
      drivers.push(`${topContribution.code} 风险贡献 ${topContribution.contributionText}`);
    }

    return {
      riskBandScore: score,
      riskBandLabel: label,
      riskBandSummary: summaryText,
      riskBandLeft: `${score}%`,
      riskBandDrivers: drivers.slice(0, 4)
    };
  },

  buildHeatmapPayload(cards, currencySummary) {
    const heatmapXAxis = cards.map((card) => card.name || '未命名');
    const heatmapYAxis = currencySummary.map((item) => item.code);
    const heatmapData = [];
    const maxValue = Math.max(
      ...cards.flatMap((card) => heatmapYAxis.map((code) => Number((card.currencyExposureMap && card.currencyExposureMap[code]) || 0))),
      1
    );
    cards.forEach((card, cardIndex) => {
      heatmapYAxis.forEach((code, currencyIndex) => {
        const exposure = Number((card.currencyExposureMap && card.currencyExposureMap[code]) || 0);
        heatmapData.push([cardIndex, currencyIndex, Number(exposure.toFixed(2))]);
      });
    });
    const heatmapRows = heatmapYAxis.map((code) => ({
      code,
      cells: cards.map((card) => {
        const exposure = Number((card.currencyExposureMap && card.currencyExposureMap[code]) || 0);
        const ratio = maxValue > 0 ? exposure / maxValue : 0;
        const levels = [
          { threshold: 0.25, bg: 'rgba(133, 102, 70, 0.24)', color: '#3a3026' },
          { threshold: 0.5, bg: 'rgba(133, 102, 70, 0.38)', color: '#3a3026' },
          { threshold: 0.75, bg: 'rgba(133, 102, 70, 0.56)', color: '#fff8ef' },
          { threshold: 1.01, bg: 'rgba(133, 102, 70, 0.74)', color: '#fff8ef' }
        ];

        let picked = levels[0];
        for (let i = 0; i < levels.length; i += 1) {
          if (ratio < levels[i].threshold) {
            picked = levels[i];
            break;
          }
        }

        const background = exposure > 0 ? picked.bg : 'rgba(122, 99, 72, 0.06)';
        const color = exposure > 0 ? picked.color : '#6f6254';
        return {
          cardId: card.id,
          cardName: card.name || '未命名',
          shortName: String(card.name || '未命名').slice(0, 6),
          value: exposure,
          valueText: `¥${exposure.toFixed(0)}`,
          style: `background: ${background}; color: ${color};`
        };
      })
    }));
    return { heatmapXAxis, heatmapYAxis, heatmapData, heatmapRows };
  },

  buildSankeyPayload(cards, currencySummary) {
    const nodes = [{ name: '总资产' }];
    const links = [];
    cards.forEach((card) => {
      const cardNode = `CARD_${card.id}`;
      nodes.push({ name: cardNode, displayName: card.name || '未命名银行卡' });
      links.push({ source: '总资产', target: cardNode, value: Number(card.totalCny || 0) });
      currencySummary.forEach((currency) => {
        const exposure = Number((card.currencyExposureMap && card.currencyExposureMap[currency.code]) || 0);
        if (!exposure) return;
        const currencyNode = `CUR_${currency.code}`;
        if (!nodes.find((item) => item.name === currencyNode)) {
          nodes.push({ name: currencyNode, displayName: currency.code });
        }
        links.push({ source: cardNode, target: currencyNode, value: Number(exposure.toFixed(2)) });
      });
    });
    return { sankeyNodes: nodes, sankeyLinks: links };
  },

  buildFundsFlowPayload(cards, currencySummary, totalCny) {
    const total = Math.max(Number(totalCny || 0), 1);
    return {
      fundsFlowCards: cards.map((card) => {
        const value = Number(card.totalCny || 0);
        const width = Math.max(12, Math.min(100, (value / total) * 100));
        return {
          id: card.id,
          name: card.name || '未命名银行卡',
          valueText: `¥${value.toFixed(2)}`,
          width: `${width.toFixed(2)}%`
        };
      }),
      fundsFlowCurrencies: currencySummary.map((currency) => {
        const value = Number(currency.cnyAmount || 0);
        const width = Math.max(12, Math.min(100, (value / total) * 100));
        return {
          code: currency.code,
          valueText: `¥${value.toFixed(2)}`,
          width: `${width.toFixed(2)}%`
        };
      })
    };
  },

  buildPlannerCurrencyOptions(currencySummary) {
    const seen = {};
    const options = [{ code: 'CNY', label: 'CNY' }];
    seen.CNY = true;
    (currencySummary || []).forEach((item) => {
      const code = this.normalizeCurrencyCode(item.code);
      if (!code || seen[code]) return;
      seen[code] = true;
      options.push({ code, label: code });
    });
    return options;
  },

  createFxOrderForm(defaultCode) {
    return {
      code: this.normalizeCurrencyCode(defaultCode || 'USD'),
      direction: 'below',
      targetRate: '',
      totalBudgetCny: '',
      trancheCount: '3',
      stepPct: '0.6',
      note: ''
    };
  },

  createCashflowForm(defaultCode) {
    return {
      name: '',
      type: 'inflow',
      code: this.normalizeCurrencyCode(defaultCode || 'CNY'),
      amount: '',
      dueDate: formatDate(new Date()),
      frequency: 'once',
      note: ''
    };
  },

  createMaturityForm(defaultCode) {
    return {
      name: '',
      code: this.normalizeCurrencyCode(defaultCode || 'CNY'),
      principal: '',
      maturityDate: formatDate(addMonths(new Date(), 1)),
      apr: '2.0',
      note: ''
    };
  },

  getTrancheWeights(count) {
    const totalCount = Math.max(1, Math.min(5, Number(count || 1)));
    const raw = Array.from({ length: totalCount }, (_, index) => totalCount - index);
    const total = raw.reduce((sum, value) => sum + value, 0) || 1;
    return raw.map((value) => value / total);
  },

  buildRebalancePlan(summary, rates, risk) {
    const total = Number(summary && summary.totalCny || 0);
    const entries = Array.isArray(summary && summary.currencySummary)
      ? summary.currencySummary.map((item) => ({
        code: this.normalizeCurrencyCode(item.code),
        cnyValue: Number(item.cnyAmount || 0)
      })).filter((item) => item.cnyValue > 0)
      : [];
    if (!total || !entries.length) return null;

    const topForeign = entries.filter((item) => item.code !== 'CNY').sort((a, b) => b.cnyValue - a.cnyValue).slice(0, 3);
    const volatility = Number(risk && risk.volatility || 0);
    const reserveCny = volatility >= 0.12 ? 0.2 : volatility >= 0.06 ? 0.12 : 0.08;
    const targetMap = {};
    if (entries.find((item) => item.code === 'CNY') || reserveCny > 0.08) {
      targetMap.CNY = reserveCny;
    }
    const remaining = Math.max(0, 1 - (targetMap.CNY || 0));
    const template = topForeign.length <= 1 ? [1] : topForeign.length === 2 ? [0.58, 0.42] : [0.46, 0.32, 0.22];
    topForeign.forEach((item, index) => {
      targetMap[item.code] = remaining * template[index];
    });

    const currentMap = {};
    entries.forEach((item) => {
      currentMap[item.code] = item.cnyValue / total;
      if (!targetMap[item.code] && item.code === 'CNY' && !targetMap.CNY) {
        targetMap.CNY = item.cnyValue / total;
      }
    });

    const compareCodes = [...new Set([...Object.keys(currentMap), ...Object.keys(targetMap)])];
    const actions = compareCodes.map((code) => {
      const currentWeight = Number(currentMap[code] || 0);
      const targetWeight = Number(targetMap[code] || 0);
      const deltaWeight = targetWeight - currentWeight;
      const deltaCny = deltaWeight * total;
      const rate = this.getRateByCode(rates, code);
      const amount = rate > 0 ? Math.abs(deltaCny) / rate : 0;
      return {
        code,
        currentWeightText: `${(currentWeight * 100).toFixed(1)}%`,
        targetWeightText: `${(targetWeight * 100).toFixed(1)}%`,
        deltaText: `${deltaCny >= 0 ? '+' : ''}¥${deltaCny.toFixed(2)}`,
        amountText: amount > 0 ? `${deltaCny >= 0 ? '约增持' : '约减持'} ${amount.toFixed(2)} ${code}` : '保持观察',
        tone: deltaCny >= 0 ? 'up' : 'down',
        reason: code === 'CNY' ? '为组合保留缓冲资金。' : (deltaCny >= 0 ? '补足目标仓位，平滑结构。' : '压降集中暴露，降低波动。'),
        absDelta: Math.abs(deltaCny)
      };
    }).filter((item) => item.absDelta >= total * 0.04).sort((a, b) => b.absDelta - a.absDelta).slice(0, 4);

    const targetMixText = Object.keys(targetMap).map((code) => `${code} ${(Number(targetMap[code] || 0) * 100).toFixed(1)}%`).join(' · ');
    return {
      summary: {
        headline: volatility >= 0.12 ? '当前波动偏高，建议降低集中仓位并提高缓冲资金。' : (volatility >= 0.06 ? '组合进入关注区，建议做结构性再平衡。' : '当前组合相对稳态，可做轻量再平衡。'),
        bufferText: `建议现金缓冲（CNY）约 ${(Number(targetMap.CNY || 0) * 100).toFixed(1)}%`,
        targetMixText,
        modeLabel: volatility >= 0.12 ? '守护模式' : (volatility >= 0.06 ? '标准模式' : '进取模式')
      },
      actions: actions.length ? actions : [{
        code: 'OK',
        currentWeightText: '--',
        targetWeightText: '--',
        deltaText: '当前结构接近目标区间',
        amountText: '暂无明显需要调仓的币种',
        tone: 'flat',
        reason: '继续观察汇率与流动性变化。',
        absDelta: 0
      }]
    };
  },

  buildFxOrderPlans(rates) {
    const stored = Array.isArray(app.globalData.fxOrderPlans) ? app.globalData.fxOrderPlans : [];
    return stored.map((item) => {
      const code = this.normalizeCurrencyCode(item.code || 'USD');
      const targetRate = Number(item.targetRate || 0);
      const totalBudgetCny = Number(item.totalBudgetCny || 0);
      const trancheCount = Math.max(1, Math.min(5, Number(item.trancheCount || 3)));
      const stepPct = Math.max(0, Number(item.stepPct || 0));
      const currentRate = this.getRateByCode(rates, code);
      const direction = item.direction === 'above' ? 'above' : 'below';
      const weights = this.getTrancheWeights(trancheCount);
      const stages = weights.map((weight, index) => {
        const directionFactor = direction === 'below' ? -1 : 1;
        const stageRate = targetRate * (1 + directionFactor * ((stepPct / 100) * index));
        const triggered = direction === 'below' ? currentRate <= stageRate : currentRate >= stageRate;
        return {
          label: `第${index + 1}笔`,
          rateText: stageRate.toFixed(4),
          budgetText: `¥${(totalBudgetCny * weight).toFixed(2)}`,
          statusText: triggered ? '已触发' : '待触发',
          triggered
        };
      });
      const planStatus = direction === 'below'
        ? (currentRate <= targetRate ? '已到买入区' : '等待回落')
        : (currentRate >= targetRate ? '已到止盈区' : '等待上行');
      return {
        id: String(item.id || createId('fx')),
        code,
        direction,
        directionText: direction === 'below' ? '低于目标分批买入' : '高于目标分批止盈',
        targetRateText: targetRate.toFixed(4),
        currentRateText: currentRate.toFixed(4),
        totalBudgetText: `¥${totalBudgetCny.toFixed(2)}`,
        note: String(item.note || ''),
        planStatus,
        stages
      };
    }).filter((item) => Number(item.targetRateText) > 0 && Number(item.totalBudgetText.replace(/[¥,]/g, '')) > 0);
  },

  buildDisplayedCashflowPlans() {
    const stored = Array.isArray(app.globalData.cashflowPlans) ? app.globalData.cashflowPlans : [];
    return stored.map((item) => ({
      id: String(item.id || createId('cash')),
      name: String(item.name || '未命名现金流'),
      type: item.type === 'outflow' ? 'outflow' : 'inflow',
      typeText: item.type === 'outflow' ? '流出' : '流入',
      code: this.normalizeCurrencyCode(item.code || 'CNY'),
      amountText: `${this.normalizeCurrencyCode(item.code || 'CNY')} ${Number(item.amount || 0).toFixed(2)}`,
      dueDate: String(item.dueDate || ''),
      frequencyText: item.frequency === 'monthly' ? '每月' : '一次性',
      note: String(item.note || '')
    })).filter((item) => item.dueDate);
  },

  buildDisplayedMaturityPlans() {
    const stored = Array.isArray(app.globalData.maturityPlans) ? app.globalData.maturityPlans : [];
    return stored.map((item) => ({
      id: String(item.id || createId('maturity')),
      name: String(item.name || '未命名到期计划'),
      code: this.normalizeCurrencyCode(item.code || 'CNY'),
      principalText: `${this.normalizeCurrencyCode(item.code || 'CNY')} ${Number(item.principal || 0).toFixed(2)}`,
      maturityDate: String(item.maturityDate || ''),
      aprText: `${Number(item.apr || 0).toFixed(2)}%`,
      note: String(item.note || '')
    })).filter((item) => item.maturityDate);
  },

  buildForecastInsights(rates, totalCny) {
    const rangeDays = Number(this.data.forecastRangeOptions[this.data.forecastRangeIndex] || 90);
    const start = toDateStart(new Date());
    const end = new Date(start.getTime() + rangeDays * 24 * 60 * 60 * 1000);
    const events = [];
    const cashflowPlans = Array.isArray(app.globalData.cashflowPlans) ? app.globalData.cashflowPlans : [];
    const maturityPlans = Array.isArray(app.globalData.maturityPlans) ? app.globalData.maturityPlans : [];

    cashflowPlans.forEach((item) => {
      const code = this.normalizeCurrencyCode(item.code || 'CNY');
      const amount = Number(item.amount || 0);
      const baseDate = toDateStart(item.dueDate || start);
      const rate = this.getRateByCode(rates, code);
      if (!amount || !rate || Number.isNaN(baseDate.getTime())) return;
      const addEvent = (eventDate) => {
        if (eventDate < start || eventDate > end) return;
        const signed = (item.type === 'outflow' ? -1 : 1) * amount * rate;
        events.push({
          id: `${item.id || createId('cash')}_${formatDate(eventDate)}`,
          date: formatDate(eventDate),
          title: String(item.name || '现金流计划'),
          typeText: item.type === 'outflow' ? '流出' : '流入',
          tone: item.type === 'outflow' ? 'down' : 'up',
          value: signed,
          valueText: `${signed >= 0 ? '+' : ''}¥${signed.toFixed(2)}`,
          note: `${code} ${amount.toFixed(2)} · ${item.frequency === 'monthly' ? '每月' : '一次性'}`
        });
      };
      if (item.frequency === 'monthly') {
        let cursor = new Date(baseDate.getTime());
        while (cursor <= end) {
          addEvent(cursor);
          cursor = addMonths(cursor, 1);
        }
      } else {
        addEvent(baseDate);
      }
    });

    maturityPlans.forEach((item) => {
      const code = this.normalizeCurrencyCode(item.code || 'CNY');
      const principal = Number(item.principal || 0);
      const apr = Number(item.apr || 0);
      const maturityDate = toDateStart(item.maturityDate || start);
      const rate = this.getRateByCode(rates, code);
      if (!principal || !rate || Number.isNaN(maturityDate.getTime()) || maturityDate < start || maturityDate > end) return;
      const days = Math.max(1, diffDays(start, maturityDate));
      const interest = principal * (apr / 100) * (days / 365);
      const totalValue = (principal + interest) * rate;
      events.push({
        id: String(item.id || createId('maturity')),
        date: formatDate(maturityDate),
        title: String(item.name || '到期回款'),
        typeText: '到期',
        tone: 'up',
        value: totalValue,
        valueText: `+¥${totalValue.toFixed(2)}`,
        note: `${code} ${(principal + interest).toFixed(2)} · 年化 ${apr.toFixed(2)}%`
      });
    });

    events.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const inflow = events.filter((item) => item.value > 0).reduce((sum, item) => sum + item.value, 0);
    const outflow = Math.abs(events.filter((item) => item.value < 0).reduce((sum, item) => sum + item.value, 0));
    const net = inflow - outflow;
    const nextMaturity = events.find((item) => item.typeText === '到期');
    return {
      summary: {
        rangeText: `${rangeDays} 天`,
        inflowText: `¥${inflow.toFixed(2)}`,
        outflowText: `¥${outflow.toFixed(2)}`,
        netText: `${net >= 0 ? '+' : ''}¥${net.toFixed(2)}`,
        projectedText: `¥${(Number(totalCny || 0) + net).toFixed(2)}`,
        nextMaturityText: nextMaturity ? `${nextMaturity.date} · ${nextMaturity.valueText}` : '暂无到期计划'
      },
      timeline: events.slice(0, 8),
      maturityHighlights: events.filter((item) => item.typeText === '到期').slice(0, 4)
    };
  },

  refreshPlannerModules(summary, rates, risk) {
    const plannerCurrencyOptions = this.buildPlannerCurrencyOptions(summary.currencySummary);
    const rebalance = this.buildRebalancePlan(summary, rates, risk);
    const forecast = this.buildForecastInsights(rates, summary.totalCny);
    const defaultCode = plannerCurrencyOptions[0] ? plannerCurrencyOptions[0].code : 'CNY';
    this.setData({
      plannerCurrencyOptions,
      plannerCurrencyLabels: plannerCurrencyOptions.map((item) => item.label),
      rebalanceSummary: rebalance ? rebalance.summary : null,
      rebalanceActions: rebalance ? rebalance.actions : [],
      fxOrderPlans: this.buildFxOrderPlans(rates),
      cashflowPlans: this.buildDisplayedCashflowPlans(),
      maturityPlans: this.buildDisplayedMaturityPlans(),
      forecastSummary: forecast.summary,
      forecastTimeline: forecast.timeline,
      maturityHighlights: forecast.maturityHighlights,
      fxOrderForm: this.data.fxOrderForm && this.data.fxOrderForm.code ? this.data.fxOrderForm : this.createFxOrderForm(defaultCode),
      cashflowForm: this.data.cashflowForm && this.data.cashflowForm.code ? this.data.cashflowForm : this.createCashflowForm(defaultCode),
      maturityForm: this.data.maturityForm && this.data.maturityForm.code ? this.data.maturityForm : this.createMaturityForm(defaultCode)
    });
  },

  buildShockPreview(code, pct) {
    const shockCode = this.normalizeCurrencyCode(code);
    const numericPct = Number(pct || 0);
    const ratio = numericPct / 100;
    const impactedCards = (this.data.bankCards || [])
      .map((card) => {
        const baseExposure = Number((card.currencyExposureMap && card.currencyExposureMap[shockCode]) || 0);
        const delta = baseExposure * ratio;
        const nextValue = Number(card.totalCny || 0) + delta;
        return {
          id: card.id,
          name: card.name,
          exposureText: `¥${baseExposure.toFixed(2)}`,
          delta,
          deltaText: `${delta >= 0 ? '+' : ''}¥${delta.toFixed(2)}`,
          nextValueText: `¥${nextValue.toFixed(2)}`,
          barWidth: `${Math.max(10, Math.min(100, Math.abs(delta) / Math.max(Number(this.data.totalCny || 1) * 0.01, 1) * 8))}%`,
          tone: delta >= 0 ? 'up' : 'down'
        };
      })
      .filter((item) => Math.abs(item.delta) > 0.001)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    const totalExposure = impactedCards.reduce((sum, item) => sum + (item.delta / ratio || 0), 0);
    const totalDelta = totalExposure * ratio;
    const nextTotal = Number(this.data.totalCny || 0) + totalDelta;
    const alertHits = (app.globalData.alertRules || [])
      .filter((rule) => this.normalizeCurrencyCode(rule.code) === shockCode)
      .slice(0, 3)
      .map((rule) => ({
        id: String(rule.id || ''),
        note: String(rule.note || `${shockCode} 提醒`),
        directionText: String(rule.direction || 'above') === 'below' ? '低于' : '高于',
        thresholdText: Number(rule.threshold || 0).toFixed(4)
      }));

    return {
      shockImpactSummary: {
        code: shockCode,
        pctText: `${numericPct > 0 ? '+' : ''}${numericPct}%`,
        deltaText: `${totalDelta >= 0 ? '+' : ''}¥${totalDelta.toFixed(2)}`,
        nextTotalText: `¥${nextTotal.toFixed(2)}`
      },
      shockImpactedCards: impactedCards.slice(0, 6),
      shockAlertHits: alertHits
    };
  },

  applyShockPreview(code, pct) {
    const preview = this.buildShockPreview(code, pct);
    this.setData({
      shockPct: Number(pct || 0),
      shockPctText: `${Number(pct || 0) > 0 ? '+' : ''}${Number(pct || 0)}%`,
      shockImpactSummary: preview.shockImpactSummary,
      shockImpactedCards: preview.shockImpactedCards,
      shockAlertHits: preview.shockAlertHits
    });
  },

  async loadRiskSummary(bankCards, rates, summary) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'riskAnalyzer',
        data: {
          bankCards,
          currentRates: rates
        }
      });
      const risk = res.result && res.result.success ? this.normalizeRiskSummary(res.result) : null;
      const riskBandState = this.buildRiskBandState(risk, summary);
      this.setData({ latestRiskSummary: risk, ...riskBandState });
      return risk;
    } catch (error) {
      const riskBandState = this.buildRiskBandState(null, summary);
      this.setData({ latestRiskSummary: null, ...riskBandState });
      return null;
    }
  },

  refreshHeatmapChart() {
    const chartComponent = this.selectComponent('#asset-heatmap-chart');
    const { heatmapXAxis, heatmapYAxis, heatmapData } = this.data;
    if (!chartComponent || this.data.privacyMode || !heatmapXAxis.length || !heatmapYAxis.length) return;

    chartComponent.init((canvas, width, height, dpr) => {
      const chart = initChart(canvas, width, height, dpr);
      const maxValue = Math.max(...heatmapData.map((item) => Number(item[2] || 0)), 1);
      chart.setOption({
        tooltip: {
          position: 'top',
          confine: true,
          formatter: (params) => {
            const value = Array.isArray(params.value) ? Number(params.value[2] || 0) : 0;
            return `${heatmapXAxis[params.value[0]]}<br/>${heatmapYAxis[params.value[1]]} · ¥${value.toFixed(2)}`;
          }
        },
        grid: { top: '10%', left: '18%', right: '8%', bottom: '18%', containLabel: true },
        xAxis: {
          type: 'category',
          data: heatmapXAxis,
          splitArea: { show: true },
          axisLabel: { color: '#475569', fontSize: 10, interval: 0, rotate: 18 }
        },
        yAxis: {
          type: 'category',
          data: heatmapYAxis,
          splitArea: { show: true },
          axisLabel: { color: '#475569', fontSize: 10 }
        },
        visualMap: {
          min: 0,
          max: maxValue,
          calculable: false,
          orient: 'horizontal',
          left: 'center',
          bottom: 0,
          textStyle: { color: '#64748b', fontSize: 10 },
          inRange: { color: ['#e0f2fe', '#38bdf8', '#0f766e', '#14532d'] }
        },
        series: [{
          name: '资产热力',
          type: 'heatmap',
          data: heatmapData,
          label: {
            show: true,
            formatter: (params) => {
              const value = Number((params.value && params.value[2]) || 0);
              return value > 0 ? Math.round(value) : '';
            },
            fontSize: 9,
            color: '#0f172a'
          },
          emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(15, 23, 42, 0.18)' } }
        }]
      });
      return chart;
    });
  },

  refreshFundsFlowChart() {
    const chartComponent = this.selectComponent('#funds-flow-chart');
    const { sankeyNodes, sankeyLinks } = this.data;
    if (!chartComponent || this.data.privacyMode || !sankeyLinks.length) return;

    chartComponent.init((canvas, width, height, dpr) => {
      const chart = initChart(canvas, width, height, dpr);
      chart.setOption({
        tooltip: {
          trigger: 'item',
          confine: true,
          formatter: (params) => {
            if (params.dataType === 'edge') {
              return `${params.data.source} → ${params.data.target}<br/>¥${Number(params.data.value || 0).toFixed(2)}`;
            }
            return params.name;
          }
        },
        series: [{
          type: 'sankey',
          left: '2%',
          right: '2%',
          top: '3%',
          bottom: '3%',
          nodeWidth: 14,
          nodeGap: 10,
          emphasis: { focus: 'adjacency' },
          lineStyle: { color: 'gradient', curveness: 0.5, opacity: 0.35 },
          label: {
            color: '#334155',
            fontSize: 10,
            formatter: (params) => {
              const name = params.data.displayName || params.name || '';
              return String(name).replace(/^CARD_|^CUR_/, '');
            }
          },
          data: sankeyNodes,
          links: sankeyLinks,
          itemStyle: {
            borderWidth: 0,
            color: (params) => {
              if (String(params.name).startsWith('CUR_')) return '#38bdf8';
              if (String(params.name).startsWith('CARD_')) return '#0f766e';
              return '#1d4ed8';
            }
          }
        }]
      });
      return chart;
    });
  },

  refreshVisualCharts() {
    wx.nextTick(() => {
      setTimeout(() => {
        this.refreshHeatmapChart();
        this.refreshFundsFlowChart();
      }, 120);
    });
  },

  async loadBankCards() {
    try {
      const bankCards = Array.isArray(app.globalData.bankCards) ? app.globalData.bankCards : (wx.getStorageSync('bankCards') || []);
      const rates = await exchangeRateUtil.getSinaRealTimeRates();
      app.globalData.exchangeRates = rates;
      wx.setStorageSync('exchangeRates', rates);
      const summary = this.buildSummary(bankCards, rates);
      const shockCurrencyOptions = summary.currencySummary.map((item) => ({ code: item.code, label: item.code }));
      const shockCodeIndex = Math.min(this.data.shockCodeIndex || 0, Math.max(shockCurrencyOptions.length - 1, 0));
      const selectedShockCode = shockCurrencyOptions[shockCodeIndex] ? shockCurrencyOptions[shockCodeIndex].code : '';
      const heatmap = this.buildHeatmapPayload(summary.cards, summary.currencySummary);
      const sankey = this.buildSankeyPayload(summary.cards, summary.currencySummary);
      const fundsFlow = this.buildFundsFlowPayload(summary.cards, summary.currencySummary, summary.totalCny);

      this.setData({
        bankCards: summary.cards,
        currencySummary: summary.currencySummary,
        totalCny: summary.totalCny,
        cardCount: summary.cardCount,
        currencyAccountCount: summary.currencyAccountCount,
        uniqueCurrencyCount: summary.uniqueCurrencyCount,
        topCurrencyExposureText: summary.topCurrencyExposureText,
        topCardName: summary.topCardName,
        topCardValueText: summary.topCardValueText,
        averageAssetText: summary.averageAssetText,
        dashboardTone: summary.dashboardTone,
        shockCurrencyOptions,
        shockCurrencyLabels: shockCurrencyOptions.map((item) => item.label),
        shockCodeIndex,
        heatmapXAxis: heatmap.heatmapXAxis,
        heatmapYAxis: heatmap.heatmapYAxis,
        heatmapData: heatmap.heatmapData,
        heatmapRows: heatmap.heatmapRows,
        sankeyNodes: sankey.sankeyNodes,
        sankeyLinks: sankey.sankeyLinks,
        fundsFlowCards: fundsFlow.fundsFlowCards,
        fundsFlowCurrencies: fundsFlow.fundsFlowCurrencies,
        privacyMode: !!app.globalData.privacyMode,
        biometricEnabled: !!app.globalData.biometricEnabled
      }, () => {
        if (selectedShockCode) {
          this.applyShockPreview(selectedShockCode, this.data.shockPct || 0);
        } else {
          this.setData({ shockImpactSummary: null, shockImpactedCards: [], shockAlertHits: [] });
        }
        this.refreshVisualCharts();
      });

      const risk = await this.loadRiskSummary(bankCards, rates, summary);
      this.refreshPlannerModules(summary, rates, risk);
    } catch (error) {
      console.error('loadBankCards failed:', error);
      wx.showToast({ title: '实时汇率暂不可用', icon: 'none' });
    }
  },

  requestBiometricAuth(reason = '验证身份后显示敏感金额') {
    return new Promise((resolve) => {
      if (!wx.checkIsSupportSoterAuthentication || !wx.startSoterAuthentication) {
        resolve(true);
        return;
      }

      wx.checkIsSupportSoterAuthentication({
        success: (supportRes) => {
          const modes = Array.isArray(supportRes.supportMode) ? supportRes.supportMode : [];
          const authMode = modes[0];
          if (!authMode) {
            resolve(true);
            return;
          }
          wx.startSoterAuthentication({
            requestAuthModes: [authMode],
            challenge: 'miniprogram-asset-privacy',
            authContent: reason,
            success: () => resolve(true),
            fail: () => resolve(false)
          });
        },
        fail: () => resolve(true)
      });
    });
  },

  gotoAddCard() {
    wx.navigateTo({ url: '/pages/addCard/addCard?mode=add' });
  },

  buildExportRateList() {
    const rates = app.globalData.exchangeRates || {};
    const source = Array.isArray(this.data.currencySummary) ? this.data.currencySummary : [];
    return source.map((item) => ({
      code: item.code,
      name: item.code,
      upperCode: item.code,
      rate: Number(this.getRateByCode(rates, item.code) || 0).toFixed(4)
    })).filter((item) => Number(item.rate) > 0);
  },

  gotoExport() {
    if (!this.data.cardCount) {
      wx.showToast({ title: '暂无可导出数据', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: '/pages/export/export',
      success: (res) => {
        res.eventChannel.emit('summaryData', {
          rateList: this.buildExportRateList(),
          currencySummary: this.data.currencySummary,
          totalCny: this.data.totalCny
        });
      }
    });
  },

  gotoDiagnostics() {
    wx.navigateTo({ url: '/pages/diagnostics/diagnostics' });
  },

  copyBankSummary() {
    if (!this.data.cardCount) {
      wx.showToast({ title: '暂无摘要可复制', icon: 'none' });
      return;
    }
    const summary = [
      '银行卡资产摘要',
      `总资产：${this.data.privacyMode ? '***' : `¥${this.data.totalCny}`}`,
      `银行卡：${this.data.cardCount} 张`,
      `账户数：${this.data.currencyAccountCount} 个`,
      `头部银行卡：${this.data.topCardName}`,
      `最大敞口：${this.data.privacyMode ? '金额已隐藏' : this.data.topCurrencyExposureText}`
    ].join('\n');
    wx.setClipboardData({
      data: summary,
      success: () => wx.showToast({ title: '摘要已复制', icon: 'success' })
    });
  },

  toggleBiometricEnabled() {
    const next = !this.data.biometricEnabled;
    app.globalData.biometricEnabled = next;
    if (app.sync) app.sync();
    this.setData({ biometricEnabled: next });
    wx.showToast({ title: next ? '已开启生物验证' : '已关闭生物验证', icon: 'none' });
  },

  gotoAccountDetail(e) {
    const { cardid } = e.currentTarget.dataset;
    if (!cardid) return;
    wx.navigateTo({ url: `/pages/accountDetail/accountDetail?cardId=${cardid}` });
  },

  onShockCurrencyChange(e) {
    const shockCodeIndex = Number(e.detail.value || 0);
    const target = this.data.shockCurrencyOptions[shockCodeIndex];
    this.setData({ shockCodeIndex });
    if (target) {
      this.applyShockPreview(target.code, this.data.shockPct || 0);
    }
  },

  onShockSliderChange(e) {
    const pct = Number(e.detail.value || 0);
    const target = this.data.shockCurrencyOptions[this.data.shockCodeIndex];
    if (!target) return;
    this.applyShockPreview(target.code, pct);
  },

  selectForecastRange(e) {
    const index = Number(e.currentTarget.dataset.index || 0);
    this.setData({ forecastRangeIndex: index });
    this.refreshPlannerModules({
      totalCny: this.data.totalCny,
      currencySummary: this.data.currencySummary
    }, app.globalData.exchangeRates || {}, this.data.latestRiskSummary);
  },

  openFxOrderEditor(e) {
    const planId = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.id : '';
    const source = (Array.isArray(app.globalData.fxOrderPlans) ? app.globalData.fxOrderPlans : []).find((item) => String(item.id) === String(planId));
    this.setData({
      showFxOrderEditor: true,
      editingFxOrderId: source ? String(source.id) : '',
      fxOrderForm: source ? {
        code: this.normalizeCurrencyCode(source.code),
        direction: source.direction === 'above' ? 'above' : 'below',
        targetRate: String(source.targetRate || ''),
        totalBudgetCny: String(source.totalBudgetCny || ''),
        trancheCount: String(source.trancheCount || '3'),
        stepPct: String(source.stepPct || '0.6'),
        note: String(source.note || '')
      } : this.createFxOrderForm((this.data.plannerCurrencyOptions[1] && this.data.plannerCurrencyOptions[1].code) || 'USD')
    });
  },

  closeFxOrderEditor() {
    this.setData({
      showFxOrderEditor: false,
      editingFxOrderId: '',
      fxOrderForm: this.createFxOrderForm((this.data.plannerCurrencyOptions[1] && this.data.plannerCurrencyOptions[1].code) || 'USD')
    });
  },

  onFxOrderFieldInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`fxOrderForm.${field}`]: e.detail.value });
  },

  onFxOrderCodeChange(e) {
    const option = this.data.plannerCurrencyOptions[Number(e.detail.value || 0)];
    if (!option) return;
    this.setData({ 'fxOrderForm.code': option.code });
  },

  onFxOrderDirectionChange(e) {
    const direction = this.data.fxDirectionValues[Number(e.detail.value || 0)] || 'below';
    this.setData({ 'fxOrderForm.direction': direction });
  },

  saveFxOrderPlan() {
    const form = this.data.fxOrderForm || {};
    const targetRate = Number(form.targetRate || 0);
    const totalBudgetCny = Number(form.totalBudgetCny || 0);
    if (!targetRate || !totalBudgetCny) {
      wx.showToast({ title: '请填写目标汇率和预算', icon: 'none' });
      return;
    }
    const next = Array.isArray(app.globalData.fxOrderPlans) ? [...app.globalData.fxOrderPlans] : [];
    const payload = {
      id: this.data.editingFxOrderId || createId('fx'),
      code: this.normalizeCurrencyCode(form.code),
      direction: form.direction === 'above' ? 'above' : 'below',
      targetRate,
      totalBudgetCny,
      trancheCount: Math.max(1, Math.min(5, Number(form.trancheCount || 3))),
      stepPct: Math.max(0, Number(form.stepPct || 0)),
      note: String(form.note || '')
    };
    const index = next.findIndex((item) => String(item.id) === String(payload.id));
    if (index >= 0) next.splice(index, 1, payload);
    else next.unshift(payload);
    app.globalData.fxOrderPlans = next;
    if (app.sync) app.sync();
    this.closeFxOrderEditor();
    this.refreshPlannerModules({ totalCny: this.data.totalCny, currencySummary: this.data.currencySummary }, app.globalData.exchangeRates || {}, this.data.latestRiskSummary);
    wx.showToast({ title: '计划已保存', icon: 'success' });
  },

  deleteFxOrderPlan(e) {
    const planId = e.currentTarget.dataset.id;
    app.globalData.fxOrderPlans = (app.globalData.fxOrderPlans || []).filter((item) => String(item.id) !== String(planId));
    if (app.sync) app.sync();
    this.refreshPlannerModules({ totalCny: this.data.totalCny, currencySummary: this.data.currencySummary }, app.globalData.exchangeRates || {}, this.data.latestRiskSummary);
  },

  openCashflowEditor(e) {
    const planId = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.id : '';
    const source = (Array.isArray(app.globalData.cashflowPlans) ? app.globalData.cashflowPlans : []).find((item) => String(item.id) === String(planId));
    this.setData({
      showCashflowEditor: true,
      editingCashflowId: source ? String(source.id) : '',
      cashflowForm: source ? {
        name: String(source.name || ''),
        type: source.type === 'outflow' ? 'outflow' : 'inflow',
        code: this.normalizeCurrencyCode(source.code),
        amount: String(source.amount || ''),
        dueDate: String(source.dueDate || formatDate(new Date())),
        frequency: source.frequency === 'monthly' ? 'monthly' : 'once',
        note: String(source.note || '')
      } : this.createCashflowForm('CNY')
    });
  },

  closeCashflowEditor() {
    this.setData({ showCashflowEditor: false, editingCashflowId: '', cashflowForm: this.createCashflowForm('CNY') });
  },

  onCashflowFieldInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`cashflowForm.${field}`]: e.detail.value });
  },

  onCashflowCodeChange(e) {
    const option = this.data.plannerCurrencyOptions[Number(e.detail.value || 0)];
    if (!option) return;
    this.setData({ 'cashflowForm.code': option.code });
  },

  onCashflowTypeChange(e) {
    this.setData({ 'cashflowForm.type': this.data.cashflowTypeValues[Number(e.detail.value || 0)] || 'inflow' });
  },

  onCashflowFrequencyChange(e) {
    this.setData({ 'cashflowForm.frequency': this.data.cashflowFrequencyValues[Number(e.detail.value || 0)] || 'once' });
  },

  onCashflowDateChange(e) {
    this.setData({ 'cashflowForm.dueDate': e.detail.value });
  },

  saveCashflowPlan() {
    const form = this.data.cashflowForm || {};
    if (!form.name || !Number(form.amount || 0) || !form.dueDate) {
      wx.showToast({ title: '请填写完整现金流信息', icon: 'none' });
      return;
    }
    const next = Array.isArray(app.globalData.cashflowPlans) ? [...app.globalData.cashflowPlans] : [];
    const payload = {
      id: this.data.editingCashflowId || createId('cash'),
      name: String(form.name || ''),
      type: form.type === 'outflow' ? 'outflow' : 'inflow',
      code: this.normalizeCurrencyCode(form.code),
      amount: Number(form.amount || 0),
      dueDate: String(form.dueDate || ''),
      frequency: form.frequency === 'monthly' ? 'monthly' : 'once',
      note: String(form.note || '')
    };
    const index = next.findIndex((item) => String(item.id) === String(payload.id));
    if (index >= 0) next.splice(index, 1, payload);
    else next.unshift(payload);
    app.globalData.cashflowPlans = next;
    if (app.sync) app.sync();
    this.closeCashflowEditor();
    this.refreshPlannerModules({ totalCny: this.data.totalCny, currencySummary: this.data.currencySummary }, app.globalData.exchangeRates || {}, this.data.latestRiskSummary);
    wx.showToast({ title: '现金流已保存', icon: 'success' });
  },

  deleteCashflowPlan(e) {
    const planId = e.currentTarget.dataset.id;
    app.globalData.cashflowPlans = (app.globalData.cashflowPlans || []).filter((item) => String(item.id) !== String(planId));
    if (app.sync) app.sync();
    this.refreshPlannerModules({ totalCny: this.data.totalCny, currencySummary: this.data.currencySummary }, app.globalData.exchangeRates || {}, this.data.latestRiskSummary);
  },

  openMaturityEditor(e) {
    const planId = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.id : '';
    const source = (Array.isArray(app.globalData.maturityPlans) ? app.globalData.maturityPlans : []).find((item) => String(item.id) === String(planId));
    this.setData({
      showMaturityEditor: true,
      editingMaturityId: source ? String(source.id) : '',
      maturityForm: source ? {
        name: String(source.name || ''),
        code: this.normalizeCurrencyCode(source.code),
        principal: String(source.principal || ''),
        maturityDate: String(source.maturityDate || formatDate(addMonths(new Date(), 1))),
        apr: String(source.apr || '2.0'),
        note: String(source.note || '')
      } : this.createMaturityForm('CNY')
    });
  },

  closeMaturityEditor() {
    this.setData({ showMaturityEditor: false, editingMaturityId: '', maturityForm: this.createMaturityForm('CNY') });
  },

  onMaturityFieldInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`maturityForm.${field}`]: e.detail.value });
  },

  onMaturityCodeChange(e) {
    const option = this.data.plannerCurrencyOptions[Number(e.detail.value || 0)];
    if (!option) return;
    this.setData({ 'maturityForm.code': option.code });
  },

  onMaturityDateChange(e) {
    this.setData({ 'maturityForm.maturityDate': e.detail.value });
  },

  saveMaturityPlan() {
    const form = this.data.maturityForm || {};
    if (!form.name || !Number(form.principal || 0) || !form.maturityDate) {
      wx.showToast({ title: '请填写完整到期信息', icon: 'none' });
      return;
    }
    const next = Array.isArray(app.globalData.maturityPlans) ? [...app.globalData.maturityPlans] : [];
    const payload = {
      id: this.data.editingMaturityId || createId('maturity'),
      name: String(form.name || ''),
      code: this.normalizeCurrencyCode(form.code),
      principal: Number(form.principal || 0),
      maturityDate: String(form.maturityDate || ''),
      apr: Number(form.apr || 0),
      note: String(form.note || '')
    };
    const index = next.findIndex((item) => String(item.id) === String(payload.id));
    if (index >= 0) next.splice(index, 1, payload);
    else next.unshift(payload);
    app.globalData.maturityPlans = next;
    if (app.sync) app.sync();
    this.closeMaturityEditor();
    this.refreshPlannerModules({ totalCny: this.data.totalCny, currencySummary: this.data.currencySummary }, app.globalData.exchangeRates || {}, this.data.latestRiskSummary);
    wx.showToast({ title: '到期计划已保存', icon: 'success' });
  },

  deleteMaturityPlan(e) {
    const planId = e.currentTarget.dataset.id;
    app.globalData.maturityPlans = (app.globalData.maturityPlans || []).filter((item) => String(item.id) !== String(planId));
    if (app.sync) app.sync();
    this.refreshPlannerModules({ totalCny: this.data.totalCny, currencySummary: this.data.currencySummary }, app.globalData.exchangeRates || {}, this.data.latestRiskSummary);
  },

  async togglePrivacyMode() {
    const next = !this.data.privacyMode;
    if (!next && this.data.biometricEnabled) {
      const passed = await this.requestBiometricAuth('验证后显示银行卡账户金额');
      if (!passed) {
        wx.showToast({ title: '验证未通过', icon: 'none' });
        return;
      }
    }
    app.globalData.privacyMode = next;
    if (app.sync) app.sync();
    this.setData({ privacyMode: next }, () => {
      this.refreshVisualCharts();
    });
    wx.showToast({ title: next ? '金额已隐藏' : '金额已显示', icon: 'none' });
  },

  deleteCard(e) {
    const { cardid } = e.currentTarget.dataset;
    if (!cardid) return;
    wx.showModal({
      title: '删除银行卡',
      content: '删除后该银行卡及其币种账户将被移除，无法恢复。',
      success: (res) => {
        if (!res.confirm) return;
        app.globalData.bankCards = (app.globalData.bankCards || []).filter((card) => card.id !== cardid);
        if (app.sync) app.sync();
        this.loadBankCards();
        wx.showToast({ title: '已删除', icon: 'success' });
      }
    });
  }
});