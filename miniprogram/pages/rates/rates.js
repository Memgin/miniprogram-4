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
    lockScroll: false
  },

  onLoad() {
    this.initAllRates();
  },

  /**
   * 1. 初始化汇率数据
   */
  async initAllRates() {
    try {
      wx.showLoading({ title: '同步汇率中...', mask: true });
      
      // A. 获取实时汇率
      const rawRates = await exchangeRateUtil.getSinaRealTimeRates();
      // 获取失败则尝试读取缓存
      const rates = (rawRates && Object.keys(rawRates).length > 2) ? rawRates : (wx.getStorageSync('exchangeRates') || { CNY: 1 });
      app.globalData.exchangeRates = rates;

      // B. 货币白名单
      const whitelist = ['USD', 'HKD', 'EUR', 'JPY', 'GBP', 'CAD', 'AUD', 'NZD', 'CHF', 'SGD', 'THB', 'MYR', 'KRW'];

      // C. 格式化并修复汇率保底逻辑
      const allValidRates = whitelist.map(code => {
        // 增强匹配逻辑
        const val = rates[code] || rates[code.toLowerCase()] || (code === 'MYR' ? (rates['RM'] || rates['rm']) : null);
        
        let finalRate = '1.0000';
        if (typeof val === 'number' && val !== 0) {
          finalRate = val.toFixed(4);
        } else if (code === 'CNY') {
          finalRate = '1.0000';
        } else {
          // 如果 EUR 获取失败，显示为 "---" 或保持上一次值，而不是错误地显示为 1
          finalRate = 'N/A'; 
        }

        return {
          code: code,
          rate: finalRate
        };
      });

      // D. 读取顺序 (统一转大写，防止脏数据)
      let selectedCodes = (app.globalData.selectedRateCodes || wx.getStorageSync('selectedRateCodes') || ['USD', 'HKD'])
        .filter(c => c && c !== 'UPDATETIME') // 物理剔除脏数据字段
        .map(c => c.toUpperCase());

      // E. 分类展示
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
   * 2. 交互逻辑 (拖拽部分保持不变)
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
   * 3. 增删逻辑
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
   * 4. 数据同步修复：对接 app.sync()
   */
  updateSelectedStorage(showingRates) {
    const selectedCodes = showingRates.map(item => item.code.toUpperCase());
    
    // 1. 更新全局和本地缓存
    app.globalData.selectedRateCodes = selectedCodes;
    wx.setStorageSync('selectedRateCodes', selectedCodes);
    
    // 2. 调用 app.js 中统一的同步函数进行云端备份
    app.sync(); 
    
    console.log('✅ 已触发全量同步:', selectedCodes);
  },

  showToast(text, icon = 'success') {
    this.setData({ toastVisible: true, toastText: text, toastIcon: icon });
    setTimeout(() => { this.setData({ toastVisible: false }); }, 1500);
  }
});