/**
 * 数据导出工具：文本/图片
 */
module.exports = {
  // 导出为文本
  exportToText(summaryData) {
    const rateList = Array.isArray(summaryData.rateList) ? summaryData.rateList : [];
    const currencySummary = Array.isArray(summaryData.currencySummary) ? summaryData.currencySummary : [];
    const totalCny = Number(summaryData.totalCny || 0);
    let text = `=== 银行卡余额汇总（${new Date().toLocaleString()}） ===\n`;
    text += `【实时汇率（新浪财经）】\n`;
    rateList.forEach(item => {
      text += `1 ${String(item.code || '').toUpperCase()} = ¥${Number(item.rate || 0).toFixed(4)}\n`;
    });
    text += `\n【各币种总余额】\n`;
    currencySummary.forEach(item => {
      const currencyName = String(item.name || item.code || '未知币种');
      const currencySymbol = String(item.symbol || item.code || '--');
      text += `${currencyName}：${currencySymbol}${Number(item.totalAmount || 0).toFixed(2)} ≈ ¥${Number(item.cnyAmount || 0).toFixed(2)}\n`;
    });
    text += `\n【所有账户折合人民币总计】\n¥${totalCny.toFixed(2)}`;
    return text;
  },

  // 导出为图片（基于canvas）
  async exportToImage(canvasId, summaryData) {
    return new Promise((resolve, reject) => {
      const rateList = Array.isArray(summaryData.rateList) ? summaryData.rateList : [];
      const currencySummary = Array.isArray(summaryData.currencySummary) ? summaryData.currencySummary : [];
      const totalCny = Number(summaryData.totalCny || 0);
      const dynamicHeight = Math.max(900, 280 + rateList.length * 40 + currencySummary.length * 40 + 160);
      const ctx = wx.createCanvasContext(canvasId);
      // 画布背景
      ctx.setFillStyle('#fff');
      ctx.fillRect(0, 0, 700, dynamicHeight);
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
      rateList.forEach(item => {
        ctx.setFontSize(24);
        ctx.setFillStyle('#333');
        ctx.fillText(`1 ${String(item.code || '').toUpperCase()} = ¥${Number(item.rate || 0).toFixed(4)}`, 80, y);
        y += 40;
      });
      // 币种汇总标题
      ctx.setFontSize(28);
      ctx.setFillStyle('#666');
      ctx.fillText('各币种总余额：', 50, y + 20);
      y += 60;
      // 币种汇总列表
      currencySummary.forEach(item => {
        ctx.setFontSize(24);
        ctx.setFillStyle('#333');
        const currencyName = String(item.name || item.code || '未知币种');
        const currencySymbol = String(item.symbol || item.code || '--');
        const line = `${currencyName}：${currencySymbol}${Number(item.totalAmount || 0).toFixed(2)} ≈ ¥${Number(item.cnyAmount || 0).toFixed(2)}`;
        ctx.fillText(line, 80, y);
        y += 40;
      });
      // 总计
      ctx.setFontSize(30);
      ctx.setFillStyle('#52c41a');
      ctx.fillText(`总计：¥${totalCny.toFixed(2)}`, 80, y + 20);
      // 绘制并导出
      ctx.draw(false, () => {
        wx.canvasToTempFilePath({
          canvasId: canvasId,
          width: 700,
          height: dynamicHeight,
          destWidth: 700,
          destHeight: dynamicHeight,
          success: (res) => resolve(res.tempFilePath),
          fail: (err) => reject(err)
        });
      });
    });
  }
};