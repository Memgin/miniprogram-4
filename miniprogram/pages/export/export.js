const exportUtil = require('../../utils/exportUtil.js');

Page({
  data: {
    summaryData: {} // 汇总数据
  },

  onLoad() {
    // 接收汇总页传递的数据
    const eventChannel = this.getOpenerEventChannel();
    eventChannel.on('summaryData', (data) => {
      this.setData({ summaryData: data });
    });
  },

  // 导出为文本
  exportText() {
    const text = exportUtil.exportToText(this.data.summaryData);
    // 复制到剪贴板
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

  // 导出为图片
  async exportImage() {
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
  }
});