/**
 * 数据导出工具：文本/图片
 */
module.exports = {
  // 导出为文本
  exportToText(summaryData) {
    let text = `=== 银行卡余额汇总（${new Date().toLocaleString()}） ===\n`;
    text += `【实时汇率（新浪财经）】\n`;
    summaryData.rateList.forEach(item => {
      text += `1 ${item.code.toUpperCase()} = ¥${item.rate.toFixed(4)}\n`;
    });
    text += `\n【各币种总余额】\n`;
    summaryData.currencySummary.forEach(item => {
      text += `${item.name}：${item.symbol}${item.totalAmount.toFixed(2)} ≈ ¥${item.cnyAmount.toFixed(2)}\n`;
    });
    text += `\n【所有账户折合人民币总计】\n¥${summaryData.totalCny.toFixed(2)}`;
    return text;
  },

  // 导出为图片（基于canvas）
  async exportToImage(canvasId, summaryData) {
    return new Promise((resolve, reject) => {
      const ctx = wx.createCanvasContext(canvasId);
      // 画布背景
      ctx.setFillStyle('#fff');
      ctx.fillRect(0, 0, 700, 900);
      // 标题
      ctx.setFontSize(32);
      ctx.setFillStyle('#333');
      ctx.setTextAlign('center');
      ctx.fillText(`银行卡余额汇总（${new Date().toLocaleDateString()}）`, 350, 60);
      // 汇率标题
      ctx.setFontSize(28);
      ctx.setFillStyle('#666');
      ctx.setTextAlign('left');
      ctx.fillText('实时汇率（新浪财经）：', 50, 120);
      // 汇率列表
      let y = 160;
      summaryData.rateList.forEach(item => {
        ctx.setFontSize(24);
        ctx.setFillStyle('#333');
        ctx.fillText(`1 ${item.code.toUpperCase()} = ¥${item.rate.toFixed(4)}`, 80, y);
        y += 40;
      });
      // 币种汇总标题
      ctx.setFontSize(28);
      ctx.setFillStyle('#666');
      ctx.fillText('各币种总余额：', 50, y + 20);
      y += 60;
      // 币种汇总列表
      summaryData.currencySummary.forEach(item => {
        ctx.setFontSize(24);
        ctx.setFillStyle('#333');
        const line = `${item.name}：${item.symbol}${item.totalAmount.toFixed(2)} ≈ ¥${item.cnyAmount.toFixed(2)}`;
        ctx.fillText(line, 80, y);
        y += 40;
      });
      // 总计
      ctx.setFontSize(30);
      ctx.setFillStyle('#52c41a');
      ctx.fillText(`总计：¥${summaryData.totalCny.toFixed(2)}`, 80, y + 20);
      // 绘制并导出
      ctx.draw(false, () => {
        wx.canvasToTempFilePath({
          canvasId: canvasId,
          width: 700,
          height: 900,
          destWidth: 700,
          destHeight: 900,
          success: (res) => resolve(res.tempFilePath),
          fail: (err) => reject(err)
        });
      });
    });
  }
};