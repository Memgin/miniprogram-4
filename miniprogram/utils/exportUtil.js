/**
 * 数据导出工具：文本/图片
 */

function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

function fillRoundRect(ctx, x, y, w, h, r, fillStyle) {
  ctx.save();
  ctx.setFillStyle(fillStyle);
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.restore();
}

function fitText(ctx, text, maxWidth) {
  const source = String(text || '');
  if (!source) return '';
  if (ctx.measureText(source).width <= maxWidth) return source;

  const ellipsis = '...';
  let left = 0;
  let right = source.length;
  let best = '';
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const candidate = source.slice(0, mid) + ellipsis;
    if (ctx.measureText(candidate).width <= maxWidth) {
      best = candidate;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  return best || ellipsis;
}

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

      const canvasWidth = 700;
      const cardX = 28;
      const cardWidth = canvasWidth - cardX * 2;
      const rowHeight = 42;
      const sectionGap = 24;

      const summaryCardHeight = 186;
      const rateSectionHeight = 104 + Math.max(1, rateList.length) * rowHeight + 14;
      const currencySectionHeight = 104 + Math.max(1, currencySummary.length) * rowHeight + 14;
      const footerHeight = 84;
      const dynamicHeight = Math.max(980, cardX + summaryCardHeight + sectionGap + rateSectionHeight + sectionGap + currencySectionHeight + sectionGap + footerHeight + cardX);

      const ctx = wx.createCanvasContext(canvasId);
      ctx.setTextBaseline('middle');

      // 背景
      const bg = ctx.createLinearGradient(0, 0, 0, dynamicHeight);
      bg.addColorStop(0, '#f8fafc');
      bg.addColorStop(1, '#eef2f7');
      ctx.setFillStyle(bg);
      ctx.fillRect(0, 0, canvasWidth, dynamicHeight);

      // 顶部总览卡
      let cursorY = cardX;
      fillRoundRect(ctx, cardX, cursorY, cardWidth, summaryCardHeight, 18, '#ffffff');

      const contentLeft = cardX + 28;
      const contentRight = cardX + cardWidth - 28;

      ctx.setTextAlign('left');
      ctx.setFillStyle('#111827');
      ctx.setFontSize(32);
      ctx.fillText('银行卡余额汇总', contentLeft, cursorY + 44);

      ctx.setFillStyle('#6b7280');
      ctx.setFontSize(20);
      const dateText = `生成时间 ${new Date().toLocaleString('zh-CN', { hour12: false })}`;
      ctx.fillText(dateText, contentLeft, cursorY + 80);

      ctx.setTextAlign('left');
      ctx.setFillStyle('#6b7280');
      ctx.setFontSize(22);
      ctx.fillText('人民币总计', contentLeft, cursorY + 136);

      ctx.setTextAlign('right');
      ctx.setFillStyle('#d84444');
      ctx.setFontSize(42);
      ctx.fillText(`¥${totalCny.toFixed(2)}`, contentRight, cursorY + 140);

      // 汇率卡
      cursorY += summaryCardHeight + sectionGap;
      fillRoundRect(ctx, cardX, cursorY, cardWidth, rateSectionHeight, 18, '#ffffff');

      ctx.setFillStyle('#111827');
      ctx.setFontSize(30);
      ctx.setTextAlign('left');
      ctx.fillText('实时汇率', contentLeft, cursorY + 40);

      ctx.setFillStyle('#9ca3af');
      ctx.setFontSize(20);
      ctx.fillText('数据源：新浪财经', contentLeft, cursorY + 74);

      let rowY = cursorY + 110;
      const rateSource = rateList.length ? rateList : [{ code: '--', rate: 0 }];
      rateSource.forEach((item, index) => {
        const code = String(item.code || '--').toUpperCase();
        const rateText = `1 ${code} = ¥${Number(item.rate || 0).toFixed(4)}`;

        if (index > 0) {
          ctx.setStrokeStyle('#f1f5f9');
          ctx.setLineWidth(1);
          ctx.beginPath();
          ctx.moveTo(contentLeft, rowY - 22);
          ctx.lineTo(contentRight, rowY - 22);
          ctx.stroke();
        }

        ctx.setTextAlign('left');
        ctx.setFillStyle('#374151');
        ctx.setFontSize(22);
        ctx.fillText(code, contentLeft, rowY);

        ctx.setTextAlign('right');
        ctx.setFillStyle('#111827');
        ctx.setFontSize(22);
        ctx.fillText(fitText(ctx, rateText, 360), contentRight, rowY);

        rowY += rowHeight;
      });

      // 币种余额卡
      cursorY += rateSectionHeight + sectionGap;
      fillRoundRect(ctx, cardX, cursorY, cardWidth, currencySectionHeight, 18, '#ffffff');

      ctx.setTextAlign('left');
      ctx.setFillStyle('#111827');
      ctx.setFontSize(30);
      ctx.fillText('币种余额', contentLeft, cursorY + 40);

      ctx.setFillStyle('#9ca3af');
      ctx.setFontSize(20);
      ctx.fillText(`共 ${currencySummary.length} 个币种`, contentLeft, cursorY + 74);

      rowY = cursorY + 110;
      const currencySource = currencySummary.length
        ? currencySummary
        : [{ name: '暂无数据', symbol: '--', totalAmount: 0, cnyAmount: 0 }];

      currencySource.forEach((item, index) => {
        if (index > 0) {
          ctx.setStrokeStyle('#f1f5f9');
          ctx.setLineWidth(1);
          ctx.beginPath();
          ctx.moveTo(contentLeft, rowY - 22);
          ctx.lineTo(contentRight, rowY - 22);
          ctx.stroke();
        }

        const currencyName = String(item.name || item.code || '未知币种');
        const currencySymbol = String(item.symbol || item.code || '--');
        const rightText = `${currencySymbol}${Number(item.totalAmount || 0).toFixed(2)} / ¥${Number(item.cnyAmount || 0).toFixed(2)}`;

        ctx.setTextAlign('left');
        ctx.setFillStyle('#374151');
        ctx.setFontSize(22);
        ctx.fillText(fitText(ctx, currencyName, 210), contentLeft, rowY);

        ctx.setTextAlign('right');
        ctx.setFillStyle('#111827');
        ctx.setFontSize(22);
        ctx.fillText(fitText(ctx, rightText, 360), contentRight, rowY);

        rowY += rowHeight;
      });

      // 底部注记
      cursorY += currencySectionHeight + sectionGap;
      ctx.setTextAlign('center');
      ctx.setFillStyle('#9ca3af');
      ctx.setFontSize(18);
      ctx.fillText('由小程序导出中心自动生成', canvasWidth / 2, cursorY + 24);

      // 绘制并导出
      ctx.draw(false, () => {
        wx.canvasToTempFilePath({
          canvasId: canvasId,
          width: canvasWidth,
          height: dynamicHeight,
          destWidth: canvasWidth * 2,
          destHeight: dynamicHeight * 2,
          success: (res) => resolve(res.tempFilePath),
          fail: (err) => reject(err)
        });
      });
    });
  }
};