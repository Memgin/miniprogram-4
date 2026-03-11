const app = getApp();
const exchangeRateUtil = require('../../utils/exchangeRate.js');

Page({
  data: {
    showingRates: [],    
    optionalRates: [],   
    toastVisible: false,
    toastText: '',
    toastIcon: 'success',
    isDragging: false,
    currentIndex: -1,
    startY: 0,
    lockScroll: false,
    isAnalyzing: false // 新增：防止重复点击
  },

  onLoad() {
    this.initAllRates();
  },

  /**
   * 新增：AI 波动监测调用逻辑
   * 放在原有逻辑之后，不影响初始化
   */
  async runAIMonitor(e) {
    if (this.data.isAnalyzing) return;
    const { code } = e.currentTarget.dataset;
    if (!code) return;

    this.setData({ isAnalyzing: true });
    wx.showLoading({ title: 'AI 分析中...', mask: true });

    try {
      const fnCandidates = ['aiFxMonitor', 'aiOnnxInference'];
      let inferRes = null;
      let lastErr = null;

      for (const fnName of fnCandidates) {
        try {
          inferRes = await wx.cloud.callFunction({
            name: fnName,
            data: { symbol: code.toUpperCase(), seq_len: 20 }
          });
          break;
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
          spot_api: '实时数据',
          local_fallback: '本地兜底'
        };
        const sourceLabel = sourceMap[r.data_source] || '未知';

        wx.showModal({
          title: `AI监测: ${code.toUpperCase()}/CNY`,
          content:
            `当前价：${Number(r.current || 0).toFixed(4)}\n` +
            `预测下一价：${Number(r.pred || 0).toFixed(4)}\n` +
            `预期变动：${direction} ${Math.abs(expectedPct).toFixed(2)}%\n` +
            `波动率(年化)：${(Number(r.volatility || 0) * 100).toFixed(2)}%\n` +
            `风险等级：${riskLabel}\n` +
            `信号：${r.signal || 'unknown'}\n` +
            `数据来源：${sourceLabel}\n` +
            `模型：${r.method || 'unknown'}`,
          showCancel: false, confirmColor: '#07C160'
        });
      } else {
        wx.showToast({ title: inferRes.result?.msg || '预测失败', icon: 'none' });
      }
    } catch (err) {
      console.error('监测失败：', err);
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
   * 1. 初始化汇率数据 (保持不变)
   */
  async initAllRates() {
    // ... 你原有的代码内容 ...
    try {
      wx.showLoading({ title: '同步汇率中...', mask: true });
      const rawRates = await exchangeRateUtil.getSinaRealTimeRates();
      const rates = (rawRates && Object.keys(rawRates).length > 2) ? rawRates : (wx.getStorageSync('exchangeRates') || { CNY: 1 });
      app.globalData.exchangeRates = rates;
      const whitelist = ['USD', 'HKD', 'EUR', 'JPY', 'GBP', 'CAD', 'AUD', 'NZD', 'CHF', 'SGD', 'THB', 'MYR', 'KRW'];
      const allValidRates = whitelist.map(code => {
        const val = rates[code] || rates[code.toLowerCase()] || (code === 'MYR' ? (rates['RM'] || rates['rm']) : null);
        let finalRate = '1.0000';
        if (typeof val === 'number' && val !== 0) {
          finalRate = val.toFixed(4);
        } else if (code === 'CNY') {
          finalRate = '1.0000';
        } else {
          finalRate = 'N/A'; 
        }
        return { code: code, rate: finalRate };
      });
      let selectedCodes = (app.globalData.selectedRateCodes || wx.getStorageSync('selectedRateCodes') || ['USD', 'HKD'])
        .filter(c => c && c !== 'UPDATETIME')
        .map(c => c.toUpperCase());
      const showingRates = [];
      selectedCodes.forEach(code => {
        const match = allValidRates.find(item => item.code === code);
        if (match) showingRates.push(match);
      });
      const optionalRates = allValidRates.filter(item => !selectedCodes.includes(item.code));
      this.setData({ showingRates, optionalRates });
    } catch (err) {
      console.error('汇率初始化失败：', err);
      this.showToast('数据加载延迟', 'none');
    } finally {
      wx.hideLoading();
    }
  },

  /**
   * 2. 交互逻辑 (保持不变)
   */
  onTouchStart(e) {
    const { index } = e.currentTarget.dataset;
    const startY = e.touches[0].clientY;
    this.setData({ currentIndex: index, startY: startY, isDragging: false });
    this.longPressTimer = setTimeout(() => {
      wx.vibrateShort({ type: 'light' });
      this.setData({ isDragging: true, lockScroll: true, [`showingRates[${index}].dragging`]: true });
    }, 250);
  },

  onTouchMove(e) {
    if (!this.data.isDragging) return;
    const touchY = e.touches[0].clientY;
    const moveY = touchY - this.data.startY;
    const { currentIndex, showingRates } = this.data;
    const threshold = 30;
    if (moveY < -threshold && currentIndex > 0) {
      this.swapItems(currentIndex, currentIndex - 1, touchY);
    } else if (moveY > threshold && currentIndex < showingRates.length - 1) {
      this.swapItems(currentIndex, currentIndex + 1, touchY);
    }
  },

  swapItems(oldIdx,  newIdx, touchY) {
    const list = [...this.data.showingRates];
    [list[oldIdx], list[newIdx]] = [list[newIdx], list[oldIdx]];
    this.setData({ showingRates: list, currentIndex: newIdx, startY: touchY });
    wx.vibrateShort({ type: 'light' });
  },

  onTouchEnd() {
    clearTimeout(this.longPressTimer);
    if (!this.data.isDragging) return;
    const { currentIndex } = this.data;
    this.setData({ isDragging: false, currentIndex: -1, lockScroll: false, [`showingRates[${currentIndex}].dragging`]: false });
    this.updateSelectedStorage(this.data.showingRates);
    this.showToast('展示顺序已更新');
  },

  /**
   * 3. 增删逻辑 (保持不变)
   */
  onTapItem(e) {
    if (this.data.isDragging) return;
    const { code } = e.currentTarget.dataset;
    if (this.data.showingRates.length <= 1) {
      this.showToast('请至少保留一个币种', 'none');
      return;
    }
    const removeItem = this.data.showingRates.find(item => item.code === code);
    const newShowingRates = this.data.showingRates.filter(item => item.code !== code);
    const newOptionalRates = [...this.data.optionalRates.filter(i => i.code !== code), removeItem];
    this.setData({ showingRates: newShowingRates, optionalRates: newOptionalRates });
    this.updateSelectedStorage(newShowingRates);
  },

  addToShow(e) {
    const { code } = e.currentTarget.dataset;
    const addItem = this.data.optionalRates.find(item => item.code === code);
    if (!addItem) return;
    const newShowingRates = [...this.data.showingRates, addItem];
    const newOptionalRates = this.data.optionalRates.filter(item => item.code !== code);
    this.setData({ showingRates: newShowingRates, optionalRates: newOptionalRates });
    this.updateSelectedStorage(newShowingRates);
  },

  /**
   * 4. 数据同步修复 (保持不变)
   */
  updateSelectedStorage(showingRates) {
    const selectedCodes = showingRates.map(item => item.code.toUpperCase());
    app.globalData.selectedRateCodes = selectedCodes;
    wx.setStorageSync('selectedRateCodes', selectedCodes);
    app.sync(); 
    console.log('✅ 已触发全量同步:', selectedCodes);
  },

  showToast(text, icon = 'success') {
    this.setData({ toastVisible: true, toastText: text, toastIcon: icon });
    setTimeout(() => { this.setData({ toastVisible: false }); }, 1500);
  }
});
