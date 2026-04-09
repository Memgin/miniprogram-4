import * as echarts from '../../components/ec-canvas/echarts';

const app = getApp();
const exchangeRateUtil = require('../../utils/exchangeRate.js');

const GOAL_RISK_OPTIONS = [
  { value: 'steady', label: '稳健' },
  { value: 'balanced', label: '平衡' },
  { value: 'growth', label: '进取' }
];

function createGoalBucketId() {
  return `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function addMonths(date, months) {
  const next = new Date(date.getTime());
  next.setMonth(next.getMonth() + months);
  return next;
}

function formatDateInput(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatBeijingDateTime(input) {
  if (input === undefined || input === null || input === '') {
    return '';
  }

  let date = null;
  if (input instanceof Date) {
    date = input;
  } else if (typeof input === 'number' && Number.isFinite(input)) {
    const ts = input < 1e12 ? input * 1000 : input;
    date = new Date(ts);
  } else if (typeof input === 'string') {
    const text = input.trim();
    if (!text) {
      return '';
    }
    if (/^\d+$/.test(text)) {
      const num = Number(text);
      const ts = num < 1e12 ? num * 1000 : num;
      date = new Date(ts);
    } else {
      date = new Date(text);
    }
  }

  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return String(input);
  }

  if (typeof Intl !== 'undefined' && Intl && typeof Intl.DateTimeFormat === 'function') {
    try {
      const parts = new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).formatToParts(date);

      const getPart = (type) => {
        const found = parts.find((part) => part.type === type);
        return found ? found.value : '';
      };

      return `${getPart('year')}-${getPart('month')}-${getPart('day')} ${getPart('hour')}:${getPart('minute')}:${getPart('second')} 北京时间`;
    } catch (e) {
      // fall through to manual formatter
    }
  }

  const pad2 = (num) => String(num).padStart(2, '0');
  const utcMillis = date.getTime() + date.getTimezoneOffset() * 60 * 1000;
  const beijing = new Date(utcMillis + 8 * 60 * 60 * 1000);
  const year = beijing.getUTCFullYear();
  const month = pad2(beijing.getUTCMonth() + 1);
  const day = pad2(beijing.getUTCDate());
  const hour = pad2(beijing.getUTCHours());
  const minute = pad2(beijing.getUTCMinutes());
  const second = pad2(beijing.getUTCSeconds());
  return `${year}-${month}-${day} ${hour}:${minute}:${second} 北京时间`;
}

function normalizeGoalBucket(goal, index = 0) {
  const targetAmount = Number(goal && goal.targetAmount);
  const preferredCodes = Array.isArray(goal && goal.preferredCodes)
    ? goal.preferredCodes.map(code => String(code || '').toUpperCase()).filter(Boolean)
    : [];
  return {
    id: String((goal && goal.id) || createGoalBucketId()),
    name: String((goal && goal.name) || `目标${index + 1}`),
    targetAmount: targetAmount > 0 ? Number(targetAmount.toFixed(2)) : 0,
    targetDate: String((goal && goal.targetDate) || formatDateInput(addMonths(new Date(), 12))),
    riskLevel: String((goal && goal.riskLevel) || 'balanced'),
    preferredCodes: Array.from(new Set(preferredCodes)).slice(0, 4)
  };
}

function deriveGoalBuckets(goalBuckets, depositTarget) {
  const normalized = (Array.isArray(goalBuckets) ? goalBuckets : [])
    .map((goal, index) => normalizeGoalBucket(goal, index))
    .filter(goal => goal.targetAmount > 0);
  if (normalized.length) return normalized;
  const legacyAmount = Number(depositTarget || 0);
  if (!(legacyAmount > 0)) return [];
  return [normalizeGoalBucket({
    id: 'legacy_goal_bucket',
    name: '综合储备目标',
    targetAmount: legacyAmount,
    targetDate: formatDateInput(addMonths(new Date(), 12)),
    riskLevel: 'balanced',
    preferredCodes: ['CNY', 'USD']
  })];
}

function sortGoalBuckets(goalBuckets) {
  return [...goalBuckets].sort((left, right) => {
    const leftTime = left.targetDate ? new Date(left.targetDate).getTime() : Number.MAX_SAFE_INTEGER;
    const rightTime = right.targetDate ? new Date(right.targetDate).getTime() : Number.MAX_SAFE_INTEGER;
    if (leftTime !== rightTime) return leftTime - rightTime;
    return String(left.name || '').localeCompare(String(right.name || ''));
  });
}

function initChart(canvas, width, height, dpr) {
  const chart = echarts.init(canvas, null, {
    width,
    height,
    devicePixelRatio: dpr
  });
  canvas.setChart(chart);
  return chart;
}

Page({
  data: {
    bankCards: [],
    rates: {},
    ratesLoaded: false,
    rateList: [],
    selectedRateList: [],
    currencySummary: [],
    navTitle: '资产总览',
    navStatusHeight: 20,
    navContentHeight: 44,
    navTotalHeight: 64,
    navCapsuleSpace: 96,
    totalCny: '0.00',
    updateTime: '',
    depositTarget: '',
    goalBuckets: [],
    goalOverview: null,
    showGoalEditor: false,
    editingGoalId: '',
    goalEditorName: '',
    goalEditorAmount: '',
    goalEditorDate: formatDateInput(addMonths(new Date(), 12)),
    goalEditorRiskIndex: 1,
    goalEditorSelectedCodes: [],
    goalRiskOptions: GOAL_RISK_OPTIONS,
    goalCurrencyOptions: [],
    moveDiff: 0,
    isLoading: false,
    isAnalyzing: false,
    isAdvancedLoading: false,
    ecRiskTrend: { lazyLoad: true },
    ecRiskContribution: { lazyLoad: true },
    riskWindowOptions: [7, 14, 30],
    selectedRiskWindow: 14,
    selectedRiskFocusCode: '',
    riskFocusSuggestion: null,
    riskSuggestionModes: [
      { key: 'guarded', label: '保守' },
      { key: 'standard', label: '标准' },
      { key: 'aggressive', label: '激进' }
    ],
    selectedRiskSuggestionMode: 'standard',
    highlightedAlertRuleId: '',
    stressResult: null,
    savedStressScenarios: [],
    alertRules: [],
    alertHistory: [],
    lastAlertCheckAt: '',
    latestRiskSummary: null,
    latestAdvice: null,
    aiCapabilityPanel: null,
    lastAIMonitorAt: '',
    lastAIMonitorCode: '',
    privacyMode: false,
    biometricEnabled: false,
    showAlertEditor: false,
    editingAlertRuleId: '',
    alertEditorCodeIndex: 0,
    alertEditorDirectionIndex: 0,
    alertEditorThreshold: '',
    alertEditorNote: '',
    alertCurrencyOptions: [],
    alertDirectionLabels: ['高于阈值', '低于阈值'],
    showStressEditor: false,
    editingStressScenarioKey: '',
    stressEditorName: '',
    stressEditorRows: [],
    stressCurrencyOptions: [],
    // UI配置映射
    currencyConfig: {
      cny: { name: '人民币', symbol: 'CNY' },
      usd: { name: '美元', symbol: 'USD' },
      hkd: { name: '港币', symbol: 'HKD' },
      eur: { name: '欧元', symbol: 'EUR' },
      jpy: { name: '日元', symbol: 'JPY' },
      gbp: { name: '英镑', symbol: 'GBP' },
      cad: { name: '加拿大元', symbol: 'CAD' },
      aud: { name: '澳大利亚元', symbol: 'AUD' },
      nzd: { name: '新西兰元', symbol: 'NZD' },
      chf: { name: '瑞士法郎', symbol: 'CHF' },
      sgd: { name: '新加坡元', symbol: 'SGD' },
      thb: { name: '泰铢', symbol: 'THB' },
      myr: { name: '林吉特', symbol: 'RM' },
      krw: { name: '韩元', symbol: 'KRW' }
    },
    // 币种名称映射表，用于 WXML 快速显示
    currencyMap: {
      'cny': 'CNY', 'usd': 'USD', 'hkd': 'HKD', 'eur': 'EUR', 'jpy': 'JPY',
      'gbp': 'GBP', 'cad': 'CAD', 'aud': 'AUD', 'nzd': 'NZD', 'chf': 'CHF',
      'sgd': 'SGD', 'thb': 'THB', 'myr': 'MYR', 'rm': 'MYR', 'krw': 'KRW'
    }
  },

  startX: 0,

  onLoad() {
    this.initCustomNavBar();
    this.setData({
      goalCurrencyOptions: this.buildGoalCurrencyOptions(),
      stressCurrencyOptions: this.buildStressCurrencyOptions(),
      alertCurrencyOptions: this.getAlertCurrencyOptions(),
      stressEditorRows: [this.createStressEditorRow()]
    });
    app.dataReadyCallback = () => {
      this.loadAllData();
    };
    this.syncStressStateFromGlobal();
  },

  onUnload() {
    if (app.dataReadyCallback) {
      app.dataReadyCallback = null;
    }
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

  syncCustomTabBar() {
    if (!this.getTabBar) return;
    const tabBar = this.getTabBar();
    if (!tabBar || !tabBar.setData) return;
    tabBar.setData({
      selected: 0,
      visualSelected: 0,
      pressedIndex: -1,
      slideHoverIndex: -1,
      isTracking: false,
      highlightX: 50,
      highlightY: 16
    });
  },

  onShow() {
    this.syncCustomTabBar();
    this.closeAllDelete();
    this.syncStressStateFromGlobal();
    this.hydrateBankCardsFromCache();
    this.loadAllData();
  },

  hydrateBankCardsFromCache() {
    let bankCards = [...(app.globalData.bankCards || [])];
    if (!bankCards.length) {
      bankCards = wx.getStorageSync('bankCards') || [];
    }
    const normalized = this.normalizeBankCards(bankCards);
    this.setData({ bankCards: normalized });
  },

  normalizeBankCards(bankCards) {
    if (!Array.isArray(bankCards)) return [];
    return bankCards.map((card) => {
      const currencies = Array.isArray(card && card.currencies) ? card.currencies : [];
      return {
        ...(card || {}),
        currencies
      };
    });
  },

  /**
   * 1. 下拉刷新
   */
  async onPullDownRefresh() {
    wx.showLoading({ title: '全量同步中...', mask: true });
    try {
      app.globalData.exchangeRates = {};
      await app.init(); 
      await this.loadAllData();
      wx.showToast({ title: '同步成功', icon: 'success' });
    } catch (err) {
      console.error('刷新失败:', err);
      wx.showToast({ title: '刷新延迟', icon: 'none' });
    } finally {
      wx.stopPullDownRefresh();
      wx.hideLoading();
    }
  },

  /**
   * 2. 核心加载逻辑
   */
  async loadAllData() {
    if (this.data.isLoading) return;
    this.setData({ isLoading: true });
    wx.showLoading({ title: '加载中...' });

    let bankCards = [...(app.globalData.bankCards || [])];
    if (bankCards.length === 0) {
      bankCards = wx.getStorageSync('bankCards') || [];
    }
    bankCards = this.normalizeBankCards(bankCards);

    try {
      const rates = await exchangeRateUtil.getSinaRealTimeRates();
      app.globalData.exchangeRates = rates;
      wx.setStorageSync('exchangeRates', rates);

      const summaryResult = this.calculateSummary(rates, bankCards);
      const selectedRateList = this.getSelectedRateList(rates);

      const formattedCards = bankCards.map(card => {
        let cardTotal = 0;
        (card.currencies || []).forEach(cur => {
          const amt = parseFloat(cur.amount) || 0;
          const code = (cur.code || '').toUpperCase();
          const rate = rates[code] || rates[code.toLowerCase()] || (code === 'RM' ? (rates['MYR'] || rates['myr']) : 1);
          cardTotal += amt * rate;
        });
        return { ...card, totalCny: cardTotal.toFixed(2), showDelete: false };
      });

      this.setData({
        rates,
        bankCards: formattedCards,
        rateList: summaryResult.rateList,
        currencySummary: summaryResult.currencySummary,
        totalCny: summaryResult.totalCny.toFixed(2),
        ratesLoaded: true,
        selectedRateList,
        updateTime: formatBeijingDateTime(rates.updateTime)
      }, () => {
        this.refreshAICapabilityPanel();
      });

      this.calculateTargetProgress();
      await this.loadAdvancedInsights(rates, formattedCards);
    } catch (err) {
      console.error('loadAllData Error:', err);
      const fallbackRates = wx.getStorageSync('exchangeRates') || app.globalData.exchangeRates || { CNY: 1, cny: 1 };
      const summaryResult = this.calculateSummary(fallbackRates, bankCards);
      const selectedRateList = this.getSelectedRateList(fallbackRates);

      const formattedCards = bankCards.map(card => {
        let cardTotal = 0;
        (card.currencies || []).forEach(cur => {
          const amt = parseFloat(cur.amount) || 0;
          const code = (cur.code || '').toUpperCase();
          const rate = fallbackRates[code] || fallbackRates[code.toLowerCase()] || (code === 'RM' ? (fallbackRates['MYR'] || fallbackRates['myr']) : 1);
          cardTotal += amt * rate;
        });
        return { ...card, totalCny: cardTotal.toFixed(2), showDelete: false };
      });

      this.setData({
        rates: fallbackRates,
        bankCards: formattedCards,
        rateList: summaryResult.rateList,
        currencySummary: summaryResult.currencySummary,
        totalCny: summaryResult.totalCny.toFixed(2),
        ratesLoaded: true,
        selectedRateList,
        updateTime: fallbackRates.updateTime ? formatBeijingDateTime(fallbackRates.updateTime) : '使用缓存汇率'
      }, () => {
        this.refreshAICapabilityPanel();
      });

      this.calculateTargetProgress();
      wx.showToast({ title: '实时汇率暂不可用', icon: 'none' });
    } finally {
      this.setData({ isLoading: false });
      wx.hideLoading();
    }
  },

  /**
   * 3. 汇总计算逻辑
   */
  calculateSummary(rates, bankCards) {
    const { currencyConfig } = this.data;
    
    const rateList = Object.keys(currencyConfig).map(code => {
      const upper = code.toUpperCase();
      const val = rates[upper] || rates[code] || (upper === 'RM' ? (rates['MYR'] || rates['myr']) : 0);
      return {
        code, 
        name: currencyConfig[code].name, 
        rate: parseFloat(val || 0).toFixed(4)
      };
    });

    const totalByCode = {};
    bankCards.forEach(card => {
      (card.currencies || []).forEach(cur => {
        const amt = parseFloat(cur.amount) || 0;
        if (amt === 0) return;
        const c = String(cur.code || '').toLowerCase();
        if (!c) return;
        totalByCode[c] = (totalByCode[c] || 0) + amt;
      });
    });

    const currencySummary = [];
    let totalCny = 0;
    Object.keys(totalByCode).forEach(code => {
      const totalAmt = totalByCode[code];
      const upper = code.toUpperCase();
      const rate = rates[upper] || rates[code] || (upper === 'RM' ? (rates['MYR'] || rates['myr']) : 1);
      const cny = totalAmt * rate;
      totalCny += cny;
      currencySummary.push({
        code,
        name: currencyConfig[code] ? currencyConfig[code].name : code,
        symbol: currencyConfig[code] ? currencyConfig[code].symbol : code,
        totalAmount: totalAmt.toFixed(2),
        cnyAmount: cny.toFixed(2)
      });
    });

    return { rateList, currencySummary, totalCny };
  },

  /**
   * 4. 获取首页展示汇率 (已修改默认值为 USD, HKD)
   */
  getSelectedRateList(rates) {
    const { currencyConfig } = this.data;
    // 获取缓存，如果没有缓存则使用默认的 ['usd', 'hkd']
    let codes = wx.getStorageSync('selectedRateCodes');
    
    if (!codes || codes.length === 0) {
      codes = ['usd', 'hkd'];
    }
    
    const uniqueCodes = [...new Set(codes.map(c => c.toLowerCase()))];
    
    return uniqueCodes
      .filter(code => currencyConfig[code])
      .map(code => {
        const upper = code.toUpperCase();
        const rateVal = rates[upper] || rates[code] || (upper === 'RM' ? (rates['MYR'] || rates['myr']) : 1);
        return {
          code,
          upperCode: upper,
          name: currencyConfig[code].name,
          rate: parseFloat(rateVal).toFixed(4)
        };
      });
  },

  async runAIMonitor(e) {
    if (this.data.isAnalyzing) return;
    const { code } = e.currentTarget.dataset;
    if (!code) return;

    this.setData({ isAnalyzing: true });
    wx.showLoading({ title: 'AI 分析中...', mask: true });

    try {
      const fnCandidates = ['aiFxMonitor'];
      let inferRes = null;
      let lastErr = null;

      for (const fnName of fnCandidates) {
        try {
          const currentRes = await wx.cloud.callFunction({
            name: fnName,
            data: { symbol: String(code).toUpperCase(), seq_len: 20 }
          });
          if (currentRes.result?.success) {
            inferRes = currentRes;
            break;
          }
          lastErr = new Error(currentRes.result?.msg || '预测失败');
        } catch (err) {
          lastErr = err;
          const errText = JSON.stringify(err || {});
          const notFound = errText.includes('ResourceNotFound.Function') || errText.includes('未找到指定的Function');
          if (!notFound) throw err;
        }
      }

      if (!inferRes) {
        throw lastErr || new Error('未部署 AI 监测云函数');
      }

      if (inferRes.result?.success) {
        const r = inferRes.result;
        const expectedPct = Number(r.expected_change_pct || 0);
        const direction = expectedPct >= 0 ? '上涨' : '下跌';
        const riskMap = { low: '低', medium: '中', high: '高' };
        const riskLabel = riskMap[r.risk_level] || '未知';
        const sourceMap = {
          history_api: '历史数据',
          spot_api: '实时数据'
        };
        const sourceLabel = sourceMap[r.data_source] || '未知';
        this.setData({
          lastAIMonitorAt: new Date().toLocaleString('zh-CN', { hour12: false }),
          lastAIMonitorCode: String(code).toUpperCase()
        }, () => {
          this.refreshAICapabilityPanel();
        });

        wx.showModal({
          title: `AI监测: ${String(code).toUpperCase()}/CNY`,
          content:
            `当前价：${Number(r.current || 0).toFixed(4)}\n` +
            `预测下一价：${Number(r.pred || 0).toFixed(4)}\n` +
            `预期变动：${direction} ${Math.abs(expectedPct).toFixed(2)}%\n` +
            `波动率(年化)：${(Number(r.volatility || 0) * 100).toFixed(2)}%\n` +
            `风险等级：${riskLabel}\n` +
            `信号：${r.signal || 'unknown'}\n` +
            `数据来源：${sourceLabel}\n` +
            `模型：${r.method || 'unknown'}`,
          showCancel: false,
          confirmColor: '#07C160'
        });
      } else {
        wx.showToast({ title: inferRes.result?.msg || '预测失败', icon: 'none' });
      }
    } catch (err) {
      console.error('首页AI监测失败：', err);
      const errText = JSON.stringify(err || {});
      if (errText.includes('ResourceNotFound.Function') || errText.includes('未找到指定的Function')) {
        wx.showToast({ title: 'AI函数未部署到当前云环境', icon: 'none' });
      } else {
        wx.showToast({ title: '数据源暂不可用', icon: 'none' });
      }
    } finally {
      this.setData({ isAnalyzing: false });
      wx.hideLoading();
    }
  },

  /**
   * 5. 存款目标与进度
   */
  calculateTargetProgress() {
    const total = parseFloat(this.data.totalCny) || 0;
    const goalBuckets = deriveGoalBuckets(app.globalData.goalBuckets, app.globalData.depositTarget);
    const totalTarget = goalBuckets.reduce((sum, goal) => sum + Number(goal.targetAmount || 0), 0);

    if (!goalBuckets.length || totalTarget <= 0) {
      this.setData({
        depositTarget: '',
        goalBuckets: [],
        goalOverview: null
      });
      return;
    }

    const riskWeightMap = { steady: 1.18, balanced: 1, growth: 0.88 };
    const currencyHoldings = (this.data.currencySummary || []).reduce((acc, item) => {
      acc[String(item.code || '').toUpperCase()] = Number(item.cny || 0);
      return acc;
    }, {});
    const rawScores = goalBuckets.map((goal) => {
      const daysLeft = goal.targetDate
        ? Math.max(1, Math.ceil((new Date(goal.targetDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
        : 365;
      const urgencyWeight = daysLeft <= 90 ? 1.35 : daysLeft <= 180 ? 1.18 : daysLeft <= 365 ? 1.05 : 0.92;
      const preferredCoverage = (goal.preferredCodes || []).reduce((sum, code) => sum + Number(currencyHoldings[code] || 0), 0);
      const coverageBoost = preferredCoverage > 0 ? 1.08 : 0.96;
      const score = Number(goal.targetAmount || 0) * urgencyWeight * (riskWeightMap[goal.riskLevel] || 1) * coverageBoost;
      return score > 0 ? score : Number(goal.targetAmount || 0);
    });

    const allocations = new Array(goalBuckets.length).fill(0);
    let remaining = total;
    let activeIndexes = goalBuckets.map((_, index) => index);

    while (remaining > 0.01 && activeIndexes.length) {
      const scoreSum = activeIndexes.reduce((sum, index) => sum + rawScores[index], 0) || activeIndexes.length;
      const nextActive = [];
      activeIndexes.forEach((index) => {
        const goal = goalBuckets[index];
        const capacity = Number(goal.targetAmount || 0) - allocations[index];
        if (capacity <= 0.01) return;
        const share = remaining * ((rawScores[index] || 1) / scoreSum);
        const applied = Math.min(capacity, share);
        if (applied > 0) {
          allocations[index] += applied;
          remaining -= applied;
        }
        if ((Number(goal.targetAmount || 0) - allocations[index]) > 0.01) {
          nextActive.push(index);
        }
      });
      if (nextActive.length === activeIndexes.length) break;
      activeIndexes = nextActive;
    }

    if (remaining > 0.01 && goalBuckets.length) {
      const leadIndex = rawScores.indexOf(Math.max(...rawScores));
      allocations[Math.max(0, leadIndex)] += remaining;
    }

    const decoratedGoals = sortGoalBuckets(goalBuckets.map((goal, index) => {
      const allocatedAmount = Number((allocations[index] || 0).toFixed(2));
      const progress = goal.targetAmount > 0 ? (allocatedAmount / goal.targetAmount) * 100 : 0;
      const safeProgress = Math.max(0, Math.min(progress, 100));
      const diff = Number((goal.targetAmount - allocatedAmount).toFixed(2));
      const daysLeft = goal.targetDate
        ? Math.ceil((new Date(goal.targetDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
        : null;
      const monthlyNeed = diff > 0 && daysLeft && daysLeft > 0 ? diff / Math.max(1, daysLeft / 30) : 0;
      const preferredText = goal.preferredCodes && goal.preferredCodes.length ? goal.preferredCodes.join(' / ') : '未限定币种';
      const riskMeta = GOAL_RISK_OPTIONS.find(item => item.value === goal.riskLevel) || GOAL_RISK_OPTIONS[1];
      return {
        ...goal,
        targetAmountText: goal.targetAmount.toFixed(2),
        allocatedAmount,
        allocatedAmountText: allocatedAmount.toFixed(2),
        progressText: progress.toFixed(1),
        safeProgress,
        progressStyle: `width: ${safeProgress}%;`,
        diff,
        diffText: Math.abs(diff).toFixed(2),
        monthlyNeedText: monthlyNeed > 0 ? monthlyNeed.toFixed(2) : '0.00',
        preferredText,
        riskLabel: riskMeta.label,
        daysLeft,
        deadlineText: daysLeft == null ? '未设置日期' : daysLeft < 0 ? `已逾期 ${Math.abs(daysLeft)} 天` : daysLeft === 0 ? '今天到期' : `${daysLeft} 天后`,
        tone: diff <= 0 ? 'done' : daysLeft != null && daysLeft < 0 ? 'late' : safeProgress >= 65 ? 'near' : 'active'
      };
    }));

    const completedCount = decoratedGoals.filter(item => Number(item.diff) <= 0).length;
    const coveredAmount = decoratedGoals.reduce((sum, goal) => {
      return sum + Math.min(Number(goal.allocatedAmount || 0), Number(goal.targetAmount || 0));
    }, 0);
    const completionPct = totalTarget > 0 ? (coveredAmount / totalTarget) * 100 : 0;
    const nextDueGoal = decoratedGoals.find(item => Number(item.diff) > 0) || decoratedGoals[0];

    this.setData({
      depositTarget: totalTarget.toFixed(2),
      goalBuckets: decoratedGoals,
      goalOverview: {
        totalTarget: totalTarget.toFixed(2),
        coveredAmount: coveredAmount.toFixed(2),
        totalSurplus: Math.max(0, total - totalTarget).toFixed(2),
        completionText: completionPct.toFixed(1),
        completedCount,
        totalCount: decoratedGoals.length,
        nextDueName: nextDueGoal ? nextDueGoal.name : '未设置',
        nextDueHint: nextDueGoal ? `${nextDueGoal.deadlineText}，月度缺口 ¥${nextDueGoal.monthlyNeedText}` : '新增目标后可自动拆解优先级',
        strategyText: decoratedGoals.length > 1
          ? `当前资产按期限、风险和币种偏好拆分到 ${decoratedGoals.length} 个目标桶。`
          : '当前为单目标模式，新增更多目标后会自动生成分层进度。'
      }
    });
  },

  getRateByCode(rates, code) {
    const upper = String(code || '').toUpperCase();
    const lower = upper.toLowerCase();
    return Number(
      rates[upper] ||
      rates[lower] ||
      (upper === 'RM' ? (rates['MYR'] || rates['myr']) : 0)
    ) || 0;
  },

  buildStressCurrencyOptions() {
    const options = Object.keys(this.data.currencyConfig || {}).map(code => ({
      code: String(code).toUpperCase(),
      name: `${String(code).toUpperCase()} · ${this.data.currencyConfig[code].name}`
    }));
    options.unshift({ code: 'ALL', name: 'ALL · 全部币种' });
    return options;
  },

  buildGoalCurrencyOptions(selectedCodes = []) {
    const selectedSet = new Set((selectedCodes || []).map(code => String(code || '').toUpperCase()));
    return Object.keys(this.data.currencyConfig || {}).map(code => {
      const upperCode = String(code || '').toUpperCase();
      return {
        code: upperCode,
        name: this.data.currencyConfig[code].name,
        selected: selectedSet.has(upperCode)
      };
    });
  },

  createStressEditorRow(code = 'USD', pct = '') {
    const options = this.buildStressCurrencyOptions();
    let optionIndex = options.findIndex(item => item.code === String(code || '').toUpperCase());
    if (optionIndex < 0) optionIndex = 0;
    return {
      id: `stress_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      code: options[optionIndex].code,
      pct: pct === '' ? '' : String(pct),
      optionIndex
    };
  },

  normalizeStressScenario(scenario, fallbackIndex = 0) {
    if (!scenario || typeof scenario !== 'object') return null;
    const rawShocks = scenario.shocks && typeof scenario.shocks === 'object' ? scenario.shocks : {};
    const shocks = {};

    Object.keys(rawShocks).forEach(code => {
      const normalizedCode = String(code || '').trim().toUpperCase();
      const pct = Number(rawShocks[code]);
      if (!normalizedCode || !Number.isFinite(pct)) return;
      shocks[normalizedCode] = pct;
    });

    if (!Object.keys(shocks).length) return null;

    return {
      key: String(scenario.key || `stress_${fallbackIndex + 1}`),
      name: String(scenario.name || `场景${fallbackIndex + 1}`),
      shocks
    };
  },

  normalizeSavedStressScenarios(list) {
    if (!Array.isArray(list)) return [];
    return list
      .map((item, index) => {
        const normalized = this.normalizeStressScenario(item, index);
        if (!normalized) return null;
        return {
          ...normalized,
          shockSummary: this.buildShockSummary(normalized.shocks)
        };
      })
      .filter(Boolean);
  },

  buildShockSummary(shocks) {
    return Object.keys(shocks || {})
      .map(code => `${code} ${Number(shocks[code]) >= 0 ? '+' : ''}${Number(shocks[code]).toFixed(2)}%`)
      .join(' | ');
  },

  normalizeStressResult(result) {
    if (!result || typeof result !== 'object') return null;
    const deltaTotal = Number(result.deltaTotal || 0);
    const pnlPct = Number(result.pnlPct || 0);
    const baseTotal = Number(result.baseTotal || 0);
    const stressedTotal = Number(result.stressedTotal || 0);
    const topImpacts = Array.isArray(result.topImpacts) ? result.topImpacts : [];
    const shocks = Array.isArray(result.shocks) ? result.shocks : [];

    return {
      scenarioKey: String(result.scenarioKey || ''),
      scenarioName: String(result.scenarioName || '未命名场景'),
      timestamp: String(result.timestamp || ''),
      baseTotal,
      stressedTotal,
      deltaTotal,
      pnlPct,
      resultTone: deltaTotal > 0 ? 'up' : deltaTotal < 0 ? 'down' : 'flat',
      baseTotalText: `¥${baseTotal.toFixed(2)}`,
      stressedTotalText: `¥${stressedTotal.toFixed(2)}`,
      deltaText: `${deltaTotal >= 0 ? '+' : ''}¥${deltaTotal.toFixed(2)}`,
      pnlText: `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%`,
      shockSummary: String(result.shockSummary || this.buildShockSummary(
        shocks.reduce((acc, item) => {
          if (!item || !item.code) return acc;
          acc[String(item.code).toUpperCase()] = Number(item.pct || 0);
          return acc;
        }, {})
      )),
      shocks: shocks.map(item => ({
        code: String(item.code || '').toUpperCase(),
        pct: Number(item.pct || 0),
        pctText: `${Number(item.pct || 0) >= 0 ? '+' : ''}${Number(item.pct || 0).toFixed(2)}%`
      })),
      topImpacts: topImpacts.map(item => {
        const delta = Number(item.delta || 0);
        return {
          code: String(item.code || '').toUpperCase(),
          delta,
          tone: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
          deltaText: `${delta >= 0 ? '+' : ''}¥${delta.toFixed(2)}`
        };
      })
    };
  },

  normalizeAlertRule(rule, fallbackIndex = 0) {
    if (!rule || typeof rule !== 'object') return null;
    const code = String(rule.code || '').trim().toUpperCase();
    const threshold = Number(rule.threshold || 0);
    if (!code || !Number.isFinite(threshold) || threshold <= 0) return null;
    const direction = String(rule.direction || 'above') === 'below' ? 'below' : 'above';
    return {
      id: String(rule.id || `alert_${fallbackIndex + 1}`),
      code,
      threshold,
      thresholdText: threshold.toFixed(4),
      direction,
      directionText: direction === 'below' ? '低于' : '高于',
      note: String(rule.note || `${code} ${direction === 'below' ? '跌破' : '升破'} ${threshold.toFixed(4)}`),
      enabled: rule.enabled !== false
    };
  },

  normalizeAlertRules(list) {
    if (!Array.isArray(list)) return [];
    return list.map((item, index) => this.normalizeAlertRule(item, index)).filter(Boolean);
  },

  normalizeAlertHistory(list) {
    if (!Array.isArray(list)) return [];
    return list
      .map((item, index) => {
        if (!item || typeof item !== 'object') return null;
        const triggers = Array.isArray(item.triggers) ? item.triggers : [];
        return {
          id: String(item.id || `alert_history_${index + 1}`),
          checkedAt: String(item.checkedAt || ''),
          source: String(item.source || 'manual'),
          sourceText: String(item.source || 'manual') === 'scheduled' ? '云端巡检' : '手动检查',
          matchedCount: Number(item.matchedCount || triggers.length || 0),
          summary: String(item.summary || (triggers.length ? '命中提醒' : '未命中提醒')),
          triggers: triggers.slice(0, 5).map(trigger => ({
            code: String(trigger.code || '').toUpperCase(),
            current: Number(trigger.current || 0),
            threshold: Number(trigger.threshold || 0),
            direction: String(trigger.direction || 'above'),
            directionText: String(trigger.direction || 'above') === 'below' ? '低于' : '高于',
            note: String(trigger.note || '')
          }))
        };
      })
      .filter(Boolean);
  },

  getAlertCurrencyOptions() {
    return (this.data.stressCurrencyOptions || []).filter(item => item.code !== 'ALL');
  },

  getAlertDirectionOptions() {
    return [
      { value: 'above', label: '高于阈值' },
      { value: 'below', label: '低于阈值' }
    ];
  },

  normalizeRiskSummary(summary) {
    if (!summary || typeof summary !== 'object') return null;
    const totalValue = Number(summary.totalValue || 0);
    const var95 = Number(summary.var95 || 0);
    const var99 = Number(summary.var99 || 0);
    const volatility = Number(summary.volatility || 0);
    const portfolioSeries = summary.portfolioSeries && typeof summary.portfolioSeries === 'object'
      ? summary.portfolioSeries
      : {};
    const topExposures = (Array.isArray(summary.topExposures) ? summary.topExposures : []).map(item => ({
      code: String(item.code || '').toUpperCase(),
      cnyValue: Number(item.cnyValue || 0),
      cnyText: `¥${Number(item.cnyValue || 0).toFixed(2)}`
    }));
    const riskContributions = (Array.isArray(summary.riskContributions) ? summary.riskContributions : []).map(item => ({
      code: String(item.code || '').toUpperCase(),
      cnyValue: Number(item.cnyValue || 0),
      cnyText: `¥${Number(item.cnyValue || 0).toFixed(2)}`,
      weightPct: Number(item.weightPct || 0),
      weightText: `${Number(item.weightPct || 0).toFixed(1)}%`,
      contributionPct: Number(item.contributionPct || 0),
      contributionText: `${Number(item.contributionPct || 0).toFixed(1)}%`,
      assetVol: Number(item.assetVol || 0),
      volatilityText: `${(Number(item.assetVol || 0) * 100).toFixed(2)}%`
    }));
    const normalized = {
      totalValue,
      totalValueText: `¥${totalValue.toFixed(2)}`,
      var95,
      var99,
      var95Text: `¥${var95.toFixed(2)}`,
      var99Text: `¥${var99.toFixed(2)}`,
      volatility,
      volatilityText: `${(volatility * 100).toFixed(2)}%`,
      confidenceHint: String(summary.confidenceHint || 'history_weak'),
      confidenceText: summary.confidenceHint === 'history_ok' ? '历史样本充足' : '历史样本偏少',
      portfolioSeries: {
        labels: Array.isArray(portfolioSeries.labels) ? portfolioSeries.labels.map(item => String(item || '').slice(5) || String(item || '')) : [],
        values: Array.isArray(portfolioSeries.values) ? portfolioSeries.values.map(item => Number(item || 0)) : []
      },
      topExposures,
      riskContributions
    };

    return {
      ...normalized,
      ...this.buildRiskInsights(normalized)
    };
  },

  buildRiskInsights(risk) {
    const totalValue = Number(risk.totalValue || 0);
    const var95Ratio = totalValue > 0 ? Number(risk.var95 || 0) / totalValue : 0;
    const topExposure = Array.isArray(risk.topExposures) && risk.topExposures.length ? risk.topExposures[0] : null;
    const topContribution = Array.isArray(risk.riskContributions) && risk.riskContributions.length ? risk.riskContributions[0] : null;
    const concentrationRatio = topExposure && totalValue > 0 ? topExposure.cnyValue / totalValue : 0;
    const maxDrawdown = this.calculateMaxDrawdown((risk.portfolioSeries && risk.portfolioSeries.values) || []);

    let pulseTone = 'steady';
    let pulseLabel = '稳态';
    if (var95Ratio >= 0.04 || concentrationRatio >= 0.58 || Number(risk.volatility || 0) >= 0.18) {
      pulseTone = 'elevated';
      pulseLabel = '偏高';
    } else if (var95Ratio >= 0.025 || concentrationRatio >= 0.42 || Number(risk.volatility || 0) >= 0.1) {
      pulseTone = 'watch';
      pulseLabel = '关注';
    }

    const signals = [
      `95% 单日风险预算约占组合 ${(var95Ratio * 100).toFixed(2)}%。`,
      topExposure ? `最大敞口为 ${topExposure.code}，集中度 ${(concentrationRatio * 100).toFixed(1)}%。` : '当前未识别出明显单币种集中敞口。',
      topContribution ? `${topContribution.code} 贡献了 ${topContribution.contributionText} 的风险波动。` : '当前暂无风险贡献拆分结果。',
      `历史回放最大回撤约 ${(maxDrawdown * 100).toFixed(2)}%。`
    ];

    return {
      pulseTone,
      pulseLabel,
      pulseText: pulseTone === 'steady' ? '组合波动暂时可控' : pulseTone === 'watch' ? '建议关注敞口变化' : '需要优先处理风险集中',
      maxDrawdown,
      maxDrawdownText: `${(maxDrawdown * 100).toFixed(2)}%`,
      signals: signals.slice(0, 4)
    };
  },

  calculateMaxDrawdown(values) {
    if (!Array.isArray(values) || values.length < 2) return 0;
    let peak = Number(values[0] || 0);
    let maxDrawdown = 0;
    values.forEach((value) => {
      const numeric = Number(value || 0);
      if (numeric > peak) peak = numeric;
      if (peak > 0 && numeric >= 0) {
        maxDrawdown = Math.max(maxDrawdown, (peak - numeric) / peak);
      }
    });
    return maxDrawdown;
  },

  getSelectedRiskWindowSeries() {
    const risk = this.data.latestRiskSummary;
    const labels = risk && risk.portfolioSeries ? risk.portfolioSeries.labels || [] : [];
    const values = risk && risk.portfolioSeries ? risk.portfolioSeries.values || [] : [];
    const wanted = Number(this.data.selectedRiskWindow || 14);
    const actualWindow = Math.min(wanted, labels.length, values.length);
    if (!actualWindow || actualWindow < 2) {
      return { labels: [], values: [], window: 0 };
    }
    return {
      labels: labels.slice(-actualWindow),
      values: values.slice(-actualWindow),
      window: actualWindow
    };
  },

  selectRiskWindow(e) {
    const windowSize = Number(e.currentTarget.dataset.window || 14);
    if (!windowSize || windowSize === this.data.selectedRiskWindow) return;
    this.setData({ selectedRiskWindow: windowSize }, () => {
      this.refreshRiskTrendChart();
    });
  },

  setRiskFocus(code) {
    const nextCode = String(code || '').toUpperCase();
    if (!nextCode) return;
    this.setData({ selectedRiskFocusCode: nextCode }, () => {
      this.updateRiskFocusSuggestion();
    });
  },

  clearRiskFocus() {
    if (!this.data.selectedRiskFocusCode) return;
    this.setData({ selectedRiskFocusCode: '', riskFocusSuggestion: null });
  },

  onRiskContributionTap(e) {
    const code = e.currentTarget.dataset.code;
    if (!code) return;
    this.setRiskFocus(code);
  },

  getRiskSuggestionModeMeta(modeKey) {
    const mode = String(modeKey || this.data.selectedRiskSuggestionMode || 'standard');
    const modeMap = {
      guarded: { label: '保守', multiplier: 0.72 },
      standard: { label: '标准', multiplier: 1 },
      aggressive: { label: '激进', multiplier: 1.35 }
    };
    return modeMap[mode] || modeMap.standard;
  },

  selectRiskSuggestionMode(e) {
    const mode = String(e.currentTarget.dataset.mode || 'standard');
    if (!mode || mode === this.data.selectedRiskSuggestionMode) return;
    this.setData({ selectedRiskSuggestionMode: mode }, () => {
      this.updateRiskFocusSuggestion();
    });
  },

  buildRiskFocusSuggestion(code) {
    const focusCode = String(code || '').toUpperCase();
    if (!focusCode) return null;

    const currentRate = this.getRateByCode(this.data.rates || app.globalData.exchangeRates || {}, focusCode);
    if (!currentRate) return null;

    const risk = this.data.latestRiskSummary || {};
    const contribution = Array.isArray(risk.riskContributions)
      ? risk.riskContributions.find(item => item.code === focusCode)
      : null;
    const currentRules = this.normalizeAlertRules(app.globalData.alertRules || []);
    const existingRules = currentRules.filter(item => item.code === focusCode);
    const volatilityBase = contribution ? Number(contribution.assetVol || 0) : Number(risk.volatility || 0);
    const modeMeta = this.getRiskSuggestionModeMeta();
    const baseBuffer = Math.min(0.045, Math.max(0.015, volatilityBase * 0.2 || 0.02));
    const bufferPct = Math.min(0.06, Math.max(0.008, baseBuffer * modeMeta.multiplier));
    const threshold = Number((currentRate * (1 - bufferPct)).toFixed(4));

    return {
      code: focusCode,
      currentRate,
      currentRateText: currentRate.toFixed(4),
      threshold,
      thresholdText: threshold.toFixed(4),
      direction: 'below',
      directionText: '低于',
      bufferPct,
      bufferText: `${(bufferPct * 100).toFixed(2)}%`,
      note: `${focusCode} 风险守护线`,
      mode: this.data.selectedRiskSuggestionMode,
      modeLabel: modeMeta.label,
      existingCount: existingRules.length,
      actionText: existingRules.length ? '更新并立即试跑提醒' : '生成并立即试跑提醒'
    };
  },

  updateRiskFocusSuggestion() {
    const suggestion = this.buildRiskFocusSuggestion(this.data.selectedRiskFocusCode);
    this.setData({ riskFocusSuggestion: suggestion });
  },

  highlightAlertRule(ruleId) {
    if (!ruleId) return;
    if (this._riskAlertHighlightTimer) {
      clearTimeout(this._riskAlertHighlightTimer);
    }
    this.setData({ highlightedAlertRuleId: ruleId });
    wx.nextTick(() => {
      wx.pageScrollTo({
        selector: '#alert-section',
        duration: 280,
        offsetTop: 16
      });
    });
    this._riskAlertHighlightTimer = setTimeout(() => {
      this.setData({ highlightedAlertRuleId: '' });
      this._riskAlertHighlightTimer = null;
    }, 2600);
  },

  async runAlertCheck(rules, options = {}) {
    const normalizedRules = this.normalizeAlertRules(rules || app.globalData.alertRules || []);
    if (!normalizedRules.length) {
      wx.showToast({ title: '请先添加提醒规则', icon: 'none' });
      return null;
    }

    const loadingText = options.loadingText || '检查提醒中...';
    wx.showLoading({ title: loadingText, mask: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'alertMonitor',
        data: {
          manual: true,
          alertRules: normalizedRules,
          currentRates: this.data.rates || {}
        }
      });
      const triggers = Array.isArray(res.result?.triggers) ? res.result.triggers : [];
      const historyEntry = res.result?.historyEntry || null;
      const nextHistory = historyEntry
        ? [historyEntry, ...(this.normalizeAlertHistory(app.globalData.alertHistory || []))].slice(0, 20)
        : this.normalizeAlertHistory(app.globalData.alertHistory || []);
      this.persistStressState({
        alertHistory: nextHistory,
        lastAlertCheckAt: String(res.result?.checkedAt || historyEntry?.checkedAt || new Date().toLocaleString())
      });

      if (options.showModal !== false) {
        wx.showModal({
          title: triggers.length ? (options.hitTitle || '命中提醒') : (options.emptyTitle || '未命中提醒'),
          content: triggers.length
            ? triggers.map(item => `${item.code} 当前 ${item.current}，${item.direction === 'below' ? '低于' : '高于'} ${item.threshold}`).join('\n')
            : (options.emptyContent || '当前汇率均未触发已配置阈值。'),
          showCancel: false
        });
      }

      return { triggers, response: res.result || null };
    } catch (error) {
      console.error('checkAlertsNow failed', error);
      wx.showToast({ title: options.errorText || '提醒检查失败', icon: 'none' });
      return null;
    } finally {
      wx.hideLoading();
    }
  },

  async applyRiskFocusSuggestion() {
    const suggestion = this.data.riskFocusSuggestion;
    if (!suggestion) {
      wx.showToast({ title: '暂无可生成的提醒建议', icon: 'none' });
      return;
    }

    const currentRules = this.normalizeAlertRules(app.globalData.alertRules || []);
    const existingIndex = currentRules.findIndex(item => item.code === suggestion.code && item.note === suggestion.note);
    const nextRule = this.normalizeAlertRule({
      id: existingIndex >= 0 ? currentRules[existingIndex].id : `alert_${Date.now()}`,
      code: suggestion.code,
      direction: suggestion.direction,
      threshold: suggestion.threshold,
      note: suggestion.note,
      enabled: true
    });

    if (!nextRule) {
      wx.showToast({ title: '提醒建议生成失败', icon: 'none' });
      return;
    }

    if (existingIndex >= 0) {
      currentRules.splice(existingIndex, 1, nextRule);
    } else {
      currentRules.unshift(nextRule);
    }

    const nextRules = currentRules.slice(0, 12);
    this.persistStressState({ alertRules: nextRules });
    this.highlightAlertRule(nextRule.id);
    const alertCheckResult = await this.runAlertCheck(nextRules, {
      loadingText: existingIndex >= 0 ? '更新并试跑中...' : '生成并试跑中...',
      hitTitle: '新规则已命中',
      emptyTitle: '新规则已生效',
      emptyContent: '新生成的风险守护线已保存，当前汇率尚未触发。',
      errorText: '规则已保存，但试跑失败'
    });
    if (!alertCheckResult) return;
    wx.showToast({ title: existingIndex >= 0 ? '风险提醒已更新' : '风险提醒已生成', icon: 'success' });
  },

  normalizeAdvice(advice) {
    if (!advice || typeof advice !== 'object') return null;
    return {
      generatedAt: String(advice.generatedAt || ''),
      headline: String(advice.headline || '暂无建议'),
      summary: String(advice.summary || ''),
      insights: Array.isArray(advice.insights) ? advice.insights.filter(Boolean).slice(0, 4) : [],
      actions: Array.isArray(advice.actions) ? advice.actions.filter(Boolean).slice(0, 3) : []
    };
  },

  buildAICapabilityPanel() {
    const xishuAssets = wx.getStorageSync('XISHU_ASSETS_V1') || [];
    const xishuAssetCount = (Array.isArray(xishuAssets) ? xishuAssets : []).filter((item) => item && item.type === 'asset').length;
    const modules = [
      {
        key: 'fx-monitor',
        name: '汇率波动监测',
        ready: this.data.selectedRateList.length > 0,
        detail: this.data.lastAIMonitorAt
          ? `最近监测 ${this.data.lastAIMonitorCode || '-'} · ${this.data.lastAIMonitorAt}`
          : `可监测币种 ${this.data.selectedRateList.length} 个`
      },
      {
        key: 'risk-radar',
        name: '风险雷达 VaR',
        ready: !!this.data.latestRiskSummary,
        detail: this.data.latestRiskSummary
          ? `VaR95 ${this.data.latestRiskSummary.var95Text}`
          : '等待风险分析结果'
      },
      {
        key: 'stress-engine',
        name: '压力测试引擎',
        ready: !!this.data.stressResult || (this.data.savedStressScenarios || []).length > 0,
        detail: this.data.stressResult
          ? `最近场景 ${this.data.stressResult.scenarioName}`
          : `已保存场景 ${(this.data.savedStressScenarios || []).length} 个`
      },
      {
        key: 'portfolio-advice',
        name: '组合建议生成',
        ready: !!this.data.latestAdvice,
        detail: this.data.latestAdvice
          ? `最近生成 ${this.data.latestAdvice.generatedAt || '刚刚'}`
          : '等待建议生成'
      },
      {
        key: 'asset-intelligence',
        name: '悉数资产智能',
        ready: xishuAssetCount > 0,
        detail: xishuAssetCount > 0
          ? `已接入资产 ${xishuAssetCount} 条（含OCR/残值/回本分析）`
          : '悉数页录入资产后自动激活'
      }
    ];
    const readyCount = modules.filter((item) => item.ready).length;
    const score = Math.round((readyCount / Math.max(1, modules.length)) * 100);
    return {
      score,
      readyCount,
      totalCount: modules.length,
      summaryText: `当前已激活 ${readyCount}/${modules.length} 个 AI 场景能力`,
      modules
    };
  },

  refreshAICapabilityPanel() {
    this.setData({
      aiCapabilityPanel: this.buildAICapabilityPanel()
    });
  },

  syncStressStateFromGlobal() {
    const goalBuckets = deriveGoalBuckets(app.globalData.goalBuckets, app.globalData.depositTarget);
    this.setData({
      depositTarget: app.globalData.depositTarget,
      goalBuckets,
      savedStressScenarios: this.normalizeSavedStressScenarios(app.globalData.savedStressScenarios),
      stressResult: this.normalizeStressResult(app.globalData.latestStressResult),
      stressCurrencyOptions: this.buildStressCurrencyOptions(),
      alertCurrencyOptions: this.getAlertCurrencyOptions(),
      alertRules: this.normalizeAlertRules(app.globalData.alertRules),
      alertHistory: this.normalizeAlertHistory(app.globalData.alertHistory),
      lastAlertCheckAt: String(app.globalData.lastAlertCheckAt || ''),
      latestRiskSummary: this.normalizeRiskSummary(app.globalData.latestRiskSummary),
      latestAdvice: this.normalizeAdvice(app.globalData.latestAdvice),
      privacyMode: !!app.globalData.privacyMode,
      biometricEnabled: !!app.globalData.biometricEnabled
    }, () => {
      this.calculateTargetProgress();
      this.updateRiskFocusSuggestion();
      this.refreshRiskCharts();
      this.refreshAICapabilityPanel();
    });
  },

  refreshRiskCharts() {
    this.refreshRiskTrendChart();
    this.refreshRiskContributionChart();
  },

  refreshRiskTrendChart() {
    const chartComponent = this.selectComponent('#risk-trend-chart');
    const { labels, values } = this.getSelectedRiskWindowSeries();
    if (!chartComponent || this.data.privacyMode || labels.length < 2 || values.length < 2) return;

    chartComponent.init((canvas, width, height, dpr) => {
      const chart = initChart(canvas, width, height, dpr);
      chart.setOption({
        color: ['#0f766e'],
        tooltip: {
          trigger: 'axis',
          confine: true,
          valueFormatter: (value) => `¥${Number(value || 0).toFixed(2)}`
        },
        grid: { top: '14%', left: '6%', right: '6%', bottom: '12%', containLabel: true },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: labels,
          axisLabel: { color: '#94a3b8', fontSize: 10 }
        },
        yAxis: {
          type: 'value',
          axisLabel: {
            color: '#94a3b8',
            fontSize: 10,
            formatter: (value) => `${(Number(value || 0) / 10000).toFixed(1)}w`
          },
          splitLine: { lineStyle: { color: '#e2e8f0' } }
        },
        series: [{
          type: 'line',
          smooth: true,
          showSymbol: false,
          data: values,
          lineStyle: { width: 3 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(15, 118, 110, 0.28)' },
                { offset: 1, color: 'rgba(15, 118, 110, 0.04)' }
              ]
            }
          }
        }]
      });
      return chart;
    });
  },

  refreshRiskContributionChart() {
    const chartComponent = this.selectComponent('#risk-contribution-chart');
    const risk = this.data.latestRiskSummary;
    const items = risk && Array.isArray(risk.riskContributions) ? risk.riskContributions : [];
    if (!chartComponent || this.data.privacyMode || !items.length) return;

    chartComponent.init((canvas, width, height, dpr) => {
      const chart = initChart(canvas, width, height, dpr);
      const labels = items.map(item => item.code);
      chart.setOption({
        color: ['#f59e0b'],
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          confine: true,
          formatter: (params) => {
            const point = Array.isArray(params) ? params[0] : params;
            const item = items[point.dataIndex] || {};
            return `${item.code}\n风险贡献 ${item.contributionText || '0%'}\n敞口占比 ${item.weightText || '0%'}\n年化波动 ${item.volatilityText || '0%'}`;
          }
        },
        grid: { top: '10%', left: '16%', right: '8%', bottom: '10%', containLabel: true },
        xAxis: {
          type: 'value',
          axisLabel: { color: '#94a3b8', fontSize: 10, formatter: (value) => `${value}%` },
          splitLine: { lineStyle: { color: '#e2e8f0' } }
        },
        yAxis: {
          type: 'category',
          data: labels,
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
            formatter: ({ dataIndex }) => items[dataIndex] ? items[dataIndex].contributionText : ''
          }
        }]
      });
      chart.off('click');
      chart.on('click', (params) => {
        const item = items[params.dataIndex] || {};
        if (item.code) {
          this.setRiskFocus(item.code);
        }
      });
      return chart;
    });
  },

  persistStressState(nextState = {}, options = {}) {
    if (Object.prototype.hasOwnProperty.call(nextState, 'savedStressScenarios')) {
      app.globalData.savedStressScenarios = nextState.savedStressScenarios;
    }
    if (Object.prototype.hasOwnProperty.call(nextState, 'latestStressResult')) {
      app.globalData.latestStressResult = nextState.latestStressResult;
    }
    if (Object.prototype.hasOwnProperty.call(nextState, 'alertRules')) {
      app.globalData.alertRules = nextState.alertRules;
    }
    if (Object.prototype.hasOwnProperty.call(nextState, 'alertHistory')) {
      app.globalData.alertHistory = nextState.alertHistory;
    }
    if (Object.prototype.hasOwnProperty.call(nextState, 'lastAlertCheckAt')) {
      app.globalData.lastAlertCheckAt = nextState.lastAlertCheckAt;
    }
    if (Object.prototype.hasOwnProperty.call(nextState, 'latestRiskSummary')) {
      app.globalData.latestRiskSummary = nextState.latestRiskSummary;
    }
    if (Object.prototype.hasOwnProperty.call(nextState, 'latestAdvice')) {
      app.globalData.latestAdvice = nextState.latestAdvice;
    }
    if (Object.prototype.hasOwnProperty.call(nextState, 'privacyMode')) {
      app.globalData.privacyMode = !!nextState.privacyMode;
    }
    if (Object.prototype.hasOwnProperty.call(nextState, 'biometricEnabled')) {
      app.globalData.biometricEnabled = !!nextState.biometricEnabled;
    }
    if (options.syncCloud === false) {
      app.updateStorage();
    } else {
      app.sync();
    }
    this.syncStressStateFromGlobal();
  },

  async loadAdvancedInsights(rates, bankCards) {
    const cleanCards = Array.isArray(bankCards) ? bankCards : [];
    if (!cleanCards.length) {
      this.persistStressState({ latestRiskSummary: null, latestAdvice: null }, { syncCloud: false });
      return;
    }

    this.setData({ isAdvancedLoading: true });
    try {
      const riskRes = await wx.cloud.callFunction({
        name: 'riskAnalyzer',
        data: {
          bankCards: cleanCards,
          currentRates: rates
        }
      });

      const normalizedRisk = riskRes.result?.success
        ? this.normalizeRiskSummary(riskRes.result)
        : null;

      let normalizedAdvice = null;
      try {
        const adviceRes = await wx.cloud.callFunction({
          name: 'aiPortfolioAdvisor',
          data: {
            bankCards: cleanCards,
            currentRates: rates,
            stressResult: app.globalData.latestStressResult,
            riskSummary: normalizedRisk || riskRes.result || null
          }
        });
        if (adviceRes.result?.success) {
          normalizedAdvice = this.normalizeAdvice(adviceRes.result);
        }
      } catch (error) {
        console.warn('aiPortfolioAdvisor not available', error);
      }

      this.persistStressState(
        {
          latestRiskSummary: normalizedRisk,
          latestAdvice: normalizedAdvice
        },
        { syncCloud: false }
      );
    } catch (error) {
      console.warn('riskAnalyzer not available', error);
    } finally {
      this.setData({ isAdvancedLoading: false });
    }
  },

  onShowExperimentParams(e) {
    const type = String((e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.type) || '');
    const risk = this.data.latestRiskSummary || null;
    const stress = this.data.stressResult || null;
    const advice = this.data.latestAdvice || null;

    const riskParams = {
      engine: 'riskAnalyzer',
      selectedWindowDays: Number(this.data.selectedRiskWindow || 14),
      sampleSize: risk && risk.portfolioSeries && Array.isArray(risk.portfolioSeries.values)
        ? risk.portfolioSeries.values.length
        : 0,
      exposureCount: risk && Array.isArray(risk.topExposures) ? risk.topExposures.length : 0,
      contributionCount: risk && Array.isArray(risk.riskContributions) ? risk.riskContributions.length : 0,
      ratesUpdateTime: this.data.updateTime || '',
      cardsCount: Array.isArray(this.data.bankCards) ? this.data.bankCards.length : 0
    };

    const stressParams = {
      engine: 'runStressTest(local)',
      scenarioName: stress ? stress.scenarioName : '',
      scenarioKey: stress ? stress.scenarioKey : '',
      shockSummary: stress ? stress.shockSummary : '',
      shockCount: stress && Array.isArray(stress.shocks) ? stress.shocks.length : 0,
      baseTotal: stress ? Number(stress.baseTotal || 0).toFixed(2) : '0.00',
      timestamp: stress ? stress.timestamp : ''
    };

    const adviceParams = {
      engine: 'aiPortfolioAdvisor',
      generatedAt: advice ? advice.generatedAt : '',
      hasRiskSummary: !!risk,
      hasStressResult: !!stress,
      ratesUpdateTime: this.data.updateTime || '',
      cardsCount: Array.isArray(this.data.bankCards) ? this.data.bankCards.length : 0
    };

    const payloadMap = {
      risk: {
        title: '风险雷达实验参数',
        payload: riskParams
      },
      stress: {
        title: '压力测试实验参数',
        payload: stressParams
      },
      advice: {
        title: '组合建议实验参数',
        payload: adviceParams
      }
    };

    const target = payloadMap[type];
    if (!target) return;

    wx.showModal({
      title: target.title,
      content: JSON.stringify(target.payload, null, 2),
      showCancel: false,
      confirmText: '知道了'
    });
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

  async togglePrivacyMode() {
    const next = !this.data.privacyMode;
    if (!next && this.data.biometricEnabled) {
      const passed = await this.requestBiometricAuth('验证后显示首页资产金额');
      if (!passed) {
        wx.showToast({ title: '验证未通过', icon: 'none' });
        return;
      }
    }
    this.persistStressState({ privacyMode: next });
    wx.showToast({ title: next ? '金额已隐藏' : '金额已显示', icon: 'none' });
  },

  toggleBiometricEnabled() {
    const next = !this.data.biometricEnabled;
    this.persistStressState({ biometricEnabled: next });
    wx.showToast({ title: next ? '已开启生物验证' : '已关闭生物验证', icon: 'none' });
  },

  openAlertEditor(e) {
    const ruleId = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.id : '';
    const options = this.getAlertCurrencyOptions();
    const directionOptions = this.getAlertDirectionOptions();
    const currentRules = this.normalizeAlertRules(app.globalData.alertRules || []);
    const targetRule = currentRules.find(item => item.id === ruleId);
    const codeIndex = targetRule ? Math.max(0, options.findIndex(item => item.code === targetRule.code)) : 0;
    const directionIndex = targetRule ? Math.max(0, directionOptions.findIndex(item => item.value === targetRule.direction)) : 0;

    this.setData({
      showAlertEditor: true,
      editingAlertRuleId: targetRule ? targetRule.id : '',
      alertEditorCodeIndex: codeIndex < 0 ? 0 : codeIndex,
      alertEditorDirectionIndex: directionIndex < 0 ? 0 : directionIndex,
      alertEditorThreshold: targetRule ? targetRule.thresholdText : '',
      alertEditorNote: targetRule ? targetRule.note : ''
    });
  },

  closeAlertEditor() {
    this.setData({
      showAlertEditor: false,
      editingAlertRuleId: '',
      alertEditorCodeIndex: 0,
      alertEditorDirectionIndex: 0,
      alertEditorThreshold: '',
      alertEditorNote: ''
    });
  },

  onAlertEditorCodeChange(e) {
    this.setData({ alertEditorCodeIndex: Number(e.detail.value || 0) });
  },

  onAlertEditorDirectionChange(e) {
    this.setData({ alertEditorDirectionIndex: Number(e.detail.value || 0) });
  },

  onAlertEditorThresholdInput(e) {
    this.setData({ alertEditorThreshold: e.detail.value || '' });
  },

  onAlertEditorNoteInput(e) {
    this.setData({ alertEditorNote: e.detail.value || '' });
  },

  buildAlertRuleFromEditor() {
    const currencyOptions = this.getAlertCurrencyOptions();
    const directionOptions = this.getAlertDirectionOptions();
    const pickedCurrency = currencyOptions[this.data.alertEditorCodeIndex] || currencyOptions[0];
    const pickedDirection = directionOptions[this.data.alertEditorDirectionIndex] || directionOptions[0];
    const threshold = Number(this.data.alertEditorThreshold || 0);
    if (!pickedCurrency) return { error: '暂无可配置币种' };
    if (!Number.isFinite(threshold) || threshold <= 0) return { error: '请输入正确阈值' };

    const autoNote = `${pickedCurrency.code}${pickedDirection.value === 'below' ? '跌破' : '升破'} ${threshold.toFixed(4)}`;
    return {
      rule: this.normalizeAlertRule({
        id: this.data.editingAlertRuleId || `alert_${Date.now()}`,
        code: pickedCurrency.code,
        direction: pickedDirection.value,
        threshold,
        note: String(this.data.alertEditorNote || '').trim() || autoNote,
        enabled: true
      })
    };
  },

  saveAlertRule() {
    const { rule, error } = this.buildAlertRuleFromEditor();
    if (error) {
      wx.showToast({ title: error, icon: 'none' });
      return;
    }
    const currentRules = this.normalizeAlertRules(app.globalData.alertRules || []);
    const existingIndex = currentRules.findIndex(item => item.id === rule.id);
    if (existingIndex >= 0) {
      currentRules.splice(existingIndex, 1, rule);
    } else {
      currentRules.unshift(rule);
    }
    this.persistStressState({ alertRules: currentRules.slice(0, 12) });
    this.closeAlertEditor();
    wx.showToast({ title: '提醒已保存', icon: 'success' });
  },

  toggleAlertRuleEnabled(e) {
    const { id } = e.currentTarget.dataset;
    if (!id) return;
    const nextRules = this.normalizeAlertRules(app.globalData.alertRules || []).map(item => (
      item.id === id ? { ...item, enabled: !item.enabled } : item
    ));
    this.persistStressState({ alertRules: nextRules });
    wx.showToast({ title: '状态已更新', icon: 'none' });
  },

  deleteAlertRule(e) {
    const { id } = e.currentTarget.dataset;
    if (!id) return;
    const nextRules = this.normalizeAlertRules(app.globalData.alertRules || []).filter(item => item.id !== id);
    this.persistStressState({ alertRules: nextRules });
    wx.showToast({ title: '提醒已删除', icon: 'success' });
  },

  clearAlertHistory() {
    this.persistStressState({ alertHistory: [], lastAlertCheckAt: '' });
    wx.showToast({ title: '提醒历史已清空', icon: 'success' });
  },

  async checkAlertsNow() {
    await this.runAlertCheck(app.globalData.alertRules || []);
  },

  buildStressScenarios() {
    return [
      {
        key: 'usd_up_2',
        name: '美元上行 +2%',
        shocks: { USD: 2.0 }
      },
      {
        key: 'jpy_down_3',
        name: '日元下行 -3%',
        shocks: { JPY: -3.0 }
      },
      {
        key: 'risk_off',
        name: '避险情绪升温',
        shocks: { USD: 1.5, CHF: 1.5, JPY: 1.0, AUD: -1.0, CAD: -1.0, NZD: -1.0 }
      },
      {
        key: 'all_down_2',
        name: '全币种下行 -2%',
        shocks: { ALL: -2.0 }
      }
    ];
  },

  runStressTest() {
    const presetScenarios = this.buildStressScenarios();
    const savedScenarios = this.data.savedStressScenarios || [];
    const actions = [
      ...presetScenarios.map(scenario => ({ label: scenario.name, scenario })),
      ...savedScenarios.map(scenario => ({ label: `已存: ${scenario.name}`, scenario })),
      { label: '结构化自定义...', action: 'custom' }
    ];

    wx.showActionSheet({
      itemList: actions.map(item => item.label),
      success: (res) => {
        const picked = actions[res.tapIndex];
        if (!picked) return;
        if (picked.action === 'custom') {
          this.openStressEditor();
          return;
        }
        this.executeStressScenario(picked.scenario);
      }
    });
  },

  createStressEditorRowsFromScenario(scenario) {
    const normalized = this.normalizeStressScenario(scenario);
    if (!normalized) return [this.createStressEditorRow()];
    return Object.keys(normalized.shocks).map(code => this.createStressEditorRow(code, normalized.shocks[code]));
  },

  openStressEditor() {
    this.setData({
      showStressEditor: true,
      editingStressScenarioKey: '',
      stressEditorName: '',
      stressEditorRows: [this.createStressEditorRow()]
    });
  },

  openSavedScenarioEditor(e) {
    const { key } = e.currentTarget.dataset;
    const scenario = (this.data.savedStressScenarios || []).find(item => item.key === key);
    if (!scenario) return;

    this.setData({
      showStressEditor: true,
      editingStressScenarioKey: scenario.key,
      stressEditorName: scenario.name,
      stressEditorRows: this.createStressEditorRowsFromScenario(scenario)
    });
  },

  closeStressEditor() {
    this.setData({
      showStressEditor: false,
      editingStressScenarioKey: '',
      stressEditorName: '',
      stressEditorRows: [this.createStressEditorRow()]
    });
  },

  onStressEditorNameInput(e) {
    this.setData({ stressEditorName: e.detail.value || '' });
  },

  onStressEditorCodeChange(e) {
    const rowIndex = Number(e.currentTarget.dataset.index);
    const optionIndex = Number(e.detail.value);
    const options = this.data.stressCurrencyOptions || [];
    const picked = options[optionIndex];
    if (!picked) return;

    const rows = [...(this.data.stressEditorRows || [])];
    if (!rows[rowIndex]) return;
    rows[rowIndex] = {
      ...rows[rowIndex],
      optionIndex,
      code: picked.code
    };
    this.setData({ stressEditorRows: rows });
  },

  onStressEditorPctInput(e) {
    const rowIndex = Number(e.currentTarget.dataset.index);
    const rows = [...(this.data.stressEditorRows || [])];
    if (!rows[rowIndex]) return;
    rows[rowIndex] = {
      ...rows[rowIndex],
      pct: e.detail.value || ''
    };
    this.setData({ stressEditorRows: rows });
  },

  addStressEditorRow() {
    this.setData({
      stressEditorRows: [...(this.data.stressEditorRows || []), this.createStressEditorRow()]
    });
  },

  removeStressEditorRow(e) {
    const rowIndex = Number(e.currentTarget.dataset.index);
    const rows = [...(this.data.stressEditorRows || [])];
    if (rows.length <= 1) return;
    rows.splice(rowIndex, 1);
    this.setData({ stressEditorRows: rows });
  },

  buildScenarioFromEditor(options = {}) {
    const { requireName = false } = options;
    const rows = this.data.stressEditorRows || [];
    const shocks = {};

    for (const row of rows) {
      const code = String(row.code || '').trim().toUpperCase();
      const rawPct = String(row.pct || '').trim();
      if (!code) continue;
      if (rawPct === '') {
        return { error: '请填写完整冲击幅度' };
      }
      const pct = Number(rawPct);
      if (!Number.isFinite(pct)) {
        return { error: '冲击幅度必须是数字' };
      }
      shocks[code] = pct;
    }

    if (!Object.keys(shocks).length) {
      return { error: '至少添加一个冲击项' };
    }

    const manualName = String(this.data.stressEditorName || '').trim();
    if (requireName && !manualName) {
      return { error: '请填写场景名称' };
    }

    const scenario = this.normalizeStressScenario({
      key: this.data.editingStressScenarioKey || `custom_${Date.now()}`,
      name: manualName || this.buildShockSummary(shocks),
      shocks
    });

    if (!scenario) {
      return { error: '场景生成失败' };
    }

    return { scenario };
  },

  runStressEditorScenario() {
    const { scenario, error } = this.buildScenarioFromEditor();
    if (error) {
      wx.showToast({ title: error, icon: 'none' });
      return;
    }
    this.closeStressEditor();
    this.executeStressScenario(scenario);
  },

  saveStressEditorScenario() {
    const { scenario, error } = this.buildScenarioFromEditor();
    if (error) {
      wx.showToast({ title: error, icon: 'none' });
      return;
    }

    const current = this.normalizeSavedStressScenarios(app.globalData.savedStressScenarios || []);
    const existingIndex = current.findIndex(item => item.key === scenario.key);
    if (existingIndex >= 0) {
      current.splice(existingIndex, 1, scenario);
    } else {
      current.unshift(scenario);
    }

    this.persistStressState({
      savedStressScenarios: current.slice(0, 12)
    });
    this.closeStressEditor();
    wx.showToast({ title: '场景已保存', icon: 'success' });
  },

  runSavedScenario(e) {
    const { key } = e.currentTarget.dataset;
    const scenario = (this.data.savedStressScenarios || []).find(item => item.key === key);
    if (!scenario) return;
    this.executeStressScenario(scenario);
  },

  deleteSavedScenario(e) {
    const { key } = e.currentTarget.dataset;
    if (!key) return;

    wx.showModal({
      title: '删除场景',
      content: '删除后将不会再出现在快捷复用列表中。',
      success: (res) => {
        if (!res.confirm) return;
        const nextScenarios = this.normalizeSavedStressScenarios(app.globalData.savedStressScenarios || [])
          .filter(item => item.key !== key);
        this.persistStressState({ savedStressScenarios: nextScenarios });
        wx.showToast({ title: '已删除', icon: 'success' });
      }
    });
  },

  clearStressResult() {
    this.persistStressState({ latestStressResult: null });
  },

  noop() {},

  openGoalEditor(e) {
    const goalId = e && e.currentTarget ? String(e.currentTarget.dataset.id || '') : '';
    const goalBuckets = deriveGoalBuckets(app.globalData.goalBuckets, app.globalData.depositTarget);
    const currentGoal = goalBuckets.find(item => item.id === goalId);
    const defaultGoal = normalizeGoalBucket({
      name: '',
      targetAmount: '',
      targetDate: formatDateInput(addMonths(new Date(), 12)),
      riskLevel: 'balanced',
      preferredCodes: ['CNY']
    }, goalBuckets.length);
    const editingGoal = currentGoal || defaultGoal;
    const goalEditorRiskIndex = Math.max(0, GOAL_RISK_OPTIONS.findIndex(item => item.value === editingGoal.riskLevel));
    const goalEditorSelectedCodes = currentGoal && currentGoal.preferredCodes.length ? currentGoal.preferredCodes : ['CNY'];
    this.setData({
      showGoalEditor: true,
      editingGoalId: currentGoal ? currentGoal.id : '',
      goalEditorName: currentGoal ? currentGoal.name : '',
      goalEditorAmount: currentGoal ? String(currentGoal.targetAmount) : '',
      goalEditorDate: editingGoal.targetDate,
      goalEditorRiskIndex,
      goalEditorSelectedCodes,
      goalCurrencyOptions: this.buildGoalCurrencyOptions(goalEditorSelectedCodes)
    });
  },

  closeGoalEditor() {
    this.setData({
      showGoalEditor: false,
      editingGoalId: '',
      goalEditorName: '',
      goalEditorAmount: '',
      goalEditorDate: formatDateInput(addMonths(new Date(), 12)),
      goalEditorRiskIndex: 1,
      goalEditorSelectedCodes: [],
      goalCurrencyOptions: this.buildGoalCurrencyOptions([])
    });
  },

  onGoalEditorNameInput(e) {
    this.setData({ goalEditorName: e.detail.value });
  },

  onGoalEditorAmountInput(e) {
    this.setData({ goalEditorAmount: e.detail.value });
  },

  onGoalEditorDateChange(e) {
    this.setData({ goalEditorDate: e.detail.value });
  },

  onGoalEditorRiskChange(e) {
    this.setData({ goalEditorRiskIndex: Number(e.detail.value || 0) });
  },

  toggleGoalEditorCurrency(e) {
    const code = String(e.currentTarget.dataset.code || '').toUpperCase();
    if (!code) return;
    const selected = new Set(this.data.goalEditorSelectedCodes || []);
    if (selected.has(code)) {
      selected.delete(code);
    } else if (selected.size < 4) {
      selected.add(code);
    }
    const nextSelected = Array.from(selected);
    this.setData({
      goalEditorSelectedCodes: nextSelected,
      goalCurrencyOptions: this.buildGoalCurrencyOptions(nextSelected)
    });
  },

  persistGoalBuckets(goalBuckets, successTitle) {
    const nextGoals = sortGoalBuckets(goalBuckets.map((goal, index) => normalizeGoalBucket(goal, index)).filter(goal => goal.targetAmount > 0));
    app.globalData.goalBuckets = nextGoals;
    app.globalData.depositTarget = nextGoals.reduce((sum, goal) => sum + Number(goal.targetAmount || 0), 0).toFixed(2);
    app.sync();
    this.calculateTargetProgress();
    if (successTitle) {
      wx.showToast({ title: successTitle, icon: 'success' });
    }
  },

  saveGoalBucket() {
    const name = String(this.data.goalEditorName || '').trim();
    const targetAmount = Number(this.data.goalEditorAmount || 0);
    if (!name) {
      wx.showToast({ title: '请输入目标名称', icon: 'none' });
      return;
    }
    if (!(targetAmount > 0)) {
      wx.showToast({ title: '请输入有效目标金额', icon: 'none' });
      return;
    }
    const riskMeta = GOAL_RISK_OPTIONS[Number(this.data.goalEditorRiskIndex || 0)] || GOAL_RISK_OPTIONS[1];
    const goalBuckets = deriveGoalBuckets(app.globalData.goalBuckets, app.globalData.depositTarget);
    const nextGoal = normalizeGoalBucket({
      id: this.data.editingGoalId || createGoalBucketId(),
      name,
      targetAmount,
      targetDate: this.data.goalEditorDate || formatDateInput(addMonths(new Date(), 12)),
      riskLevel: riskMeta.value,
      preferredCodes: this.data.goalEditorSelectedCodes || []
    }, goalBuckets.length);
    const existingIndex = goalBuckets.findIndex(item => item.id === nextGoal.id);
    const nextGoals = existingIndex >= 0
      ? goalBuckets.map(item => item.id === nextGoal.id ? nextGoal : item)
      : [...goalBuckets, nextGoal];
    this.persistGoalBuckets(nextGoals, existingIndex >= 0 ? '目标已更新' : '目标已新增');
    this.closeGoalEditor();
  },

  deleteGoalBucket(e) {
    const goalId = String(e.currentTarget.dataset.id || this.data.editingGoalId || '');
    if (!goalId) return;
    const goalBuckets = deriveGoalBuckets(app.globalData.goalBuckets, app.globalData.depositTarget);
    const currentGoal = goalBuckets.find(item => item.id === goalId);
    if (!currentGoal) return;
    wx.showModal({
      title: '删除目标桶',
      content: `确认删除“${currentGoal.name}”吗？`,
      success: (res) => {
        if (!res.confirm) return;
        const nextGoals = goalBuckets.filter(item => item.id !== goalId);
        this.persistGoalBuckets(nextGoals, '目标已删除');
        this.closeGoalEditor();
      }
    });
  },

  buildStressResultPayload(scenario, baseTotal, stressedTotal, deltaTotal, pnlPct, impactByCurrency) {
    const roundedBaseTotal = Number(baseTotal.toFixed(2));
    const roundedStressedTotal = Number(stressedTotal.toFixed(2));
    const roundedDeltaTotal = Number(deltaTotal.toFixed(2));
    const roundedPnlPct = Number(pnlPct.toFixed(2));
    const topImpacts = Object.keys(impactByCurrency)
      .map(code => ({ code, delta: Number(impactByCurrency[code].toFixed(2)) }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 3);
    const shocks = Object.keys(scenario.shocks || {}).map(code => ({
      code,
      pct: Number(scenario.shocks[code])
    }));

    return this.normalizeStressResult({
      scenarioKey: scenario.key || '',
      scenarioName: scenario.name || '未命名场景',
      timestamp: new Date().toLocaleString(),
      baseTotal: roundedBaseTotal,
      stressedTotal: roundedStressedTotal,
      deltaTotal: roundedDeltaTotal,
      pnlPct: roundedPnlPct,
      topImpacts,
      shocks,
      shockSummary: this.buildShockSummary(scenario.shocks || {})
    });
  },

  executeStressScenario(scenario) {
    const rates = this.data.rates || {};
    const bankCards = this.data.bankCards || [];
    const baseTotal = parseFloat(this.data.totalCny) || 0;

    if (!bankCards.length || baseTotal <= 0) {
      wx.showToast({ title: '暂无可测试资产', icon: 'none' });
      return;
    }

    const impactByCurrency = {};
    let deltaTotal = 0;

    bankCards.forEach(card => {
      (card.currencies || []).forEach(cur => {
        const code = String(cur.code || '').toUpperCase();
        const amount = parseFloat(cur.amount) || 0;
        if (!code || !amount) return;

        const currentRate = this.getRateByCode(rates, code);
        if (!currentRate) return;

        const shockPct = scenario.shocks.hasOwnProperty(code)
          ? Number(scenario.shocks[code])
          : Number(scenario.shocks.ALL || 0);

        if (!shockPct) return;

        const shockedRate = currentRate * (1 + shockPct / 100);
        const delta = amount * (shockedRate - currentRate);
        deltaTotal += delta;
        impactByCurrency[code] = (impactByCurrency[code] || 0) + delta;
      });
    });

    const stressedTotal = baseTotal + deltaTotal;
    const pnlPct = baseTotal > 0 ? (deltaTotal / baseTotal) * 100 : 0;
    const stressResult = this.buildStressResultPayload(scenario, baseTotal, stressedTotal, deltaTotal, pnlPct, impactByCurrency);

    this.persistStressState({ latestStressResult: stressResult });

    wx.showModal({
      title: `压力测试: ${scenario.name}`,
      content:
        `当前总资产：¥${baseTotal.toFixed(2)}\n` +
        `压力后总资产：¥${stressedTotal.toFixed(2)}\n` +
        `资产变化：${deltaTotal >= 0 ? '+' : ''}¥${deltaTotal.toFixed(2)} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)\n` +
        `主要影响：${stressResult.topImpacts.map(item => `${item.code}: ${item.deltaText}`).join(' | ') || '无明显影响'}`,
      showCancel: false,
      confirmText: '知道了'
    });
  },

  setDepositTarget() {
    this.openGoalEditor();
  },

  /**
   * 6. 删除卡片逻辑
   */
  deleteCard(e) {
    const cardId = e.currentTarget.dataset.cardid;
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定吗？',
      success: (res) => {
        if (res.confirm) {
          app.globalData.bankCards = app.globalData.bankCards.filter(c => c.id !== cardId);
          app.sync();
          this.loadAllData();
        }
      }
    });
  },

  /**
   * 7. 手势处理与导航
   */
  onTouchStart(e) { this.startX = e.touches[0].clientX; },
  onTouchMove(e) {
    let diff = this.startX - e.touches[0].clientX;
    this.setData({ moveDiff: diff });
  },
  onTouchEnd(e) {
    const { index } = e.currentTarget.dataset;
    const diff = this.data.moveDiff || 0;
    let bankCards = this.data.bankCards.map((item, i) => {
      item.showDelete = (i == index && diff > 80);
      return item;
    });
    this.setData({ bankCards, moveDiff: 0 });
  },
  closeAllDelete() {
    let bankCards = this.data.bankCards.map(item => {
      item.showDelete = false;
      return item;
    });
    this.setData({ bankCards });
  },

  gotoAddCard() { wx.navigateTo({ url: '/pages/addCard/addCard?mode=add' }); },
  gotoBankCardsPage() { wx.navigateTo({ url: '/pages/bankCards/bankCards' }); },
  gotoAccountDetail(e) {
    const { cardid } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/accountDetail/accountDetail?cardId=${cardid}` });
  },
  gotoRatesPage() { wx.navigateTo({ url: '/pages/rates/rates' }); },
  gotoDiagnostics() { wx.navigateTo({ url: '/pages/diagnostics/diagnostics' }); },
  gotoExport() {
    wx.navigateTo({
      url: '/pages/export/export',
      success: res => {
        res.eventChannel.emit('summaryData', {
          rateList: this.data.rateList,
          currencySummary: this.data.currencySummary,
          totalCny: this.data.totalCny
        });
      }
    });
  }
});