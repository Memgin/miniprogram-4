const app = getApp();
const exchangeRateUtil = require('../../utils/exchangeRate.js');

Page({
  data: {
    bankCards: [],
    rates: {},
    ratesLoaded: false,
    rateList: [],
    selectedRateList: [],
    currencySummary: [],
    totalCny: '0.00',
    updateTime: '',
    depositTarget: '',
    targetProgress: 0,
    targetDiff: 0,
    safeProgress: 0,
    progressStyle: 'width: 0%;',
    moveDiff: 0,
    isLoading: false,
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

  onShow() {
    this.closeAllDelete();
    this.setData({ 
      depositTarget: app.globalData.depositTarget 
    });
    this.loadAllData();
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

    try {
      // A. 获取汇率
      let rates = await exchangeRateUtil.getSinaRealTimeRates();
      
      // B. 校验汇率有效性
      if (!rates || Object.keys(rates).length <= 2) {
        rates = wx.getStorageSync('exchangeRates') || app.globalData.exchangeRates || { CNY: 1 };
      } else {
        app.globalData.exchangeRates = rates;
        wx.setStorageSync('exchangeRates', rates);
      }

      // C. 获取银行卡数据
      let bankCards = [...(app.globalData.bankCards || [])];
      if (bankCards.length === 0) {
        bankCards = wx.getStorageSync('bankCards') || [];
      }

      // D. 执行汇总计算
      const summaryResult = this.calculateSummary(rates, bankCards);
      const selectedRateList = this.getSelectedRateList(rates);

      // E. 格式化银行卡列表
      const formattedCards = bankCards.map(card => {
        let cardTotal = 0;
        card.currencies.forEach(cur => {
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
        updateTime: rates.updateTime || new Date().toLocaleString()
      });

      this.calculateTargetProgress();
    } catch (err) {
      console.error('loadAllData Error:', err);
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
      card.currencies.forEach(cur => {
        const amt = parseFloat(cur.amount) || 0;
        if (amt === 0) return;
        const c = cur.code.toLowerCase();
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
          name: currencyConfig[code].name,
          rate: parseFloat(rateVal).toFixed(4)
        };
      });
  },

  /**
   * 5. 存款目标与进度
   */
  calculateTargetProgress() {
    const { depositTarget, totalCny } = this.data;
    const total = parseFloat(totalCny) || 0;
    const target = parseFloat(depositTarget) || 0;
    
    if (target <= 0) {
      this.setData({ targetProgress: 0, progressStyle: 'width: 0%;', targetDiff: 0 });
      return;
    }
    
    const progress = (total / target) * 100;
    const safeProgress = Math.min(Math.max(progress, 0), 100);
    
    this.setData({
      targetProgress: progress.toFixed(1),
      targetDiff: (target - total).toFixed(2),
      safeProgress,
      progressStyle: `width: ${safeProgress}%;`
    });
  },

  setDepositTarget() {
    wx.showModal({
      title: '设置目标金额',
      editable: true,
      placeholderText: this.data.depositTarget || '请输入目标金额',
      success: (res) => {
        if (res.confirm && res.content) {
          const val = parseFloat(res.content);
          if (isNaN(val)) return;
          app.globalData.depositTarget = val.toFixed(2);
          app.sync(); 
          this.setData({ depositTarget: val.toFixed(2) });
          this.calculateTargetProgress();
        }
      }
    });
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
  gotoAccountDetail(e) {
    const { cardid } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/accountDetail/accountDetail?cardId=${cardid}` });
  },
  gotoRatesPage() { wx.navigateTo({ url: '/pages/rates/rates' }); },
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