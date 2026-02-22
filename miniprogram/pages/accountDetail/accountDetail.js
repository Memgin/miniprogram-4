import * as echarts from '../../components/ec-canvas/echarts';

const app = getApp();
const exchangeRateUtil = require('../../utils/exchangeRate.js');

// 初始化图表函数
function initChart(canvas, width, height, dpr) {
  const chart = echarts.init(canvas, null, {
    width: width,
    height: height,
    devicePixelRatio: dpr
  });
  canvas.setChart(chart);
  return chart;
}

Page({
  data: {
    cardId: '',
    cardInfo: {},
    currencyList: [],
    totalCny: '0.00',
    ec: {
      lazyLoad: true 
    },
    // 高级配色方案：
    luxuryColors: [
        '#ff9f43', // 1. 亮橘 (主色，活力)
        '#ffbd69', // 2. 浅金橘
        '#ff9671', // 3. 珊瑚粉 (增加高级感)
        '#ffc75f', // 4. 向日葵黄
        '#f9f871', // 5. 柠檬奶油 (提亮)
        '#ff8066', // 6. 柔和红
        '#ffb88c', // 7. 浅杏色
        '#ffd571', // 8. 暖姜黄
        '#ffacc7', // 9. 樱花粉 (跳色)
        '#ffecb3'  // 10. 极浅奶冻 (收尾)
      ],
    currencyMap: {
      cny: 'CNY', usd: 'USD', hkd: 'HKD', eur: 'EUR', jpy: 'JPY', gbp: 'GBP',
      cad: 'CAD', aud: 'AUD', nzd: 'NZD', chf: 'CHF', sgd: 'SGD', thb: 'THB',
      myr: 'RM', krw: 'KRW'
    },
    allCurrencyList: [
      { code: 'cny', name: 'CNY' }, { code: 'usd', name: 'USD' },
      { code: 'hkd', name: 'HKD' }, { code: 'eur', name: 'EUR' },
      { code: 'jpy', name: 'JPY' }, { code: 'gbp', name: 'GBP' },
      { code: 'cad', name: 'CAD' }, { code: 'aud', name: 'AUD' },
      { code: 'nzd', name: 'NZD' }, { code: 'chf', name: 'CHF' },
      { code: 'sgd', name: 'SGD' }, { code: 'thb', name: 'THB' },
      { code: 'myr', name: 'RM' }, { code: 'krw', name: 'KRW' }
    ],
    showModal: false,
    showAddModal: false,
    showNameModal: false,
    currentEditCode: '',
    currentCurName: '',
    newAmount: '',
    selectedAddCode: '',
    selectedAddName: '',
    addAmount: '',
    tempCardName: '',
    startX: 0,
    delIndex: -1
  },

  onLoad(options) {
    const { cardId } = options;
    if (!cardId) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1000);
      return;
    }
    this.setData({ cardId });
  },

  onShow() {
    this.loadCardAndCalculateTotal().then(() => {
      this.refreshChart(); 
    });
  },

  /**
   * 1. 加载数据并计算总额
   */
  async loadCardAndCalculateTotal() {
    const { cardId } = this.data;
    const bankCards = app.globalData.bankCards || wx.getStorageSync('bankCards') || [];
    const targetCard = bankCards.find(card => card.id === cardId);
    
    if (!targetCard) {
      wx.showToast({ title: '记录不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1000);
      return Promise.reject();
    }

    const currencyList = (targetCard.currencies || []).map(item => ({ ...item, delShow: false }));
    const rates = app.globalData.exchangeRates || {};
    const totalCny = this.calcCardCnyTotal(currencyList, rates);

    return new Promise((resolve) => {
      this.setData({
        cardInfo: targetCard,
        currencyList,
        totalCny: totalCny.toFixed(2)
      }, () => {
        resolve();
      });
    });
  },

  calcCardCnyTotal(currencies, rates) {
    let total = 0;
    if (!currencies || !rates) return 0;
    currencies.forEach(cur => {
      const amount = parseFloat(cur.amount) || 0;
      const code = (cur.code || '').toUpperCase();
      let rate = (code === 'CNY') ? 1 : (rates[code] || rates[code.toLowerCase()] || 0);
      total += amount * rate;
    });
    return total;
  },

  /**
   * 2. 可视化图表刷新逻辑 (优化渲染与配色)
   */
  refreshChart() {
    if (this.data.currencyList.length === 0) return;

    // 关键点：使用 nextTick 确保 Canvas 从 wx:if 中重新创建后能被选中
    wx.nextTick(() => {
      const chartComponent = this.selectComponent('#mychart-dom-pie');
      if (!chartComponent) return;

      chartComponent.init((canvas, width, height, dpr) => {
        const chart = initChart(canvas, width, height, dpr);
        
        const rates = app.globalData.exchangeRates || {};
        const chartData = this.data.currencyList.map(item => {
          const code = item.code.toUpperCase();
          const rate = (code === 'CNY') ? 1 : (rates[code] || 0);
          return {
            name: this.data.currencyMap[item.code] || code,
            value: parseFloat((parseFloat(item.amount) * rate).toFixed(2))
          };
        }).filter(item => item.value > 0);

        const option = {
          color: this.data.luxuryColors, // 使用刚才给你的那组 #ff 开头的清爽色
          backgroundColor: '#ffffff',
          series: [{
            type: 'pie',
            radius: ['52%', '72%'], // 稍微微调，保持圆环精致
            center: ['50%', '50%'],
            data: chartData,
            label: { 
              show: true, 
              formatter: '{b}\n{d}%',
              fontSize: 11,
              // 关键修改：不要用深褐或纯黑，用带有暖意但足够深的“炭灰色”
              // 这样文字清晰且不脏
              color: '#5d5d5a', 
              fontWeight: '500',
              padding: [0, -10] // 微调间距，防止文字贴太近
            },
            labelLine: {
              length: 10,
              length2: 15,
              lineStyle: {
                color: '#e0e0e0' // 引线颜色调浅，更有空气感
              }
            },
            itemStyle: {
              // 关键修改：增加圆角到 10，让色块像糖果一样圆润
              borderRadius: 10,
              borderColor: '#fff',
              // 关键修改：白边加宽到 4，这是解决“颜色堆在一起显脏”的终极法宝
              borderWidth: 4 
            },
            // 选中的放大效果
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: 'rgba(0, 0, 0, 0.1)'
              }
            }
          }]
        };

        chart.setOption(option);
        return chart;
      });
    });
  },

  /**
   * 3. 核心同步处理器
   */
  async _updateAndSync(newBankCards, successMsg) {
    app.globalData.bankCards = newBankCards;
    wx.setStorageSync('bankCards', newBankCards);
    await this.loadCardAndCalculateTotal();
    
    this.refreshChart(); 
    app.sync(); 
    wx.showToast({ title: successMsg, icon: 'success' });
  },

  /**
   * 4. 业务逻辑函数 (重点：在 hide 函数的回调里刷新图表)
   */
  showEditNameModal() {
    this.setData({ showNameModal: true, tempCardName: this.data.cardInfo.name || '' });
  },
  
  // 所有的 hide 方法都加入了回调，确保 wx:if 切换回 false 后重绘画布
  hideNameModal() { 
    this.setData({ showNameModal: false }, () => {
      this.refreshChart();
    }); 
  },
  
  hideEditModal() { 
    this.setData({ showModal: false }, () => {
      this.refreshChart();
    }); 
  },
  
  hideAddModal() { 
    this.setData({ showAddModal: false }, () => {
      this.refreshChart();
    }); 
  },

  bindNameInput(e) { this.setData({ tempCardName: e.detail.value }); },
  
  async saveCardName() {
    const { cardId, tempCardName } = this.data;
    if (!tempCardName.trim()) return;
    const newBankCards = app.globalData.bankCards.map(card => {
      if (card.id === cardId) return { ...card, name: tempCardName.trim() };
      return card;
    });
    // 先隐藏，会自动触发 refreshChart
    this.hideNameModal();
    await this._updateAndSync(newBankCards, '名称已更新');
  },

  async saveBalance() {
    const { cardId, currentEditCode, newAmount } = this.data;
    if (!/^\d+(\.\d{1,2})?$/.test(newAmount)) return;
    const formatAmount = parseFloat(newAmount).toFixed(2);
    const newBankCards = app.globalData.bankCards.map(card => {
      if (card.id === cardId) {
        return { ...card, currencies: card.currencies.map(cur => cur.code === currentEditCode ? { ...cur, amount: formatAmount } : cur) };
      }
      return card;
    });
    this.hideEditModal();
    await this._updateAndSync(newBankCards, '修改成功');
  },

  async saveAddCurrency() {
    const { cardId, selectedAddCode, selectedAddName, addAmount } = this.data;
    if (!selectedAddCode || !addAmount) return;
    const newAddAmount = parseFloat(addAmount).toFixed(2);
    const newBankCards = app.globalData.bankCards.map(card => {
      if (card.id === cardId) {
        let currencies = [...(card.currencies || [])];
        const idx = currencies.findIndex(c => c.code === selectedAddCode);
        if (idx > -1) {
          currencies[idx].amount = (parseFloat(currencies[idx].amount) + parseFloat(newAddAmount)).toFixed(2);
        } else {
          currencies.push({ code: selectedAddCode, amount: newAddAmount, codeUpper: selectedAddName });
        }
        return { ...card, currencies };
      }
      return card;
    });
    this.hideAddModal();
    await this._updateAndSync(newBankCards, '添加成功');
  },

  deleteCurrency(e) {
    const { code } = e.currentTarget.dataset;
    const { cardId } = this.data;
    wx.showModal({
      title: '提示',
      content: '确定删除该币种账户吗？',
      success: (res) => {
        if (res.confirm) {
          const newBankCards = app.globalData.bankCards.map(card => {
            if (card.id === cardId) return { ...card, currencies: card.currencies.filter(item => item.code !== code) };
            return card;
          });
          this._updateAndSync(newBankCards, '删除成功');
        }
      }
    });
  },

  showEditModal(e) {
    const { code, amount } = e.currentTarget.dataset;
    this.setData({ showModal: true, currentEditCode: code, currentCurName: this.data.currencyMap[code] || code, newAmount: amount });
  },
  
  bindNewAmount(e) { this.setData({ newAmount: e.detail.value }); },
  showAddCurrencyModal() { this.setData({ showAddModal: true, selectedAddCode: '', addAmount: '' }); },
  selectAddCurrency(e) { this.setData({ selectedAddCode: e.currentTarget.dataset.code, selectedAddName: e.currentTarget.dataset.name }); },
  bindAddAmount(e) { this.setData({ addAmount: e.detail.value }); },
  touchStart(e) { this.setData({ startX: e.touches[0].clientX, delIndex: e.currentTarget.dataset.index, currencyList: this.data.currencyList.map(i => ({ ...i, delShow: false })) }); },
  touchMove(e) { const moveX = e.touches[0].clientX; if (this.data.startX - moveX > 40) { const list = [...this.data.currencyList]; if(this.data.delIndex !== -1) list[this.data.delIndex].delShow = true; this.setData({ currencyList: list }); } },
  stopPropagation() {}
});