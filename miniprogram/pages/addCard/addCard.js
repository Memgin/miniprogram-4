const app = getApp();

Page({
  data: {
    id: '',
    cardName: '',
    mode: 'add',
    currIndex: 0,
    currAmount: '',
    currencyNameList: ['人民币', '美元', '港币', '欧元', '日元', '英镑', '加拿大元', '澳大利亚元', '新西兰元', '瑞士法郎', '新加坡元', '泰铢', '林吉特', '韩元'],
    currencyCodeList: ['cny', 'usd', 'hkd', 'eur', 'jpy', 'gbp', 'cad', 'aud', 'nzd', 'chf', 'sgd', 'thb', 'myr', 'krw'],
    currencyList: [], // 存储格式：[{code, name, amount}]
    showMergeToast: false,
    toastAni: {}
  },

  onLoad(options) {
    const { mode, id } = options;
    this.setData({ mode: mode || 'add', id: id || '' });
    
    // 初始化时直接从全局数据查找，避免频繁读取 Storage
    if (mode === 'edit' && id) {
      this.loadCardData(id);
    }
    
    // 初始化吐司动画
    this.toastAnimation = wx.createAnimation({
      duration: 300,
      timingFunction: 'ease-out'
    });
  },

  // 1. 加载编辑的卡片数据（改为从 app.globalData 读取）
  loadCardData(id) {
    const card = app.globalData.bankCards.find(item => item.id === id);
    if (!card) {
      wx.showToast({ title: '卡片不存在', icon: 'none' });
      wx.navigateBack();
      return;
    }
    const currencyList = card.currencies.map(cur => ({
      code: cur.code,
      name: this.data.currencyNameList[this.data.currencyCodeList.indexOf(cur.code)],
      amount: cur.amount
    }));
    this.setData({ cardName: card.name, currencyList });
  },

  // --- 原有交互逻辑：完全保留 ---
  onCardNameInput(e) { this.setData({ cardName: e.detail.value.trim() }); },
  onAmountInput(e) {
    const val = e.detail.value.replace(/[^0-9.]/g, '');
    this.setData({ currAmount: val });
  },
  onCurrencyChange(e) { this.setData({ currIndex: parseInt(e.detail.value) }); },

  addCurrency() {
    const { currIndex, currAmount, currencyList, currencyCodeList, currencyNameList } = this.data;
    if (!currAmount || parseFloat(currAmount) <= 0) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' });
      return;
    }
    const code = currencyCodeList[currIndex];
    const name = currencyNameList[currIndex];
    const amount = parseFloat(currAmount).toFixed(2);
    const existIdx = currencyList.findIndex(item => item.code === code);
    
    if (existIdx !== -1) {
      const newList = [...currencyList];
      newList[existIdx].amount = amount; // 这里保留你原来的“覆盖”逻辑
      this.setData({ currencyList: newList, currAmount: '' });
    } else {
      this.setData({ 
        currencyList: [...currencyList, { code, name, amount }], 
        currAmount: '' 
      });
    }
  },

  delCurrency(e) {
    const index = e.currentTarget.dataset.index;
    const newList = [...this.data.currencyList];
    newList.splice(index, 1);
    this.setData({ currencyList: newList });
  },

  // --- 吐司动画逻辑：完全保留 ---
  showMergeToast() {
    this.toastAnimation.opacity(1).scale(1).step();
    this.setData({ showMergeToast: true, toastAni: this.toastAnimation.export() });
    setTimeout(() => this.hideMergeToast(), 2000);
  },
  hideMergeToast() {
    this.toastAnimation.opacity(0).scale(0.8).step();
    this.setData({ toastAni: this.toastAnimation.export() });
    setTimeout(() => this.setData({ showMergeToast: false }), 300);
  },

  // --- 核心保存逻辑：接入 app.sync() ---
  async saveCard() {
    const { mode, id, cardName, currencyList, currIndex, currAmount, currencyCodeList, currencyNameList } = this.data;

    if (!cardName) {
      wx.showToast({ title: '请填写银行卡名称', icon: 'none' });
      return;
    }

    // 整合当前输入框中未点击“添加”按钮的金额
    let finalCurrencyList = [...currencyList];
    if (currAmount && parseFloat(currAmount) > 0) {
      const code = currencyCodeList[currIndex];
      const amount = parseFloat(currAmount).toFixed(2);
      const existIdx = finalCurrencyList.findIndex(item => item.code === code);
      if (existIdx !== -1) {
        finalCurrencyList[existIdx].amount = amount;
      } else {
        finalCurrencyList.push({ code, name: currencyNameList[currIndex], amount });
      }
    }

    if (finalCurrencyList.length === 0) {
      wx.showToast({ title: '请至少添加一个币种', icon: 'none' });
      return;
    }

    // 转换为存入数据库的结构
    const finalCurrencies = finalCurrencyList.map(item => ({
      code: item.code,
      amount: item.amount
    }));

    // 获取全局银行卡副本进行操作
    let bankCards = [...app.globalData.bankCards];
    let isMerge = false;

    if (mode === 'add') {
      // 100%保留你的同名合并算法
      const sameNameIdx = bankCards.findIndex(card => card.name.trim() === cardName.trim());
      if (sameNameIdx !== -1) {
        isMerge = true;
        const oldCard = bankCards[sameNameIdx];
        const mergedCurrencies = [...oldCard.currencies];
        
        finalCurrencies.forEach(newCur => {
          const oldCurIndex = mergedCurrencies.findIndex(cur => cur.code === newCur.code);
          if (oldCurIndex !== -1) {
            mergedCurrencies[oldCurIndex].amount = (
              parseFloat(mergedCurrencies[oldCurIndex].amount) + parseFloat(newCur.amount)
            ).toFixed(2);
          } else {
            mergedCurrencies.push(newCur);
          }
        });
        bankCards[sameNameIdx].currencies = mergedCurrencies;
      } else {
        // 新增卡片
        bankCards.push({
          id: 'card_' + Date.now(),
          name: cardName,
          currencies: finalCurrencies
        });
      }
    } else {
      // 编辑模式
      bankCards = bankCards.map(card => {
        if (card.id === id) {
          return { ...card, name: cardName, currencies: finalCurrencies };
        }
        return card;
      });
    }

    // --- 数据中心化同步 ---
    app.globalData.bankCards = bankCards;
    app.sync(); // 触发 app.js 里的本地持久化和防抖云同步

    // UI 反馈逻辑
    if (isMerge) {
      this.showMergeToast();
      setTimeout(() => wx.navigateBack(), 2000);
    } else {
      wx.showToast({ title: mode === 'add' ? '创建成功' : '保存成功' });
      setTimeout(() => wx.navigateBack(), 1000);
    }
  }
});