// app.js

App({
  globalData: {
    bankCards: [],           // 银行卡列表
    depositTarget: '',       // 存款目标
    selectedRateCodes: [],   // 用户选中的汇率代码（首页汇率列表用）
    savedStressScenarios: [],
    latestStressResult: null,
    alertRules: [],
    alertHistory: [],
    lastAlertCheckAt: '',
    latestRiskSummary: null,
    latestAdvice: null,
    privacyMode: false,
    biometricEnabled: false,
    exchangeRates: { cny: 1 }, // 实时汇率表
    _syncTimer: null         // 全局同步防抖定时器
  },

  onLaunch() {
    if (wx.cloud) {
      wx.cloud.init({
        env: 'cloud1-5ggg03ctd1511d28',
        traceUser: true
      });
    }
    this.loadLocalCache();
    this.initData();
  },

  loadLocalCache() {
    try {
      this.globalData.bankCards = wx.getStorageSync('bankCards') || [];
      this.globalData.depositTarget = wx.getStorageSync('depositTarget') || '';
      this.globalData.selectedRateCodes = wx.getStorageSync('selectedRateCodes') || ['usd', 'hkd'];
      this.globalData.savedStressScenarios = wx.getStorageSync('savedStressScenarios') || [];
      this.globalData.latestStressResult = wx.getStorageSync('latestStressResult') || null;
      this.globalData.alertRules = wx.getStorageSync('alertRules') || [];
      this.globalData.alertHistory = wx.getStorageSync('alertHistory') || [];
      this.globalData.lastAlertCheckAt = wx.getStorageSync('lastAlertCheckAt') || '';
      this.globalData.latestRiskSummary = wx.getStorageSync('latestRiskSummary') || null;
      this.globalData.latestAdvice = wx.getStorageSync('latestAdvice') || null;
      this.globalData.privacyMode = !!wx.getStorageSync('privacyMode');
      this.globalData.biometricEnabled = !!wx.getStorageSync('biometricEnabled');
      console.log('📦 本地缓存加载完成');
    } catch (e) {
      console.error('读取缓存失败', e);
    }
  },

  async initData() {
    try {
      console.log('🔄 开始从云端拉取 getUserProfile...');
      const res = await wx.cloud.callFunction({ name: 'getUserProfile' });
      console.log('🔄 getUserProfile 返回结果:', res);
      if (res.result?.success) {
        const cloudData = res.result.data;
        this.globalData.bankCards = cloudData.bankCards || [];
        this.globalData.depositTarget = cloudData.depositTarget || '';
        this.globalData.selectedRateCodes = (cloudData.selectedRateCodes || ['usd', 'hkd']).map(code => String(code || '').toLowerCase());
        this.globalData.savedStressScenarios = cloudData.savedStressScenarios || [];
        this.globalData.latestStressResult = cloudData.latestStressResult || null;
        this.globalData.alertRules = Array.isArray(cloudData.alertRules) ? cloudData.alertRules : [];
        this.globalData.alertHistory = Array.isArray(cloudData.alertHistory) ? cloudData.alertHistory : [];
        this.globalData.lastAlertCheckAt = cloudData.lastAlertCheckAt || '';
        this.globalData.latestRiskSummary = cloudData.latestRiskSummary || null;
        this.globalData.latestAdvice = cloudData.latestAdvice || null;
        this.globalData.privacyMode = !!cloudData.privacyMode;
        this.globalData.biometricEnabled = !!cloudData.biometricEnabled;
        
        this.updateStorage();
        console.log('✅ 云端数据对齐完成', cloudData);
        if (this.dataReadyCallback) this.dataReadyCallback();
      } else {
        console.warn('⚠️ getUserProfile 返回了非 success 状态:', res);
      }
    } catch (e) {
      console.error('☁️ 云端拉取失败详细错误:', e);
    }
  },

  async init() {
    await this.initData();
  },

  /**
   * 核心同步逻辑
   */
  sync() {
    // 1. 整理历史记录
    this.recordCardHistory();
    // 2. 更新本地缓存
    this.updateStorage();
    
    // 3. 防抖同步到云端
    if (this.globalData._syncTimer) clearTimeout(this.globalData._syncTimer);
    this.globalData._syncTimer = setTimeout(async () => {
      console.log('☁️ 正在同步全量数据（含图表选中状态）到云端...');
      try {
        await wx.cloud.callFunction({
          name: 'syncUserProfile',
          data: {
            bankCards: this.globalData.bankCards, // 这里的 card 对象现在包含了 selectedCodes
            depositTarget: this.globalData.depositTarget,
            selectedRateCodes: this.globalData.selectedRateCodes,
            savedStressScenarios: this.globalData.savedStressScenarios,
            latestStressResult: this.globalData.latestStressResult,
            alertRules: this.globalData.alertRules,
            alertHistory: this.globalData.alertHistory,
            lastAlertCheckAt: this.globalData.lastAlertCheckAt,
            latestRiskSummary: this.globalData.latestRiskSummary,
            latestAdvice: this.globalData.latestAdvice,
            privacyMode: this.globalData.privacyMode,
            biometricEnabled: this.globalData.biometricEnabled
          }
        });
        console.log('✨ 云端同步一致');
      } catch (err) {
        console.error('❌ 云端同步失败:', err);
      }
    }, 1500);
  },

  /**
   * 整理历史记录并保持字段完整性
   */
  recordCardHistory() {
    const now = new Date();
    const today = now.getFullYear() + '-' + 
                  String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                  String(now.getDate()).padStart(2, '0');
    
    this.globalData.bankCards = this.globalData.bankCards.map(card => {
      if (!card.history) card.history = [];
      
      const cleanMap = {};
      // 1. 归一化旧历史
      card.history.forEach(h => {
        if (!h.date) return;
        const pts = h.date.split(/[\/\-]/);
        const standardKey = pts[0] + '-' + String(pts[1]).padStart(2, '0') + '-' + String(pts[2]).padStart(2, '0');
        cleanMap[standardKey] = Object.assign({}, h, { date: standardKey });
      });

      // 2. 生成今日快照
      const snapshot = { date: today };
      if (card.currencies) {
        card.currencies.forEach(cur => {
          snapshot[cur.code.toLowerCase()] = parseFloat(cur.amount) || 0;
        });
      }
      cleanMap[today] = snapshot;

      // 3. 排序并写回，同时保留 card 对象上的其他非历史字段（如 selectedCodes）
      let sorted = Object.keys(cleanMap).sort().map(k => cleanMap[k]);
      card.history = sorted.slice(-30);

      return card;
    });
  },

  updateStorage() {
    try {
      wx.setStorageSync('bankCards', this.globalData.bankCards);
      wx.setStorageSync('depositTarget', this.globalData.depositTarget);
      wx.setStorageSync('selectedRateCodes', this.globalData.selectedRateCodes);
      wx.setStorageSync('savedStressScenarios', this.globalData.savedStressScenarios);
      wx.setStorageSync('latestStressResult', this.globalData.latestStressResult);
      wx.setStorageSync('alertRules', this.globalData.alertRules);
      wx.setStorageSync('alertHistory', this.globalData.alertHistory);
      wx.setStorageSync('lastAlertCheckAt', this.globalData.lastAlertCheckAt);
      wx.setStorageSync('latestRiskSummary', this.globalData.latestRiskSummary);
      wx.setStorageSync('latestAdvice', this.globalData.latestAdvice);
      wx.setStorageSync('privacyMode', this.globalData.privacyMode);
      wx.setStorageSync('biometricEnabled', this.globalData.biometricEnabled);
    } catch (e) {
      console.error('本地持久化失败', e);
    }
  },

  checkDuplicateCard(name, excludeId = '') {
    return this.globalData.bankCards.find(c => c.name === name && c.id !== excludeId);
  }
})