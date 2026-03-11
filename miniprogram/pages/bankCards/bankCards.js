import * as echarts from '../../components/ec-canvas/echarts';

const app = getApp();

function initChart(canvas, width, height, dpr) {
  const chart = echarts.init(canvas, null, {
    width,
    height,
    devicePixelRatio: dpr
  });
  canvas.setChart(chart);
  return chart;
}

Page({
  data: {
    bankCards: [],
    currencySummary: [],
    totalCny: '0.00',
    cardCount: 0,
    currencyAccountCount: 0,
    uniqueCurrencyCount: 0,
    privacyMode: false,
    biometricEnabled: false,
    topCurrencyExposureText: '暂无数据',
    topCardName: '--',
    topCardValueText: '¥0.00',
    averageAssetText: '¥0.00',
    dashboardTone: 'calm',
    latestRiskSummary: null,
    riskBandScore: 12,
    riskBandLabel: '稳态',
    riskBandSummary: '当前资产分布相对均衡。',
    riskBandLeft: '12%',
    riskBandDrivers: [],
    heatmapXAxis: [],
    heatmapYAxis: [],
    heatmapData: [],
    heatmapRows: [],
    sankeyNodes: [],
    sankeyLinks: [],
    fundsFlowCards: [],
    fundsFlowCurrencies: [],
    shockCurrencyOptions: [],
    shockCurrencyLabels: [],
    shockCodeIndex: 0,
    shockPct: 0,
    shockPctText: '0%',
    shockImpactSummary: null,
    shockImpactedCards: [],
    shockAlertHits: [],
    ecAssetHeatmap: { lazyLoad: true },
    ecFundsFlow: { lazyLoad: true }
  },

  onLoad() {
    this.setData({
      shockCurrencyOptions: [],
      shockCurrencyLabels: []
    });
  },

  onShow() {
    this.loadBankCards();
  },

  normalizeCurrencyCode(code) {
    const upper = String(code || '').toUpperCase();
    return upper === 'RM' ? 'MYR' : upper;
  },

  getRateByCode(rates, code) {
    const upper = this.normalizeCurrencyCode(code);
    return Number(rates[upper] || rates[upper.toLowerCase()] || (upper === 'CNY' ? 1 : 0)) || 0;
  },

  buildCardCurrencyExposureMap(card, rates) {
    const exposureMap = {};
    const currencies = Array.isArray(card.currencies) ? card.currencies : [];
    currencies.forEach((currency) => {
      const code = this.normalizeCurrencyCode(currency.code);
      const amount = Number(currency.amount || 0);
      if (!amount) return;
      exposureMap[code] = (exposureMap[code] || 0) + amount * this.getRateByCode(rates, code);
    });
    return exposureMap;
  },

  buildSummary(bankCards, rates) {
    const exposureMap = {};
    const currencyTotals = {};
    let totalCny = 0;
    let currencyAccountCount = 0;

    const cards = (bankCards || []).map((card) => {
      let cardTotal = 0;
      const currencies = Array.isArray(card.currencies) ? card.currencies : [];
      currencyAccountCount += currencies.length;
      currencies.forEach((currency) => {
        const code = this.normalizeCurrencyCode(currency.code);
        const amount = Number(currency.amount || 0);
        const rate = this.getRateByCode(rates, code);
        const cnyValue = amount * rate;
        cardTotal += cnyValue;
        if (amount) {
          exposureMap[code] = (exposureMap[code] || 0) + cnyValue;
          currencyTotals[code] = (currencyTotals[code] || 0) + amount;
        }
      });
      totalCny += cardTotal;
      return {
        ...card,
        totalCny: cardTotal.toFixed(2),
        currencyCount: currencies.length,
        currencyExposureMap: this.buildCardCurrencyExposureMap(card, rates),
        previewCurrencies: currencies.slice(0, 4).map((currency) => ({
          code: this.normalizeCurrencyCode(currency.code),
          amount: Number(currency.amount || 0).toFixed(2)
        }))
      };
    }).sort((a, b) => Number(b.totalCny) - Number(a.totalCny));

    const currencySummary = Object.keys(currencyTotals)
      .sort((a, b) => {
        const aValue = (currencyTotals[a] || 0) * this.getRateByCode(rates, a);
        const bValue = (currencyTotals[b] || 0) * this.getRateByCode(rates, b);
        return bValue - aValue;
      })
      .map((code) => ({
        code,
        totalAmount: Number(currencyTotals[code] || 0).toFixed(2),
        cnyAmount: Number((currencyTotals[code] || 0) * this.getRateByCode(rates, code)).toFixed(2)
      }));

    const topExposure = Object.keys(exposureMap)
      .map((code) => ({ code, cnyValue: exposureMap[code] }))
      .sort((a, b) => b.cnyValue - a.cnyValue)[0];

    const topCard = cards[0];
    const averageAsset = cards.length ? totalCny / cards.length : 0;

    return {
      cards,
      currencySummary,
      totalCny: totalCny.toFixed(2),
      cardCount: cards.length,
      currencyAccountCount,
      uniqueCurrencyCount: Object.keys(exposureMap).length,
      topCurrencyExposureText: topExposure ? `${topExposure.code} · ¥${Number(topExposure.cnyValue || 0).toFixed(2)}` : '暂无数据',
      topCardName: topCard ? topCard.name : '--',
      topCardValueText: `¥${topCard ? topCard.totalCny : '0.00'}`,
      averageAssetText: `¥${averageAsset.toFixed(2)}`,
      dashboardTone: totalCny >= 50000 ? 'strong' : totalCny >= 15000 ? 'active' : 'calm'
    };
  },

  normalizeRiskSummary(summary) {
    if (!summary || typeof summary !== 'object') return null;
    const totalValue = Number(summary.totalValue || 0);
    const var95 = Number(summary.var95 || 0);
    const volatility = Number(summary.volatility || 0);
    const topExposures = (Array.isArray(summary.topExposures) ? summary.topExposures : []).map((item) => ({
      code: this.normalizeCurrencyCode(item.code),
      cnyValue: Number(item.cnyValue || 0),
      cnyText: `¥${Number(item.cnyValue || 0).toFixed(2)}`
    }));
    const riskContributions = (Array.isArray(summary.riskContributions) ? summary.riskContributions : []).map((item) => ({
      code: this.normalizeCurrencyCode(item.code),
      contributionPct: Number(item.contributionPct || 0),
      contributionText: `${Number(item.contributionPct || 0).toFixed(1)}%`,
      weightPct: Number(item.weightPct || 0),
      weightText: `${Number(item.weightPct || 0).toFixed(1)}%`,
      assetVol: Number(item.assetVol || 0)
    }));
    const portfolioSeries = summary.portfolioSeries && typeof summary.portfolioSeries === 'object'
      ? summary.portfolioSeries
      : {};
    return {
      totalValue,
      var95,
      volatility,
      portfolioSeries: {
        labels: Array.isArray(portfolioSeries.labels) ? portfolioSeries.labels : [],
        values: Array.isArray(portfolioSeries.values) ? portfolioSeries.values.map((item) => Number(item || 0)) : []
      },
      topExposures,
      riskContributions
    };
  },

  buildRiskBandState(risk, summary) {
    const totalValue = Number((risk && risk.totalValue) || Number(summary.totalCny || 0) || 0);
    const topExposure = risk && Array.isArray(risk.topExposures) && risk.topExposures.length ? risk.topExposures[0] : null;
    const topContribution = risk && Array.isArray(risk.riskContributions) && risk.riskContributions.length ? risk.riskContributions[0] : null;
    const concentration = topExposure && totalValue > 0 ? topExposure.cnyValue / totalValue : 0;
    const varRatio = totalValue > 0 ? Number((risk && risk.var95) || 0) / totalValue : 0;
    const volatility = Number((risk && risk.volatility) || 0);
    const score = Math.max(8, Math.min(96, Math.round(concentration * 45 + varRatio * 850 + volatility * 220)));

    let label = '稳态';
    let summaryText = '当前资产分布相对均衡。';
    if (score >= 72) {
      label = '高风险';
      summaryText = '敞口集中度和波动压力都偏高，建议优先做守护。';
    } else if (score >= 48) {
      label = '关注';
      summaryText = '组合进入敏感区，建议结合压力测试观察。';
    }

    const drivers = [
      `集中度 ${(concentration * 100).toFixed(1)}%`,
      `VaR95 ${(varRatio * 100).toFixed(2)}%`,
      `波动率 ${(volatility * 100).toFixed(2)}%`
    ];
    if (topContribution) {
      drivers.push(`${topContribution.code} 风险贡献 ${topContribution.contributionText}`);
    }

    return {
      riskBandScore: score,
      riskBandLabel: label,
      riskBandSummary: summaryText,
      riskBandLeft: `${score}%`,
      riskBandDrivers: drivers.slice(0, 4)
    };
  },

  buildHeatmapPayload(cards, currencySummary) {
    const heatmapXAxis = cards.map((card) => card.name || '未命名');
    const heatmapYAxis = currencySummary.map((item) => item.code);
    const heatmapData = [];
    const maxValue = Math.max(
      ...cards.flatMap((card) => heatmapYAxis.map((code) => Number((card.currencyExposureMap && card.currencyExposureMap[code]) || 0))),
      1
    );
    cards.forEach((card, cardIndex) => {
      heatmapYAxis.forEach((code, currencyIndex) => {
        const exposure = Number((card.currencyExposureMap && card.currencyExposureMap[code]) || 0);
        heatmapData.push([cardIndex, currencyIndex, Number(exposure.toFixed(2))]);
      });
    });
    const heatmapRows = heatmapYAxis.map((code) => ({
      code,
      cells: cards.map((card) => {
        const exposure = Number((card.currencyExposureMap && card.currencyExposureMap[code]) || 0);
        const ratio = maxValue > 0 ? exposure / maxValue : 0;
        const alpha = exposure > 0 ? Math.min(0.92, 0.14 + ratio * 0.78) : 0.06;
        return {
          cardId: card.id,
          cardName: card.name || '未命名',
          shortName: String(card.name || '未命名').slice(0, 6),
          value: exposure,
          valueText: `¥${exposure.toFixed(0)}`,
          style: `background: rgba(15, 118, 110, ${alpha.toFixed(2)}); color: ${alpha > 0.55 ? '#ffffff' : '#0f172a'};`
        };
      })
    }));
    return { heatmapXAxis, heatmapYAxis, heatmapData, heatmapRows };
  },

  buildSankeyPayload(cards, currencySummary) {
    const nodes = [{ name: '总资产' }];
    const links = [];
    cards.forEach((card) => {
      const cardNode = `CARD_${card.id}`;
      nodes.push({ name: cardNode, displayName: card.name || '未命名银行卡' });
      links.push({ source: '总资产', target: cardNode, value: Number(card.totalCny || 0) });
      currencySummary.forEach((currency) => {
        const exposure = Number((card.currencyExposureMap && card.currencyExposureMap[currency.code]) || 0);
        if (!exposure) return;
        const currencyNode = `CUR_${currency.code}`;
        if (!nodes.find((item) => item.name === currencyNode)) {
          nodes.push({ name: currencyNode, displayName: currency.code });
        }
        links.push({ source: cardNode, target: currencyNode, value: Number(exposure.toFixed(2)) });
      });
    });
    return { sankeyNodes: nodes, sankeyLinks: links };
  },

  buildFundsFlowPayload(cards, currencySummary, totalCny) {
    const total = Math.max(Number(totalCny || 0), 1);
    return {
      fundsFlowCards: cards.map((card) => {
        const value = Number(card.totalCny || 0);
        const width = Math.max(12, Math.min(100, (value / total) * 100));
        return {
          id: card.id,
          name: card.name || '未命名银行卡',
          valueText: `¥${value.toFixed(2)}`,
          width: `${width.toFixed(2)}%`
        };
      }),
      fundsFlowCurrencies: currencySummary.map((currency) => {
        const value = Number(currency.cnyAmount || 0);
        const width = Math.max(12, Math.min(100, (value / total) * 100));
        return {
          code: currency.code,
          valueText: `¥${value.toFixed(2)}`,
          width: `${width.toFixed(2)}%`
        };
      })
    };
  },

  buildShockPreview(code, pct) {
    const shockCode = this.normalizeCurrencyCode(code);
    const numericPct = Number(pct || 0);
    const ratio = numericPct / 100;
    const impactedCards = (this.data.bankCards || [])
      .map((card) => {
        const baseExposure = Number((card.currencyExposureMap && card.currencyExposureMap[shockCode]) || 0);
        const delta = baseExposure * ratio;
        const nextValue = Number(card.totalCny || 0) + delta;
        return {
          id: card.id,
          name: card.name,
          exposureText: `¥${baseExposure.toFixed(2)}`,
          delta,
          deltaText: `${delta >= 0 ? '+' : ''}¥${delta.toFixed(2)}`,
          nextValueText: `¥${nextValue.toFixed(2)}`,
          barWidth: `${Math.max(10, Math.min(100, Math.abs(delta) / Math.max(Number(this.data.totalCny || 1) * 0.01, 1) * 8))}%`,
          tone: delta >= 0 ? 'up' : 'down'
        };
      })
      .filter((item) => Math.abs(item.delta) > 0.001)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    const totalExposure = impactedCards.reduce((sum, item) => sum + (item.delta / ratio || 0), 0);
    const totalDelta = totalExposure * ratio;
    const nextTotal = Number(this.data.totalCny || 0) + totalDelta;
    const alertHits = (app.globalData.alertRules || [])
      .filter((rule) => this.normalizeCurrencyCode(rule.code) === shockCode)
      .slice(0, 3)
      .map((rule) => ({
        id: String(rule.id || ''),
        note: String(rule.note || `${shockCode} 提醒`),
        directionText: String(rule.direction || 'above') === 'below' ? '低于' : '高于',
        thresholdText: Number(rule.threshold || 0).toFixed(4)
      }));

    return {
      shockImpactSummary: {
        code: shockCode,
        pctText: `${numericPct > 0 ? '+' : ''}${numericPct}%`,
        deltaText: `${totalDelta >= 0 ? '+' : ''}¥${totalDelta.toFixed(2)}`,
        nextTotalText: `¥${nextTotal.toFixed(2)}`
      },
      shockImpactedCards: impactedCards.slice(0, 6),
      shockAlertHits: alertHits
    };
  },

  applyShockPreview(code, pct) {
    const preview = this.buildShockPreview(code, pct);
    this.setData({
      shockPct: Number(pct || 0),
      shockPctText: `${Number(pct || 0) > 0 ? '+' : ''}${Number(pct || 0)}%`,
      shockImpactSummary: preview.shockImpactSummary,
      shockImpactedCards: preview.shockImpactedCards,
      shockAlertHits: preview.shockAlertHits
    });
  },

  async loadRiskSummary(bankCards, rates, summary) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'riskAnalyzer',
        data: {
          bankCards,
          currentRates: rates
        }
      });
      const risk = res.result && res.result.success ? this.normalizeRiskSummary(res.result) : null;
      const riskBandState = this.buildRiskBandState(risk, summary);
      this.setData({ latestRiskSummary: risk, ...riskBandState });
    } catch (error) {
      const riskBandState = this.buildRiskBandState(null, summary);
      this.setData({ latestRiskSummary: null, ...riskBandState });
    }
  },

  refreshHeatmapChart() {
    const chartComponent = this.selectComponent('#asset-heatmap-chart');
    const { heatmapXAxis, heatmapYAxis, heatmapData } = this.data;
    if (!chartComponent || this.data.privacyMode || !heatmapXAxis.length || !heatmapYAxis.length) return;

    chartComponent.init((canvas, width, height, dpr) => {
      const chart = initChart(canvas, width, height, dpr);
      const maxValue = Math.max(...heatmapData.map((item) => Number(item[2] || 0)), 1);
      chart.setOption({
        tooltip: {
          position: 'top',
          confine: true,
          formatter: (params) => {
            const value = Array.isArray(params.value) ? Number(params.value[2] || 0) : 0;
            return `${heatmapXAxis[params.value[0]]}<br/>${heatmapYAxis[params.value[1]]} · ¥${value.toFixed(2)}`;
          }
        },
        grid: { top: '10%', left: '18%', right: '8%', bottom: '18%', containLabel: true },
        xAxis: {
          type: 'category',
          data: heatmapXAxis,
          splitArea: { show: true },
          axisLabel: { color: '#475569', fontSize: 10, interval: 0, rotate: 18 }
        },
        yAxis: {
          type: 'category',
          data: heatmapYAxis,
          splitArea: { show: true },
          axisLabel: { color: '#475569', fontSize: 10 }
        },
        visualMap: {
          min: 0,
          max: maxValue,
          calculable: false,
          orient: 'horizontal',
          left: 'center',
          bottom: 0,
          textStyle: { color: '#64748b', fontSize: 10 },
          inRange: { color: ['#e0f2fe', '#38bdf8', '#0f766e', '#14532d'] }
        },
        series: [{
          name: '资产热力',
          type: 'heatmap',
          data: heatmapData,
          label: {
            show: true,
            formatter: (params) => {
              const value = Number((params.value && params.value[2]) || 0);
              return value > 0 ? Math.round(value) : '';
            },
            fontSize: 9,
            color: '#0f172a'
          },
          emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(15, 23, 42, 0.18)' } }
        }]
      });
      return chart;
    });
  },

  refreshFundsFlowChart() {
    const chartComponent = this.selectComponent('#funds-flow-chart');
    const { sankeyNodes, sankeyLinks } = this.data;
    if (!chartComponent || this.data.privacyMode || !sankeyLinks.length) return;

    chartComponent.init((canvas, width, height, dpr) => {
      const chart = initChart(canvas, width, height, dpr);
      chart.setOption({
        tooltip: {
          trigger: 'item',
          confine: true,
          formatter: (params) => {
            if (params.dataType === 'edge') {
              return `${params.data.source} → ${params.data.target}<br/>¥${Number(params.data.value || 0).toFixed(2)}`;
            }
            return params.name;
          }
        },
        series: [{
          type: 'sankey',
          left: '2%',
          right: '2%',
          top: '3%',
          bottom: '3%',
          nodeWidth: 14,
          nodeGap: 10,
          emphasis: { focus: 'adjacency' },
          lineStyle: { color: 'gradient', curveness: 0.5, opacity: 0.35 },
          label: {
            color: '#334155',
            fontSize: 10,
            formatter: (params) => {
              const name = params.data.displayName || params.name || '';
              return String(name).replace(/^CARD_|^CUR_/, '');
            }
          },
          data: sankeyNodes,
          links: sankeyLinks,
          itemStyle: {
            borderWidth: 0,
            color: (params) => {
              if (String(params.name).startsWith('CUR_')) return '#38bdf8';
              if (String(params.name).startsWith('CARD_')) return '#0f766e';
              return '#1d4ed8';
            }
          }
        }]
      });
      return chart;
    });
  },

  refreshVisualCharts() {
    wx.nextTick(() => {
      setTimeout(() => {
        this.refreshHeatmapChart();
        this.refreshFundsFlowChart();
      }, 120);
    });
  },

  async loadBankCards() {
    const bankCards = Array.isArray(app.globalData.bankCards) ? app.globalData.bankCards : (wx.getStorageSync('bankCards') || []);
    const rates = app.globalData.exchangeRates || wx.getStorageSync('exchangeRates') || { CNY: 1 };
    const summary = this.buildSummary(bankCards, rates);
    const shockCurrencyOptions = summary.currencySummary.map((item) => ({ code: item.code, label: item.code }));
    const shockCodeIndex = Math.min(this.data.shockCodeIndex || 0, Math.max(shockCurrencyOptions.length - 1, 0));
    const selectedShockCode = shockCurrencyOptions[shockCodeIndex] ? shockCurrencyOptions[shockCodeIndex].code : '';
    const heatmap = this.buildHeatmapPayload(summary.cards, summary.currencySummary);
    const sankey = this.buildSankeyPayload(summary.cards, summary.currencySummary);
    const fundsFlow = this.buildFundsFlowPayload(summary.cards, summary.currencySummary, summary.totalCny);

    this.setData({
      bankCards: summary.cards,
      currencySummary: summary.currencySummary,
      totalCny: summary.totalCny,
      cardCount: summary.cardCount,
      currencyAccountCount: summary.currencyAccountCount,
      uniqueCurrencyCount: summary.uniqueCurrencyCount,
      topCurrencyExposureText: summary.topCurrencyExposureText,
      topCardName: summary.topCardName,
      topCardValueText: summary.topCardValueText,
      averageAssetText: summary.averageAssetText,
      dashboardTone: summary.dashboardTone,
      shockCurrencyOptions,
      shockCurrencyLabels: shockCurrencyOptions.map((item) => item.label),
      shockCodeIndex,
      heatmapXAxis: heatmap.heatmapXAxis,
      heatmapYAxis: heatmap.heatmapYAxis,
      heatmapData: heatmap.heatmapData,
      heatmapRows: heatmap.heatmapRows,
      sankeyNodes: sankey.sankeyNodes,
      sankeyLinks: sankey.sankeyLinks,
      fundsFlowCards: fundsFlow.fundsFlowCards,
      fundsFlowCurrencies: fundsFlow.fundsFlowCurrencies,
      privacyMode: !!app.globalData.privacyMode,
      biometricEnabled: !!app.globalData.biometricEnabled
    }, () => {
      if (selectedShockCode) {
        this.applyShockPreview(selectedShockCode, this.data.shockPct || 0);
      } else {
        this.setData({ shockImpactSummary: null, shockImpactedCards: [], shockAlertHits: [] });
      }
      this.refreshVisualCharts();
    });

    await this.loadRiskSummary(bankCards, rates, summary);
  },

  requestBiometricAuth(reason = '验证身份后显示敏感金额') {
    return new Promise((resolve) => {
      if (!wx.checkIsSupportSoterAuthentication || !wx.startSoterAuthentication) {
        resolve(true);
        return;
      }

      wx.checkIsSupportSoterAuthentication({
        success: (supportRes) => {
          const modes = Array.isArray(supportRes.supportMode) ? supportRes.supportMode : [];
          const authMode = modes[0];
          if (!authMode) {
            resolve(true);
            return;
          }
          wx.startSoterAuthentication({
            requestAuthModes: [authMode],
            challenge: 'miniprogram-asset-privacy',
            authContent: reason,
            success: () => resolve(true),
            fail: () => resolve(false)
          });
        },
        fail: () => resolve(true)
      });
    });
  },

  gotoAddCard() {
    wx.navigateTo({ url: '/pages/addCard/addCard?mode=add' });
  },

  gotoAccountDetail(e) {
    const { cardid } = e.currentTarget.dataset;
    if (!cardid) return;
    wx.navigateTo({ url: `/pages/accountDetail/accountDetail?cardId=${cardid}` });
  },

  onShockCurrencyChange(e) {
    const shockCodeIndex = Number(e.detail.value || 0);
    const target = this.data.shockCurrencyOptions[shockCodeIndex];
    this.setData({ shockCodeIndex });
    if (target) {
      this.applyShockPreview(target.code, this.data.shockPct || 0);
    }
  },

  onShockSliderChange(e) {
    const pct = Number(e.detail.value || 0);
    const target = this.data.shockCurrencyOptions[this.data.shockCodeIndex];
    if (!target) return;
    this.applyShockPreview(target.code, pct);
  },

  async togglePrivacyMode() {
    const next = !this.data.privacyMode;
    if (!next && this.data.biometricEnabled) {
      const passed = await this.requestBiometricAuth('验证后显示银行卡账户金额');
      if (!passed) {
        wx.showToast({ title: '验证未通过', icon: 'none' });
        return;
      }
    }
    app.globalData.privacyMode = next;
    if (app.sync) app.sync();
    this.setData({ privacyMode: next }, () => {
      this.refreshVisualCharts();
    });
    wx.showToast({ title: next ? '金额已隐藏' : '金额已显示', icon: 'none' });
  },

  deleteCard(e) {
    const { cardid } = e.currentTarget.dataset;
    if (!cardid) return;
    wx.showModal({
      title: '删除银行卡',
      content: '删除后该银行卡及其币种账户将被移除，无法恢复。',
      success: (res) => {
        if (!res.confirm) return;
        app.globalData.bankCards = (app.globalData.bankCards || []).filter((card) => card.id !== cardid);
        if (app.sync) app.sync();
        this.loadBankCards();
        wx.showToast({ title: '已删除', icon: 'success' });
      }
    });
  }
});