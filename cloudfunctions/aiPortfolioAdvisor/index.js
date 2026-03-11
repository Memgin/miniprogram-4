const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function buildExposureSummary(bankCards, currentRates) {
  const exposures = {};
  (Array.isArray(bankCards) ? bankCards : []).forEach((card) => {
    (card.currencies || []).forEach((currency) => {
      const code = String(currency.code || '').toUpperCase();
      const amount = Number(currency.amount || 0);
      const rate = Number((currentRates && (currentRates[code] || currentRates[code.toLowerCase()])) || (code === 'CNY' ? 1 : 0));
      if (!code || !Number.isFinite(amount) || !Number.isFinite(rate)) return;
      exposures[code] = (exposures[code] || 0) + amount * rate;
    });
  });
  return Object.keys(exposures)
    .map((code) => ({ code, cnyValue: Number(exposures[code].toFixed(2)) }))
    .sort((a, b) => b.cnyValue - a.cnyValue);
}

exports.main = async (event) => {
  try {
    const bankCards = Array.isArray(event.bankCards) ? event.bankCards : [];
    const currentRates = event.currentRates || {};
    const stressResult = event.stressResult || null;
    const riskSummary = event.riskSummary || null;

    const topExposures = buildExposureSummary(bankCards, currentRates);
    const largest = topExposures[0] || null;
    const second = topExposures[1] || null;
    const totalValue = topExposures.reduce((sum, item) => sum + item.cnyValue, 0);
    const concentration = largest && totalValue > 0 ? (largest.cnyValue / totalValue) * 100 : 0;
    const riskLevel = !riskSummary ? 'unknown' : (riskSummary.var95 > totalValue * 0.06 ? 'high' : riskSummary.var95 > totalValue * 0.03 ? 'medium' : 'low');

    const insights = [];
    const actions = [];

    if (largest) {
      insights.push(`当前最大敞口在 ${largest.code}，约占总资产 ${concentration.toFixed(1)}%。`);
    }
    if (second) {
      insights.push(`第二大敞口为 ${second.code}，组合分散度开始形成，但仍需观察主币种集中度。`);
    }
    if (riskSummary && Number(riskSummary.var95 || 0) > 0) {
      insights.push(`历史 VaR 95% 约为 ¥${Number(riskSummary.var95).toFixed(2)}，可视为单日尾部风险参考。`);
    }
    if (stressResult && Number(stressResult.deltaTotal || 0) < 0) {
      insights.push(`最近压力测试场景“${stressResult.scenarioName || '未命名场景'}”下组合回撤 ¥${Math.abs(Number(stressResult.deltaTotal || 0)).toFixed(2)}。`);
    }

    if (concentration >= 45) {
      actions.push('考虑增配与主敞口低相关的币种，降低单一币种驱动风险。');
    } else {
      actions.push('当前币种分布已具备一定缓冲，可重点关注高波动币种的择时。');
    }
    if (riskLevel === 'high') {
      actions.push('建议将压力测试设为常驻检查项，并优先为核心敞口设置阈值提醒。');
    } else {
      actions.push('可以把提醒阈值设置得更精细，例如 1% 到 1.5% 的波动带。');
    }
    if (stressResult && Number(stressResult.pnlPct || 0) < -2) {
      actions.push('最近压力测试显示回撤偏大，建议复盘是否存在同向敞口叠加。');
    }

    const headline = riskLevel === 'high'
      ? '组合进入高敏感区，建议先控波动再追收益'
      : riskLevel === 'medium'
        ? '组合风险可控，但核心敞口仍值得持续监控'
        : '组合整体较稳，可以把重心放在机会筛选与提醒自动化';

    return {
      success: true,
      generatedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
      headline,
      summary: `总资产约 ¥${totalValue.toFixed(2)}，主敞口 ${largest ? largest.code : '暂无'}，风险等级 ${riskLevel}。`,
      insights: insights.slice(0, 4),
      actions: actions.slice(0, 3)
    };
  } catch (error) {
    return {
      success: false,
      msg: error && error.message ? error.message : 'aiPortfolioAdvisor failed'
    };
  }
};
