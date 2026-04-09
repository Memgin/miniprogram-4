const app = getApp();

Page({
  data: {
    navTitle: '云函数诊断',
    navStatusHeight: 20,
    navContentHeight: 44,
    navTotalHeight: 64,
    navCapsuleSpace: 96,
    diagnostics: [],
    diagnosticsSummary: null,
    lastResult: '',
    lastRunTitle: '',
    isRunning: false,
    runningKey: '',
    tushareToken: '',
    tushareStartDate: '',
    tushareEndDate: ''
  },

  onLoad() {
    this.initCustomNavBar();
  },

  onNavBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 });
      return;
    }
    wx.switchTab({ url: '/pages/index/index' });
  },

  onShow() {
    this.buildDiagnostics();
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

  buildDiagnostics() {
    const bankCards = Array.isArray(app.globalData.bankCards) ? app.globalData.bankCards : [];
    const alertRules = Array.isArray(app.globalData.alertRules) ? app.globalData.alertRules : [];
    const previous = this.data.diagnostics || [];
    const previousMap = previous.reduce((acc, item) => {
      acc[item.key] = item;
      return acc;
    }, {});

    const withState = (item) => ({
      ...item,
      status: previousMap[item.key] ? previousMap[item.key].status : 'idle',
      statusText: previousMap[item.key] ? previousMap[item.key].statusText : '未执行',
      summary: previousMap[item.key] ? previousMap[item.key].summary : '等待执行',
      checkedAt: previousMap[item.key] ? previousMap[item.key].checkedAt : ''
    });

    this.setData({
      diagnostics: [
        withState({ key: 'getUserProfile', title: '测试用户配置读取', desc: '检查 getUserProfile 是否能返回当前用户配置。' }),
        withState({ key: 'syncUserProfile', title: '测试用户配置写入', desc: '用当前本地数据回写 syncUserProfile，验证同步链路。' }),
        withState({ key: 'riskAnalyzer', title: '测试风险分析', desc: `当前基于 ${bankCards.length} 张卡片数据计算 VaR 与敞口。` }),
        withState({ key: 'aiPortfolioAdvisor', title: '测试组合建议', desc: '根据当前持仓、压力测试和风险结果生成建议。' }),
        withState({ key: 'alertMonitor', title: '测试提醒检查', desc: `使用当前 ${alertRules.length} 条提醒规则进行手动检查。` }),
        withState({ key: 'tushareImport', title: '运行 Tushare 导入', desc: '需要提供 token，执行后会写入 rates_history。' })
      ]
    }, () => this.refreshDiagnosticsSummary());
  },

  setDiagnosticState(key, patch) {
    const diagnostics = (this.data.diagnostics || []).map((item) => {
      if (item.key !== key) return item;
      return { ...item, ...patch };
    });
    this.setData({ diagnostics }, () => this.refreshDiagnosticsSummary());
  },

  refreshDiagnosticsSummary() {
    const diagnostics = this.data.diagnostics || [];
    const checkedItems = diagnostics.filter(item => item.checkedAt);
    this.setData({
      diagnosticsSummary: {
        totalCount: diagnostics.length,
        successCount: diagnostics.filter(item => item.status === 'success').length,
        errorCount: diagnostics.filter(item => item.status === 'error').length,
        latestCheckedAt: checkedItems.length ? checkedItems[checkedItems.length - 1].checkedAt : ''
      }
    });
  },

  onTokenInput(e) {
    this.setData({ tushareToken: e.detail.value || '' });
  },

  onStartDateInput(e) {
    this.setData({ tushareStartDate: e.detail.value || '' });
  },

  onEndDateInput(e) {
    this.setData({ tushareEndDate: e.detail.value || '' });
  },

  normalizeJson(result) {
    try {
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return String(result || '');
    }
  },

  summarizeResult(key, result) {
    const payload = result && result.result ? result.result : result;
    if (!payload || typeof payload !== 'object') return '无结构化结果';
    if (payload.success === false) return payload.msg || payload.errMsg || '执行失败';

    if (key === 'getUserProfile') {
      const data = payload.data || {};
      return `读取成功，银行卡 ${Array.isArray(data.bankCards) ? data.bankCards.length : 0} 张，提醒 ${Array.isArray(data.alertRules) ? data.alertRules.length : 0} 条。`;
    }
    if (key === 'syncUserProfile') {
      return '同步调用成功，已写回当前用户配置。';
    }
    if (key === 'riskAnalyzer') {
      return `VaR95 ${payload.var95 || 0}，波动率 ${payload.volatility || 0}，样本 ${payload.sampleSize || 0}。`;
    }
    if (key === 'aiPortfolioAdvisor') {
      return payload.headline || '建议生成成功。';
    }
    if (key === 'alertMonitor') {
      return `检查完成，命中 ${Array.isArray(payload.triggers) ? payload.triggers.length : 0} 条提醒。`;
    }
    if (key === 'tushareImport') {
      return `导入完成，新增 ${payload.inserted || 0}，更新 ${payload.updated || 0}。`;
    }
    return payload.success === false ? '执行失败' : '执行成功';
  },

  async executeDiagnostic(key) {
    if (key === 'getUserProfile') {
      return wx.cloud.callFunction({ name: 'getUserProfile' });
    }
    if (key === 'syncUserProfile') {
      return wx.cloud.callFunction({
        name: 'syncUserProfile',
        data: {
          bankCards: app.globalData.bankCards || [],
          depositTarget: app.globalData.depositTarget || '',
          goalBuckets: app.globalData.goalBuckets || [],
          selectedRateCodes: app.globalData.selectedRateCodes || ['usd', 'hkd'],
          savedStressScenarios: app.globalData.savedStressScenarios || [],
          latestStressResult: app.globalData.latestStressResult || null,
          alertRules: app.globalData.alertRules || [],
          alertHistory: app.globalData.alertHistory || [],
          lastAlertCheckAt: app.globalData.lastAlertCheckAt || '',
          latestRiskSummary: app.globalData.latestRiskSummary || null,
          latestAdvice: app.globalData.latestAdvice || null,
          fxOrderPlans: app.globalData.fxOrderPlans || [],
          cashflowPlans: app.globalData.cashflowPlans || [],
          maturityPlans: app.globalData.maturityPlans || [],
          privacyMode: !!app.globalData.privacyMode,
          biometricEnabled: !!app.globalData.biometricEnabled
        }
      });
    }
    if (key === 'riskAnalyzer') {
      return wx.cloud.callFunction({
        name: 'riskAnalyzer',
        data: {
          bankCards: app.globalData.bankCards || [],
          currentRates: app.globalData.exchangeRates || {}
        }
      });
    }
    if (key === 'aiPortfolioAdvisor') {
      return wx.cloud.callFunction({
        name: 'aiPortfolioAdvisor',
        data: {
          bankCards: app.globalData.bankCards || [],
          currentRates: app.globalData.exchangeRates || {},
          stressResult: app.globalData.latestStressResult || null,
          riskSummary: app.globalData.latestRiskSummary || null
        }
      });
    }
    if (key === 'alertMonitor') {
      return wx.cloud.callFunction({
        name: 'alertMonitor',
        data: {
          manual: true,
          alertRules: app.globalData.alertRules || [],
          currentRates: app.globalData.exchangeRates || {}
        }
      });
    }
    if (key === 'tushareImport') {
      if (!this.data.tushareToken) {
        throw new Error('请先输入 Tushare token');
      }
      return wx.cloud.callFunction({
        name: 'tushareImport',
        data: {
          api_name: 'fx_daily',
          token: this.data.tushareToken,
          start_date: this.data.tushareStartDate || undefined,
          end_date: this.data.tushareEndDate || undefined
        }
      });
    }
    throw new Error('未知诊断项');
  },

  async runOneDiagnostic(key) {
    const checkedAt = new Date().toLocaleString('zh-CN', { hour12: false });
    this.setDiagnosticState(key, { status: 'running', statusText: '执行中...', summary: '正在执行', checkedAt });
    try {
      const result = await this.executeDiagnostic(key);
      const payload = result && result.result ? result.result : result;
      const success = !(payload && payload.success === false);
      const summary = this.summarizeResult(key, result);
      this.setDiagnosticState(key, {
        status: success ? 'success' : 'error',
        statusText: success ? '成功' : '失败',
        summary,
        checkedAt
      });
      return { result, title: key, summary, success };
    } catch (error) {
      const summary = error && error.message ? error.message : String(error);
      this.setDiagnosticState(key, {
        status: 'error',
        statusText: '失败',
        summary,
        checkedAt
      });
      throw error;
    }
  },

  async runAllDiagnostics() {
    if (this.data.isRunning) return;
    this.setData({ isRunning: true, runningKey: 'all', lastResult: '', lastRunTitle: '批量诊断' });
    wx.showLoading({ title: '批量执行中...', mask: true });

    const keys = (this.data.diagnostics || []).map((item) => item.key).filter((key) => key !== 'tushareImport');
    const outputs = [];
    for (const key of keys) {
      try {
        const { result, summary } = await this.runOneDiagnostic(key);
        outputs.push(`【${key}】\n${summary}\n${this.normalizeJson(result && result.result ? result.result : result)}`);
      } catch (error) {
        outputs.push(`【${key}】\n${error && error.message ? error.message : String(error)}`);
      }
    }

    this.setData({
      isRunning: false,
      runningKey: '',
      lastResult: outputs.join('\n\n'),
      lastRunTitle: '批量诊断结果'
    });
    wx.hideLoading();
  },

  copyLastResult() {
    if (!this.data.lastResult) return;
    wx.setClipboardData({
      data: this.data.lastResult,
      success: () => {
        wx.showToast({ title: '结果已复制', icon: 'success' });
      }
    });
  },

  async runDiagnostic(e) {
    if (this.data.isRunning) return;
    const key = e.currentTarget.dataset.key;
    if (!key) return;

    const current = (this.data.diagnostics || []).find((item) => item.key === key);
    this.setData({ isRunning: true, runningKey: key, lastResult: '', lastRunTitle: current ? current.title : key });
    wx.showLoading({ title: '执行中...', mask: true });

    try {
      const { result } = await this.runOneDiagnostic(key);
      this.setData({ lastResult: this.normalizeJson(result && result.result ? result.result : result) });
    } catch (error) {
      wx.showToast({ title: error && error.message ? error.message : '执行失败', icon: 'none' });
      this.setData({ lastResult: this.normalizeJson({ success: false, error: error && error.errMsg ? error.errMsg : String(error) }) });
    } finally {
      this.setData({ isRunning: false, runningKey: '' });
      wx.hideLoading();
    }
  }
});