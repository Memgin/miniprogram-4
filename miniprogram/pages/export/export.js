const exportUtil = require('../../utils/exportUtil.js');

const CURRENCY_META = {
  CNY: { name: '人民币', symbol: 'CNY' },
  USD: { name: '美元', symbol: 'USD' },
  HKD: { name: '港币', symbol: 'HKD' },
  EUR: { name: '欧元', symbol: 'EUR' },
  JPY: { name: '日元', symbol: 'JPY' },
  GBP: { name: '英镑', symbol: 'GBP' },
  CAD: { name: '加拿大元', symbol: 'CAD' },
  AUD: { name: '澳大利亚元', symbol: 'AUD' },
  NZD: { name: '新西兰元', symbol: 'NZD' },
  CHF: { name: '瑞士法郎', symbol: 'CHF' },
  SGD: { name: '新加坡元', symbol: 'SGD' },
  THB: { name: '泰铢', symbol: 'THB' },
  MYR: { name: '林吉特', symbol: 'RM' },
  KRW: { name: '韩元', symbol: 'KRW' }
};

Page({
  data: {
    navTitle: '数据导出',
    navStatusHeight: 20,
    navContentHeight: 44,
    navTotalHeight: 64,
    navCapsuleSpace: 96,
    summaryData: {}, // 汇总数据
    exportPreview: null,
    hasExportData: false
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

  getCurrencyMeta(code) {
    const upper = String(code || '').toUpperCase();
    return CURRENCY_META[upper] || { name: upper || '未知币种', symbol: upper || '--' };
  },

  normalizeSummaryData(rawData) {
    const summaryData = rawData && typeof rawData === 'object' ? rawData : {};
    return {
      rateList: Array.isArray(summaryData.rateList) ? summaryData.rateList.map(item => ({
        ...item,
        code: String(item.code || '').toUpperCase(),
        name: String(item.name || this.getCurrencyMeta(item.code).name),
        rate: Number(item.rate || 0)
      })).filter(item => item.code && item.rate > 0) : [],
      currencySummary: Array.isArray(summaryData.currencySummary) ? summaryData.currencySummary.map(item => ({
        ...item,
        code: String(item.code || item.symbol || '').toUpperCase(),
        name: String(item.name || this.getCurrencyMeta(item.code || item.symbol).name),
        symbol: String(item.symbol || this.getCurrencyMeta(item.code || item.symbol).symbol),
        totalAmount: Number(item.totalAmount || 0),
        cnyAmount: Number(item.cnyAmount || 0)
      })).filter(item => item.code && (item.totalAmount > 0 || item.cnyAmount > 0)) : [],
      totalCny: Number(summaryData.totalCny || 0)
    };
  },

  buildExportPreview(summaryData) {
    const topCurrency = (summaryData.currencySummary || []).slice().sort((left, right) => right.cnyAmount - left.cnyAmount)[0];
    return {
      rateCount: (summaryData.rateList || []).length,
      currencyCount: (summaryData.currencySummary || []).length,
      totalCnyText: `¥${Number(summaryData.totalCny || 0).toFixed(2)}`,
      topCurrencyText: topCurrency ? `${topCurrency.name} · ¥${Number(topCurrency.cnyAmount || 0).toFixed(2)}` : '暂无币种数据',
      previewRates: (summaryData.rateList || []).slice(0, 4).map((item) => ({
        ...item,
        rateText: Number(item.rate || 0).toFixed(4)
      })),
      previewCurrencies: (summaryData.currencySummary || []).slice(0, 5).map((item) => ({
        ...item,
        totalAmountText: Number(item.totalAmount || 0).toFixed(2),
        cnyAmountText: Number(item.cnyAmount || 0).toFixed(2)
      }))
    };
  },

  applySummaryData(rawData) {
    const summaryData = this.normalizeSummaryData(rawData);
    const hasExportData = Number(summaryData.totalCny || 0) > 0 || (summaryData.currencySummary || []).length > 0 || (summaryData.rateList || []).length > 0;
    this.setData({
      summaryData,
      exportPreview: hasExportData ? this.buildExportPreview(summaryData) : null,
      hasExportData
    });
  },

  onLoad() {
    this.initCustomNavBar();
    const eventChannel = this.getOpenerEventChannel();
    if (!eventChannel || !eventChannel.on) {
      this.applySummaryData({});
      return;
    }
    eventChannel.on('summaryData', (data) => {
      this.applySummaryData(data);
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

  exportText() {
    if (!this.data.hasExportData) {
      wx.showToast({ title: '暂无可导出数据', icon: 'none' });
      return;
    }
    const text = exportUtil.exportToText(this.data.summaryData);
    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showToast({ title: '文本已复制到剪贴板', icon: 'success' });
      },
      fail: () => {
        wx.showToast({ title: '导出失败', icon: 'none' });
      }
    });
  },

  async exportImage() {
    if (!this.data.hasExportData) {
      wx.showToast({ title: '暂无可导出数据', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '生成图片中...' });
    try {
      // 生成图片
      const tempFilePath = await exportUtil.exportToImage('exportCanvas', this.data.summaryData);
      // 保存到相册
      wx.saveImageToPhotosAlbum({
        filePath: tempFilePath,
        success: () => {
          wx.hideLoading();
          wx.showToast({ title: '图片已保存到相册', icon: 'success' });
        },
        fail: (err) => {
          wx.hideLoading();
          if (err.errMsg.includes('auth')) {
            wx.showModal({
              title: '需要权限',
              content: '请允许小程序访问相册，才能保存图片',
              success: () => {
                wx.openSetting();
              }
            });
          } else {
            wx.showToast({ title: '保存失败', icon: 'none' });
          }
        }
      });
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '生成图片失败', icon: 'none' });
      console.error(e);
    }
  },

  copySummarySnapshot() {
    const preview = this.data.exportPreview;
    if (!preview) {
      wx.showToast({ title: '暂无摘要可复制', icon: 'none' });
      return;
    }
    const text = [
      '=== 导出摘要 ===',
      `人民币总计：${preview.totalCnyText}`,
      `汇率条目：${preview.rateCount}`,
      `币种条目：${preview.currencyCount}`,
      `头部币种：${preview.topCurrencyText}`
    ].join('\n');
    wx.setClipboardData({
      data: text,
      success: () => wx.showToast({ title: '摘要已复制', icon: 'success' })
    });
  }
});