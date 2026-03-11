import * as echarts from '../../components/ec-canvas/echarts';

const app = getApp();
const exchangeRateUtil = require('../../utils/exchangeRate.js');

function initChart(canvas, width, height, dpr) {
  const chart = echarts.init(canvas, null, {
    width: width,
    height: height,
    devicePixelRatio: dpr
  });
  canvas.setChart(chart);
  return chart;
}

Page({
  data: {
    cardId: '',
    cardInfo: {},
    currencyList: [],
    totalCny: '0.00',
    ec: { lazyLoad: true },
    ecTrend: { lazyLoad: true },
    ecForecast: { lazyLoad: true },
    ecCardRiskContribution: { lazyLoad: true },
    selectedCurrencyCodes: [], 
    privacyMode: false,
    biometricEnabled: false,
    isOutlookLoading: false,
    isCardRiskLoading: false,
    portfolioOutlook: null,
    cardRiskSummary: null,
    cardRiskFocusCode: '',
    cardRiskSuggestion: null,
    cardRiskSuggestionModes: [
      { key: 'guarded', label: '保守' },
      { key: 'standard', label: '标准' },
      { key: 'aggressive', label: '激进' }
    ],
    selectedCardRiskSuggestionMode: 'standard',
    cardAlertRules: [],
    highlightedCardAlertId: '',
    allCurrencyList: [
      { code: 'cny', name: 'CNY' }, { code: 'usd', name: 'USD' },
      { code: 'hkd', name: 'HKD' }, { code: 'eur', name: 'EUR' },
      { code: 'jpy', name: 'JPY' }, { code: 'gbp', name: 'GBP' },
      { code: 'cad', name: 'CAD' }, { code: 'aud', name: 'AUD' },
      { code: 'nzd', name: 'NZD' }, { code: 'chf', name: 'CHF' },
      { code: 'sgd', name: 'SGD' }, { code: 'thb', name: 'THB' },
      { code: 'myr', name: 'RM' }, { code: 'krw', name: 'KRW' }
    ],
    pieColors: ['#ff9f43', '#ffbd69', '#ff9671', '#ffc75f', '#f9f871', '#ff8066', '#ffb88c', '#ffd571', '#ffacc7', '#ffecb3'], 
    trendColors: ['#2f54eb', '#6c5ce7', '#4b7bec', '#ff7875', '#13c2c2', '#faad14', '#1890ff'],
    currencyMap: {
      cny: 'CNY', usd: 'USD', hkd: 'HKD', eur: 'EUR', jpy: 'JPY', gbp: 'GBP',
      cad: 'CAD', aud: 'AUD', nzd: 'NZD', chf: 'CHF', sgd: 'SGD', thb: 'THB',
      myr: 'RM', krw: 'KRW'
    },
    showModal: false,
    showAddModal: false,
    showNameModal: false,
    currentEditCode: '',
    currentCurName: '',
    newAmount: '',
    selectedAddCode: '',
    selectedAddName: '',
    addAmount: '',
    tempCardName: '',
    startX: 0,
    delIndex: -1
  },

  onLoad: function(options) {
    var cardId = options.cardId;
    if (!cardId) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(function() { wx.navigateBack(); }, 1000);
      return;
    }
    this.setData({ cardId: cardId });
  },

  onShow: function() {
    this.syncSecurityStateFromGlobal();
    // 【记忆逻辑升级】优先从云端拉取的全局数据中找勾选状态，实现多端同步
    const bankCards = app.globalData.bankCards || wx.getStorageSync('bankCards') || [];
    const targetCard = bankCards.find(item => item.id === this.data.cardId);
    
    let savedSelected = [];
    if (targetCard && targetCard.selectedCodes) {
      savedSelected = targetCard.selectedCodes;
    } else {
      // 备选方案：尝试本地缓存
      savedSelected = wx.getStorageSync('selected_codes_' + this.data.cardId) || [];
    }

    this.setData({ selectedCurrencyCodes: savedSelected });

    this.loadCardAndCalculateTotal().then(async () => {
      this.syncCardAlertRulesFromGlobal();
      await this.loadCardRiskInsights();
      await this.loadPortfolioOutlook();
      this.refreshAllCharts(); 
    });
  },

  syncSecurityStateFromGlobal: function() {
    this.setData({
      privacyMode: !!app.globalData.privacyMode,
      biometricEnabled: !!app.globalData.biometricEnabled
    });
  },

  loadCardAndCalculateTotal: function() {
    var cardId = this.data.cardId;
    var bankCards = app.globalData.bankCards || wx.getStorageSync('bankCards') || [];
    var targetCard = bankCards.find(item => item.id === cardId);
    
    if (!targetCard) {
      wx.showToast({ title: '记录不存在', icon: 'none' });
      setTimeout(() => { wx.navigateBack(); }, 1000);
      return Promise.reject();
    }

    var currencyList = (targetCard.currencies || []).map(item => Object.assign({}, item, { delShow: false }));
    var rates = app.globalData.exchangeRates || {};
    var totalCny = this.calcCardCnyTotal(currencyList, rates);

    return new Promise((resolve) => {
      this.setData({
        cardInfo: targetCard,
        currencyList: currencyList,
        totalCny: totalCny.toFixed(2)
      }, () => { resolve(); });
    });
  },

  calcCardCnyTotal: function(currencies, rates) {
    var total = 0;
    if (!currencies || !rates) return 0;
    currencies.forEach(cur => {
      var amount = parseFloat(cur.amount) || 0;
      var code = (cur.code || '').toUpperCase();
      var rate = (code === 'CNY') ? 1 : (rates[code] || rates[code.toLowerCase()] || 0);
      total += amount * rate;
    });
    return total;
  },

  refreshAllCharts: function() {
    wx.nextTick(() => {
      setTimeout(() => {
        this.refreshPieChart();
        this.refreshTrendChart();
        this.refreshForecastChart();
        this.refreshCardRiskContributionChart();
      }, 300);
    });
  },

  normalizeAlertRule: function(rule, fallbackIndex) {
    if (!rule || typeof rule !== 'object') return null;
    var code = String(rule.code || '').trim().toUpperCase();
    var threshold = Number(rule.threshold || 0);
    if (!code || !Number.isFinite(threshold) || threshold <= 0) return null;
    var direction = String(rule.direction || 'above') === 'below' ? 'below' : 'above';
    return {
      id: String(rule.id || ('alert_' + (fallbackIndex + 1))),
      code: code,
      threshold: threshold,
      thresholdText: threshold.toFixed(4),
      direction: direction,
      directionText: direction === 'below' ? '低于' : '高于',
      note: String(rule.note || (code + ' ' + (direction === 'below' ? '跌破' : '升破') + ' ' + threshold.toFixed(4))),
      enabled: rule.enabled !== false,
      sourceCardId: String(rule.sourceCardId || '')
    };
  },

  normalizeAlertRules: function(list) {
    if (!Array.isArray(list)) return [];
    return list.map((item, index) => this.normalizeAlertRule(item, index)).filter(Boolean);
  },

  syncCardAlertRulesFromGlobal: function() {
    var cardId = this.data.cardId;
    var rules = this.normalizeAlertRules(app.globalData.alertRules || []).filter(item => item.sourceCardId === cardId);
    this.setData({ cardAlertRules: rules }, () => {
      this.updateCardRiskSuggestion();
    });
  },

  calculateMaxDrawdown: function(values) {
    if (!Array.isArray(values) || values.length < 2) return 0;
    var peak = Number(values[0] || 0);
    var maxDrawdown = 0;
    values.forEach((value) => {
      var numeric = Number(value || 0);
      if (numeric > peak) peak = numeric;
      if (peak > 0 && numeric >= 0) {
        maxDrawdown = Math.max(maxDrawdown, (peak - numeric) / peak);
      }
    });
    return maxDrawdown;
  },

  buildCardRiskInsights: function(risk) {
    var totalValue = Number(risk.totalValue || 0);
    var var95Ratio = totalValue > 0 ? Number(risk.var95 || 0) / totalValue : 0;
    var topExposure = Array.isArray(risk.topExposures) && risk.topExposures.length ? risk.topExposures[0] : null;
    var topContribution = Array.isArray(risk.riskContributions) && risk.riskContributions.length ? risk.riskContributions[0] : null;
    var concentrationRatio = topExposure && totalValue > 0 ? topExposure.cnyValue / totalValue : 0;
    var maxDrawdown = this.calculateMaxDrawdown((risk.portfolioSeries && risk.portfolioSeries.values) || []);
    var pulseTone = 'steady';
    var pulseLabel = '稳态';

    if (var95Ratio >= 0.04 || concentrationRatio >= 0.58 || Number(risk.volatility || 0) >= 0.18) {
      pulseTone = 'elevated';
      pulseLabel = '偏高';
    } else if (var95Ratio >= 0.025 || concentrationRatio >= 0.42 || Number(risk.volatility || 0) >= 0.1) {
      pulseTone = 'watch';
      pulseLabel = '关注';
    }

    return {
      pulseTone: pulseTone,
      pulseLabel: pulseLabel,
      pulseText: pulseTone === 'steady' ? '这张卡的波动暂时可控。' : pulseTone === 'watch' ? '这张卡存在敏感敞口，建议布防提醒。' : '这张卡风险偏高，建议立即配置守护线。',
      maxDrawdown: maxDrawdown,
      maxDrawdownText: (maxDrawdown * 100).toFixed(2) + '%',
      signals: [
        '95% 单日风险预算约占该卡组合 ' + (var95Ratio * 100).toFixed(2) + '%。',
        topExposure ? ('最大敞口为 ' + topExposure.code + '，集中度 ' + (concentrationRatio * 100).toFixed(1) + '%。') : '当前未识别出明显单币种集中敞口。',
        topContribution ? (topContribution.code + ' 贡献了 ' + topContribution.contributionText + ' 的风险波动。') : '当前暂无风险贡献拆分结果。',
        '历史回放最大回撤约 ' + (maxDrawdown * 100).toFixed(2) + '%。'
      ]
    };
  },

  normalizeCardRiskSummary: function(summary) {
    if (!summary || typeof summary !== 'object') return null;
    var portfolioSeries = summary.portfolioSeries && typeof summary.portfolioSeries === 'object' ? summary.portfolioSeries : {};
    var normalized = {
      totalValue: Number(summary.totalValue || 0),
      totalValueText: '¥' + Number(summary.totalValue || 0).toFixed(2),
      var95: Number(summary.var95 || 0),
      var99: Number(summary.var99 || 0),
      var95Text: '¥' + Number(summary.var95 || 0).toFixed(2),
      var99Text: '¥' + Number(summary.var99 || 0).toFixed(2),
      volatility: Number(summary.volatility || 0),
      volatilityText: (Number(summary.volatility || 0) * 100).toFixed(2) + '%',
      confidenceText: summary.confidenceHint === 'history_ok' ? '历史样本充足' : '历史样本偏少',
      portfolioSeries: {
        labels: Array.isArray(portfolioSeries.labels) ? portfolioSeries.labels.map(item => String(item || '').slice(5) || String(item || '')) : [],
        values: Array.isArray(portfolioSeries.values) ? portfolioSeries.values.map(item => Number(item || 0)) : []
      },
      topExposures: (Array.isArray(summary.topExposures) ? summary.topExposures : []).map(item => ({
        code: String(item.code || '').toUpperCase(),
        cnyValue: Number(item.cnyValue || 0),
        cnyText: '¥' + Number(item.cnyValue || 0).toFixed(2)
      })),
      riskContributions: (Array.isArray(summary.riskContributions) ? summary.riskContributions : []).map(item => ({
        code: String(item.code || '').toUpperCase(),
        cnyValue: Number(item.cnyValue || 0),
        cnyText: '¥' + Number(item.cnyValue || 0).toFixed(2),
        weightPct: Number(item.weightPct || 0),
        weightText: Number(item.weightPct || 0).toFixed(1) + '%',
        contributionPct: Number(item.contributionPct || 0),
        contributionText: Number(item.contributionPct || 0).toFixed(1) + '%',
        assetVol: Number(item.assetVol || 0),
        volatilityText: (Number(item.assetVol || 0) * 100).toFixed(2) + '%'
      }))
    };
    return Object.assign({}, normalized, this.buildCardRiskInsights(normalized));
  },

  loadCardRiskInsights: async function() {
    var cardInfo = this.data.cardInfo;
    if (!cardInfo || !Array.isArray(cardInfo.currencies) || !cardInfo.currencies.length) {
      this.setData({ cardRiskSummary: null });
      return;
    }

    this.setData({ isCardRiskLoading: true });
    try {
      var riskRes = await wx.cloud.callFunction({
        name: 'riskAnalyzer',
        data: {
          bankCards: [cardInfo],
          currentRates: app.globalData.exchangeRates || {}
        }
      });
      var normalized = riskRes.result && riskRes.result.success ? this.normalizeCardRiskSummary(riskRes.result) : null;
      this.setData({ cardRiskSummary: normalized }, () => {
        this.updateCardRiskSuggestion();
        this.refreshCardRiskContributionChart();
      });
    } catch (error) {
      console.error('loadCardRiskInsights failed', error);
      this.setData({ cardRiskSummary: null });
    } finally {
      this.setData({ isCardRiskLoading: false });
    }
  },

  refreshCardRiskContributionChart: function() {
    var chartComponent = this.selectComponent('#card-risk-contribution-chart');
    var risk = this.data.cardRiskSummary;
    var items = risk && Array.isArray(risk.riskContributions) ? risk.riskContributions : [];
    if (!chartComponent || this.data.privacyMode || !items.length) return;

    chartComponent.init((canvas, width, height, dpr) => {
      var chart = initChart(canvas, width, height, dpr);
      chart.setOption({
        color: ['#ef7d2d'],
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          confine: true,
          formatter: (params) => {
            var point = Array.isArray(params) ? params[0] : params;
            var item = items[point.dataIndex] || {};
            return item.code + '<br/>风险贡献 ' + (item.contributionText || '0%') + '<br/>敞口占比 ' + (item.weightText || '0%') + '<br/>年化波动 ' + (item.volatilityText || '0%');
          }
        },
        grid: { top: '10%', left: '18%', right: '8%', bottom: '10%', containLabel: true },
        xAxis: {
          type: 'value',
          axisLabel: { color: '#94a3b8', fontSize: 10, formatter: function(value) { return value + '%'; } },
          splitLine: { lineStyle: { color: '#e2e8f0' } }
        },
        yAxis: {
          type: 'category',
          data: items.map(item => item.code),
          axisLabel: { color: '#334155', fontSize: 10 }
        },
        series: [{
          type: 'bar',
          data: items.map(item => item.contributionPct),
          barWidth: 18,
          itemStyle: { borderRadius: [0, 10, 10, 0] },
          label: {
            show: true,
            position: 'right',
            color: '#475569',
            fontSize: 10,
            formatter: function(params) {
              return items[params.dataIndex] ? items[params.dataIndex].contributionText : '';
            }
          }
        }]
      });
      chart.off('click');
      chart.on('click', (params) => {
        var item = items[params.dataIndex] || {};
        if (item.code) this.setCardRiskFocus(item.code);
      });
      return chart;
    });
  },

  setCardRiskFocus: function(code) {
    var nextCode = String(code || '').toUpperCase();
    if (!nextCode) return;
    this.setData({ cardRiskFocusCode: nextCode }, () => {
      this.updateCardRiskSuggestion();
    });
  },

  clearCardRiskFocus: function() {
    this.setData({ cardRiskFocusCode: '', cardRiskSuggestion: null });
  },

  onCardRiskContributionTap: function(e) {
    var code = e.currentTarget.dataset.code;
    if (!code) return;
    this.setCardRiskFocus(code);
  },

  getCardRiskSuggestionModeMeta: function(modeKey) {
    var mode = String(modeKey || this.data.selectedCardRiskSuggestionMode || 'standard');
    var modeMap = {
      guarded: { label: '保守', multiplier: 0.72 },
      standard: { label: '标准', multiplier: 1 },
      aggressive: { label: '激进', multiplier: 1.35 }
    };
    return modeMap[mode] || modeMap.standard;
  },

  selectCardRiskSuggestionMode: function(e) {
    var mode = String(e.currentTarget.dataset.mode || 'standard');
    if (!mode || mode === this.data.selectedCardRiskSuggestionMode) return;
    this.setData({ selectedCardRiskSuggestionMode: mode }, () => {
      this.updateCardRiskSuggestion();
    });
  },

  buildCardRiskSuggestion: function(code) {
    var focusCode = String(code || '').toUpperCase();
    if (!focusCode) return null;
    var currentRate = this.getRateByCode(focusCode);
    if (!currentRate) return null;

    var risk = this.data.cardRiskSummary || {};
    var contribution = Array.isArray(risk.riskContributions) ? risk.riskContributions.find(item => item.code === focusCode) : null;
    var currentRules = this.normalizeAlertRules(app.globalData.alertRules || []);
    var cardRules = currentRules.filter(item => item.sourceCardId === this.data.cardId && item.code === focusCode);
    var modeMeta = this.getCardRiskSuggestionModeMeta();
    var volatilityBase = contribution ? Number(contribution.assetVol || 0) : Number(risk.volatility || 0);
    var baseBuffer = Math.min(0.045, Math.max(0.015, volatilityBase * 0.2 || 0.02));
    var bufferPct = Math.min(0.06, Math.max(0.008, baseBuffer * modeMeta.multiplier));
    var threshold = Number((currentRate * (1 - bufferPct)).toFixed(4));
    var cardName = String((this.data.cardInfo && this.data.cardInfo.name) || '该卡').trim();

    return {
      code: focusCode,
      currentRateText: currentRate.toFixed(4),
      threshold: threshold,
      thresholdText: threshold.toFixed(4),
      direction: 'below',
      directionText: '低于',
      bufferText: (bufferPct * 100).toFixed(2) + '%',
      note: cardName + ' · ' + focusCode + ' 风险守护线',
      modeLabel: modeMeta.label,
      existingCount: cardRules.length,
      actionText: cardRules.length ? '更新并试跑该卡提醒' : '生成并试跑该卡提醒'
    };
  },

  updateCardRiskSuggestion: function() {
    var suggestion = this.buildCardRiskSuggestion(this.data.cardRiskFocusCode);
    this.setData({ cardRiskSuggestion: suggestion });
  },

  highlightCardAlertRule: function(ruleId) {
    if (!ruleId) return;
    if (this._cardAlertHighlightTimer) clearTimeout(this._cardAlertHighlightTimer);
    this.setData({ highlightedCardAlertId: ruleId });
    this._cardAlertHighlightTimer = setTimeout(() => {
      this.setData({ highlightedCardAlertId: '' });
      this._cardAlertHighlightTimer = null;
    }, 2600);
  },

  persistCardAlertState: function(nextRules, nextHistory, nextLastCheckAt) {
    if (nextRules) app.globalData.alertRules = nextRules;
    if (nextHistory) app.globalData.alertHistory = nextHistory;
    if (typeof nextLastCheckAt === 'string') app.globalData.lastAlertCheckAt = nextLastCheckAt;
    if (app.sync) app.sync();
    this.syncCardAlertRulesFromGlobal();
  },

  runCardAlertCheck: async function(rules, options) {
    var normalizedRules = this.normalizeAlertRules(rules || []);
    if (!normalizedRules.length) return null;
    wx.showLoading({ title: (options && options.loadingText) || '检查提醒中...', mask: true });
    try {
      var res = await wx.cloud.callFunction({
        name: 'alertMonitor',
        data: {
          manual: true,
          alertRules: normalizedRules,
          currentRates: app.globalData.exchangeRates || {}
        }
      });
      var triggers = Array.isArray(res.result && res.result.triggers) ? res.result.triggers : [];
      var historyEntry = res.result && res.result.historyEntry ? res.result.historyEntry : null;
      var existingHistory = Array.isArray(app.globalData.alertHistory) ? app.globalData.alertHistory : [];
      var nextHistory = historyEntry ? [historyEntry].concat(existingHistory).slice(0, 20) : existingHistory;
      this.persistCardAlertState(null, nextHistory, String((res.result && res.result.checkedAt) || (historyEntry && historyEntry.checkedAt) || new Date().toLocaleString()));
      wx.showModal({
        title: triggers.length ? ((options && options.hitTitle) || '命中提醒') : ((options && options.emptyTitle) || '未命中提醒'),
        content: triggers.length
          ? triggers.map(item => item.code + ' 当前 ' + item.current + '，' + (item.direction === 'below' ? '低于' : '高于') + ' ' + item.threshold).join('\n')
          : ((options && options.emptyContent) || '当前汇率均未触发已配置阈值。'),
        showCancel: false
      });
      return res.result || null;
    } catch (error) {
      console.error('runCardAlertCheck failed', error);
      wx.showToast({ title: (options && options.errorText) || '提醒检查失败', icon: 'none' });
      return null;
    } finally {
      wx.hideLoading();
    }
  },

  applyCardRiskSuggestion: async function() {
    var suggestion = this.data.cardRiskSuggestion;
    if (!suggestion) {
      wx.showToast({ title: '暂无可生成的提醒建议', icon: 'none' });
      return;
    }

    var currentRules = this.normalizeAlertRules(app.globalData.alertRules || []);
    var existingIndex = currentRules.findIndex(item => item.sourceCardId === this.data.cardId && item.note === suggestion.note);
    var nextRule = this.normalizeAlertRule({
      id: existingIndex >= 0 ? currentRules[existingIndex].id : ('alert_' + Date.now()),
      code: suggestion.code,
      direction: suggestion.direction,
      threshold: suggestion.threshold,
      note: suggestion.note,
      enabled: true,
      sourceCardId: this.data.cardId
    }, 0);
    if (!nextRule) {
      wx.showToast({ title: '提醒建议生成失败', icon: 'none' });
      return;
    }

    if (existingIndex >= 0) currentRules.splice(existingIndex, 1, nextRule);
    else currentRules.unshift(nextRule);

    var nextRules = currentRules.slice(0, 12);
    this.persistCardAlertState(nextRules);
    this.highlightCardAlertRule(nextRule.id);
    await this.runCardAlertCheck(nextRules.filter(item => item.sourceCardId === this.data.cardId), {
      loadingText: existingIndex >= 0 ? '更新并试跑中...' : '生成并试跑中...',
      hitTitle: '该卡新规则已命中',
      emptyTitle: '该卡新规则已生效',
      emptyContent: '该卡新生成的风险守护线已保存，当前汇率尚未触发。',
      errorText: '规则已保存，但试跑失败'
    });
    wx.showToast({ title: existingIndex >= 0 ? '该卡提醒已更新' : '该卡提醒已生成', icon: 'success' });
  },

  getRateByCode: function(code) {
    var rates = app.globalData.exchangeRates || {};
    var upper = String(code || '').toUpperCase();
    return Number(rates[upper] || rates[upper.toLowerCase()] || (upper === 'CNY' ? 1 : 0)) || 0;
  },

  buildHistoryTotals: function(history, currencies) {
    var rates = app.globalData.exchangeRates || {};
    if (!Array.isArray(history) || history.length === 0) return [];
    return history.slice(-6).map((entry) => {
      var total = 0;
      (currencies || []).forEach((currency) => {
        var code = String(currency.code || '').toLowerCase();
        var upper = code.toUpperCase();
        var amount = Number(entry[code] || 0);
        var rate = Number(rates[upper] || rates[code] || (upper === 'CNY' ? 1 : 0)) || 0;
        total += amount * rate;
      });
      return Number(total.toFixed(2));
    });
  },

  callAiProjection: async function(code) {
    var fnCandidates = ['aiFxMonitor', 'aiOnnxInference'];
    for (var i = 0; i < fnCandidates.length; i += 1) {
      try {
        var res = await wx.cloud.callFunction({
          name: fnCandidates[i],
          data: { symbol: String(code).toUpperCase(), seq_len: 20 }
        });
        if (res.result && res.result.success) {
          return res.result;
        }
      } catch (error) {
        var errText = JSON.stringify(error || {});
        if (!errText.includes('ResourceNotFound.Function') && !errText.includes('未找到指定的Function')) {
          throw error;
        }
      }
    }
    return null;
  },

  loadPortfolioOutlook: async function() {
    var currencyList = this.data.currencyList || [];
    if (!currencyList.length) {
      this.setData({ portfolioOutlook: null });
      return;
    }

    this.setData({ isOutlookLoading: true });
    try {
      var exposures = currencyList.map((item) => {
        var rate = this.getRateByCode(item.code);
        var cnyValue = (Number(item.amount || 0) * rate);
        return Object.assign({}, item, {
          cnyValue: Number(cnyValue.toFixed(2))
        });
      }).sort((a, b) => b.cnyValue - a.cnyValue);

      var topCurrencies = exposures.filter(item => String(item.code || '').toUpperCase() !== 'CNY').slice(0, 3);
      var predictions = [];
      for (var i = 0; i < topCurrencies.length; i += 1) {
        var proj = await this.callAiProjection(topCurrencies[i].code);
        if (proj) {
          predictions.push({
            code: String(topCurrencies[i].code || '').toUpperCase(),
            cnyValue: Number(topCurrencies[i].cnyValue || 0),
            expectedChangePct: Number(proj.expected_change_pct || 0),
            riskLevel: String(proj.risk_level || 'unknown')
          });
        }
      }

      var baseTotal = Number(this.data.totalCny || 0);
      var weightedPct = 0;
      predictions.forEach((item) => {
        if (baseTotal > 0) {
          weightedPct += (item.cnyValue / baseTotal) * item.expectedChangePct;
        }
      });

      var history = this.data.cardInfo.history || [];
      var historyLabels = history.slice(-6).map(item => {
        var date = String(item.date || '');
        return date ? date.slice(5) : '';
      });
      var historyValues = this.buildHistoryTotals(history, currencyList);
      var checkpoints = [1, 3, 5];
      var forecastLabels = checkpoints.map(day => `T+${day}`);
      var forecastValues = checkpoints.map((day, index) => {
        var multiplier = day === 1 ? 0.45 : day === 3 ? 0.8 : 1;
        var projected = baseTotal * (1 + ((weightedPct * multiplier) / 100));
        return Number(projected.toFixed(2));
      });

      this.setData({
        portfolioOutlook: {
          summary: predictions.length
            ? `主敞口预计变动 ${weightedPct >= 0 ? '+' : ''}${weightedPct.toFixed(2)}%，用于观察未来 1 到 5 天的组合敏感度。`
            : '当前持仓中缺少可分析的外币敞口，暂不生成预测曲线。',
          riskText: predictions.some(item => item.riskLevel === 'high') ? '高波动币种存在，建议结合压力测试一起看。' : '主敞口波动风险暂时可控。',
          historyLabels,
          historyValues,
          forecastLabels,
          forecastValues,
          totalNowText: `¥${baseTotal.toFixed(2)}`,
          projectedText: forecastValues.length ? `¥${forecastValues[forecastValues.length - 1].toFixed(2)}` : `¥${baseTotal.toFixed(2)}`,
          drivers: predictions.map(item => `${item.code} ${item.expectedChangePct >= 0 ? '+' : ''}${item.expectedChangePct.toFixed(2)}%`).slice(0, 3)
        }
      });
    } catch (error) {
      console.error('loadPortfolioOutlook failed', error);
      this.setData({ portfolioOutlook: null });
    } finally {
      this.setData({ isOutlookLoading: false });
    }
  },

  refreshPieChart: function() {
    var chartComponent = this.selectComponent('#mychart-dom-pie');
    if (!chartComponent || this.data.currencyList.length === 0) return;

    chartComponent.init((canvas, width, height, dpr) => {
      var chart = initChart(canvas, width, height, dpr);
      var rates = app.globalData.exchangeRates || {};
      var chartData = this.data.currencyList.map(item => {
        var code = item.code.toUpperCase();
        var rate = (code === 'CNY') ? 1 : (rates[code] || 0);
        return {
          name: this.data.currencyMap[item.code] || code,
          value: parseFloat((parseFloat(item.amount) * rate).toFixed(2))
        };
      }).filter(item => item.value > 0);

      chart.setOption({
        color: this.data.pieColors,
        series: [{
          type: 'pie', radius: ['38%', '58%'], center: ['50%', '50%'],
          avoidLabelOverlap: true, minAngle: 15, data: chartData,
          label: { show: true, position: 'outside', formatter: '{b}\n{d}%', fontSize: 10, color: '#5d5d5a' },
          labelLine: { length: 8, length2: 10, smooth: true },
          itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 }
        }]
      });
      return chart;
    });
  },

  formatEventDateLabel: function(value) {
    var text = String(value || '');
    if (!text) return '';
    var matched = text.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if (matched) {
      return String(matched[2]).padStart(2, '0') + '-' + String(matched[3]).padStart(2, '0');
    }
    matched = text.match(/(\d{1,2})[-\/](\d{1,2})/);
    return matched ? String(matched[1]).padStart(2, '0') + '-' + String(matched[2]).padStart(2, '0') : '';
  },

  buildTrendEventLines: function(xAxisData) {
    if (!Array.isArray(xAxisData) || !xAxisData.length) return [];
    var available = new Set(xAxisData);
    var eventMap = {};
    var cardCurrencySet = new Set((this.data.currencyList || []).map(item => String(item.code || '').toUpperCase()));
    var addEvent = function(label, name, color) {
      if (!label || !available.has(label) || eventMap[label]) return;
      eventMap[label] = {
        name: name,
        xAxis: label,
        lineStyle: { color: color, type: 'dashed', width: 1.5 },
        label: { show: true, formatter: name, color: color, fontSize: 10, position: 'insideEndTop' }
      };
    };

    var stressResult = app.globalData.latestStressResult || null;
    if (stressResult && stressResult.timestamp) {
      addEvent(this.formatEventDateLabel(stressResult.timestamp), '压力测试', '#ef4444');
    }

    var alertHistory = Array.isArray(app.globalData.alertHistory) ? app.globalData.alertHistory : [];
    alertHistory.slice(0, 5).forEach((entry) => {
      var triggers = Array.isArray(entry.triggers) ? entry.triggers : [];
      var related = triggers.some(trigger => cardCurrencySet.has(String(trigger.code || '').toUpperCase()));
      if (related) {
        addEvent(this.formatEventDateLabel(entry.checkedAt), '提醒检查', '#2563eb');
      }
    });

    if (xAxisData.length) {
      addEvent(xAxisData[xAxisData.length - 1], '当前', '#0f766e');
    }
    return Object.keys(eventMap).map(key => eventMap[key]);
  },

  refreshTrendChart: function() {
    var chartComponent = this.selectComponent('#trend-chart-dom');
    var history = this.data.cardInfo.history || [];
    if (!chartComponent || history.length < 1) return;

    chartComponent.init((canvas, width, height, dpr) => {
      var chart = echarts.init(canvas, null, { width: width, height: height, devicePixelRatio: dpr });
      canvas.setChart(chart);
      
      var xAxisData = history.map(h => {
        if (!h.date) return '';
        var pts = h.date.split(/[\/\-]/);
        return pts.length < 3 ? h.date : String(pts[1]).padStart(2, '0') + '-' + String(pts[2]).padStart(2, '0');
      });
      var eventLines = this.buildTrendEventLines(xAxisData);

      var currencyCodes = [];
      history.forEach(h => {
        Object.keys(h).forEach(k => {
          if (k !== 'date' && currencyCodes.indexOf(k) === -1) currencyCodes.push(k);
        });
      });

      var series = currencyCodes.map((code, index) => {
        var isCny = code.toLowerCase() === 'cny';
        return {
          name: this.data.currencyMap[code] || code.toUpperCase(),
          type: 'line', smooth: true, showSymbol: true, symbolSize: 6,
          yAxisIndex: isCny ? 0 : 1,
          data: history.map(h => parseFloat(h[code]) || 0),
          itemStyle: { color: isCny ? '#ff9f43' : this.data.trendColors[index % this.data.trendColors.length] },
          lineStyle: { width: isCny ? 3 : 2 },
          markLine: index === 0 && eventLines.length ? {
            symbol: 'none',
            animation: false,
            data: eventLines,
            label: { distance: 6 }
          } : undefined
        };
      });

      var selectedMap = {};
      if (this.data.selectedCurrencyCodes.length > 0) {
        currencyCodes.forEach(code => {
          const name = this.data.currencyMap[code] || code.toUpperCase();
          selectedMap[name] = this.data.selectedCurrencyCodes.includes(code);
        });
      }

      chart.setOption({
        tooltip: { trigger: 'axis', backgroundColor: 'rgba(255, 255, 255, 0.95)', confine: true },
        grid: { top: '15%', left: '5%', right: '5%', bottom: '15%', containLabel: true },
        xAxis: { type: 'category', boundaryGap: false, data: xAxisData, axisLabel: { color: '#999', fontSize: 10 } },
        yAxis: [
          { type: 'value', name: 'CNY', scale: true, axisLabel: { color: '#ff9f43', fontSize: 10 } },
          { type: 'value', name: '外币', scale: true, axisLabel: { color: '#2f54eb', fontSize: 10 }, splitLine: { show: false } }
        ],
        legend: { 
          type: 'scroll', bottom: 20, icon: 'circle', itemWidth: 10, textStyle: { fontSize: 10 },
          selected: selectedMap 
        },
        series: series
      });

      // 【云同步核心】监听图例点击，保存到全局 bankCards 并上传云端
      chart.on('legendselectchanged', (params) => {
        const currentSelectedStatus = params.selected;
        const selectedCodes = [];
        Object.keys(currentSelectedStatus).forEach(name => {
          if (currentSelectedStatus[name]) {
            const code = Object.keys(this.data.currencyMap).find(k => this.data.currencyMap[k] === name) || name.toLowerCase();
            selectedCodes.push(code);
          }
        });

        // 1. 更新页面 Data
        this.setData({ selectedCurrencyCodes: selectedCodes });
        
        // 2. 更新全局 Data 并持久化
        app.globalData.bankCards = app.globalData.bankCards.map(card => {
          if (card.id === this.data.cardId) {
            return Object.assign({}, card, { selectedCodes: selectedCodes }); 
          }
          return card;
        });

        wx.setStorageSync('selected_codes_' + this.data.cardId, selectedCodes);
        
        // 3. 触发 app.js 的同步函数
        if (app.sync) app.sync();
      });

      return chart;
    });
  },

  refreshForecastChart: function() {
    var chartComponent = this.selectComponent('#forecast-chart-dom');
    var outlook = this.data.portfolioOutlook;
    if (!chartComponent || !outlook || !outlook.forecastValues || outlook.forecastValues.length === 0) return;

    chartComponent.init((canvas, width, height, dpr) => {
      var chart = echarts.init(canvas, null, { width: width, height: height, devicePixelRatio: dpr });
      canvas.setChart(chart);

      var labels = (outlook.historyLabels || []).concat(outlook.forecastLabels || []);
      var historySeries = (outlook.historyValues || []).concat(new Array((outlook.forecastValues || []).length).fill('-'));
      var forecastSeries = new Array(Math.max((outlook.historyValues || []).length - 1, 0)).fill('-')
        .concat((outlook.historyValues || []).length ? [outlook.historyValues[outlook.historyValues.length - 1]] : [])
        .concat(outlook.forecastValues || []);

      chart.setOption({
        color: ['#ff9f43', '#2f54eb'],
        tooltip: { trigger: 'axis', confine: true },
        grid: { top: '16%', left: '6%', right: '6%', bottom: '14%', containLabel: true },
        xAxis: { type: 'category', boundaryGap: false, data: labels, axisLabel: { fontSize: 10, color: '#999' } },
        yAxis: { type: 'value', axisLabel: { fontSize: 10, color: '#999' } },
        legend: { bottom: 10, data: ['历史组合估值', '未来敏感度预测'] },
        series: [
          {
            name: '历史组合估值',
            type: 'line',
            smooth: true,
            showSymbol: false,
            data: historySeries,
            lineStyle: { width: 3 }
          },
          {
            name: '未来敏感度预测',
            type: 'line',
            smooth: true,
            showSymbol: true,
            symbolSize: 6,
            data: forecastSeries,
            lineStyle: { type: 'dashed', width: 3 },
            itemStyle: { color: '#2f54eb' }
          }
        ]
      });
      return chart;
    });
  },

  requestBiometricAuth: function(reason) {
    return new Promise((resolve) => {
      if (!wx.checkIsSupportSoterAuthentication || !wx.startSoterAuthentication) {
        resolve(true);
        return;
      }
      wx.checkIsSupportSoterAuthentication({
        success: (supportRes) => {
          var modes = Array.isArray(supportRes.supportMode) ? supportRes.supportMode : [];
          var authMode = modes[0];
          if (!authMode) {
            resolve(true);
            return;
          }
          wx.startSoterAuthentication({
            requestAuthModes: [authMode],
            challenge: 'account-detail-privacy',
            authContent: reason || '验证后显示卡片资产信息',
            success: () => resolve(true),
            fail: () => resolve(false)
          });
        },
        fail: () => resolve(true)
      });
    });
  },

  togglePrivacyMode: async function() {
    var next = !this.data.privacyMode;
    if (!next && this.data.biometricEnabled) {
      var passed = await this.requestBiometricAuth('验证后显示该卡金额');
      if (!passed) {
        wx.showToast({ title: '验证未通过', icon: 'none' });
        return;
      }
    }
    app.globalData.privacyMode = next;
    if (app.sync) app.sync();
    this.syncSecurityStateFromGlobal();
  },

  toggleBiometricEnabled: function() {
    app.globalData.biometricEnabled = !this.data.biometricEnabled;
    if (app.sync) app.sync();
    this.syncSecurityStateFromGlobal();
  },

  _updateAndSync: async function(newBankCards, successMsg) {
    var cardId = this.data.cardId;
    var now = new Date();
    var dateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    
    // 同步时确保 selectedCodes 字段不丢失
    var finalCards = newBankCards.map(card => {
      if (card.id === cardId) {
        var rawHistory = card.history || [];
        var cleanMap = {}; 
        rawHistory.forEach(h => {
          if (!h.date) return;
          var pts = h.date.split(/[\/\-]/);
          var sDate = pts[0] + '-' + String(pts[1]).padStart(2, '0') + '-' + String(pts[2]).padStart(2, '0');
          cleanMap[sDate] = Object.assign({}, h, { date: sDate });
        });
        var snapshot = { date: dateStr };
        card.currencies.forEach(cur => { snapshot[cur.code.toLowerCase()] = parseFloat(cur.amount); });
        cleanMap[dateStr] = snapshot;
        var sortedHistory = Object.keys(cleanMap).sort().map(key => cleanMap[key]);
        if (sortedHistory.length > 25) sortedHistory = sortedHistory.slice(-25);

        return Object.assign({}, card, { 
          history: sortedHistory,
          selectedCodes: this.data.selectedCurrencyCodes // 确保勾选状态跟随同步
        });
      }
      return card;
    });

    app.globalData.bankCards = finalCards;
    this.updateStorage(); // 内部封装
    await this.loadCardAndCalculateTotal();
    this.refreshAllCharts(); 
    if (app.sync) app.sync(); 
    wx.showToast({ title: successMsg, icon: 'success' });
  },

  // 辅助方法：统一更新本地
  updateStorage: function() {
    wx.setStorageSync('bankCards', app.globalData.bankCards);
  },

  hideNameModal: function() { this.setData({ showNameModal: false }); this.refreshAllCharts(); },
  hideEditModal: function() { this.setData({ showModal: false }); this.refreshAllCharts(); },
  hideAddModal: function() { this.setData({ showAddModal: false }); this.refreshAllCharts(); },

  showEditNameModal: function() { this.setData({ showNameModal: true, tempCardName: this.data.cardInfo.name || '' }); },
  bindNameInput: function(e) { this.setData({ tempCardName: e.detail.value }); },
  saveCardName: async function() {
    var tempCardName = this.data.tempCardName;
    if (!tempCardName.trim()) return;
    var newBankCards = (app.globalData.bankCards || []).map(card => {
      return card.id === this.data.cardId ? Object.assign({}, card, { name: tempCardName.trim() }) : card;
    });
    this.hideNameModal();
    await this._updateAndSync(newBankCards, '名称已更新');
  },

  showEditModal: function(e) {
    var ds = e.currentTarget.dataset;
    this.setData({ showModal: true, currentEditCode: ds.code, currentCurName: this.data.currencyMap[ds.code] || ds.code, newAmount: ds.amount });
  },
  bindNewAmount: function(e) { this.setData({ newAmount: e.detail.value }); },
  saveBalance: async function() {
    var currentEditCode = this.data.currentEditCode;
    var newAmount = this.data.newAmount;
    if (!/^\d+(\.\d{1,2})?$/.test(newAmount)) return;
    var formatAmount = parseFloat(newAmount).toFixed(2);
    var newBankCards = (app.globalData.bankCards || []).map(card => {
      if (card.id === this.data.cardId) {
        var newCurs = card.currencies.map(cur => {
          return cur.code === currentEditCode ? Object.assign({}, cur, { amount: formatAmount }) : cur;
        });
        return Object.assign({}, card, { currencies: newCurs });
      }
      return card;
    });
    this.hideEditModal();
    await this._updateAndSync(newBankCards, '修改成功');
  },

  showAddCurrencyModal: function() { this.setData({ showAddModal: true, selectedAddCode: '', addAmount: '' }); },
  selectAddCurrency: function(e) { 
    var ds = e.currentTarget.dataset;
    this.setData({ selectedAddCode: ds.code, selectedAddName: ds.name }); 
  },
  bindAddAmount: function(e) { this.setData({ addAmount: e.detail.value }); },
  saveAddCurrency: async function() {
    var selectedAddCode = this.data.selectedAddCode;
    var addAmount = this.data.addAmount;
    if (!selectedAddCode || !addAmount) return;
    var newAddAmount = parseFloat(addAmount).toFixed(2);
    var newBankCards = (app.globalData.bankCards || []).map(card => {
      if (card.id === this.data.cardId) {
        var currencies = (card.currencies || []).slice();
        var idx = currencies.findIndex(c => c.code === selectedAddCode);
        if (idx > -1) {
          currencies[idx].amount = (parseFloat(currencies[idx].amount) + parseFloat(newAddAmount)).toFixed(2);
        } else {
          currencies.push({ code: selectedAddCode, amount: newAddAmount });
        }
        return Object.assign({}, card, { currencies: currencies });
      }
      return card;
    });
    this.hideAddModal();
    await this._updateAndSync(newBankCards, '添加成功');
  },

  deleteCurrency: function(e) {
    var code = e.currentTarget.dataset.code;
    wx.showModal({
      title: '提示', content: '确定删除该币种账户吗？',
      success: (res) => {
        if (res.confirm) {
          var newBankCards = (app.globalData.bankCards || []).map(card => {
            if (card.id === this.data.cardId) {
              var filtered = card.currencies.filter(item => item.code !== code);
              return Object.assign({}, card, { currencies: filtered });
            }
            return card;
          });
          this._updateAndSync(newBankCards, '删除成功');
        }
      }
    });
  },

  touchStart: function(e) { 
    var idx = e.currentTarget.dataset.index;
    this.setData({ 
      startX: e.touches[0].clientX, delIndex: idx, 
      currencyList: this.data.currencyList.map(i => Object.assign({}, i, { delShow: false })) 
    }); 
  },
  touchMove: function(e) { 
    var moveX = e.touches[0].clientX; 
    if (this.data.startX - moveX > 40 && this.data.delIndex !== -1) { 
      var list = this.data.currencyList.slice(); 
      list[this.data.delIndex].delShow = true; 
      this.setData({ currencyList: list }); 
    } 
  },
  touchEnd: function() {},
  stopPropagation: function() {}
});