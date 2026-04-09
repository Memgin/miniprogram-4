const app = getApp();

Page({
  data: {
    navTitle: '添加银行卡',
    navStatusHeight: 20,
    navContentHeight: 44,
    navTotalHeight: 64,
    navCapsuleSpace: 96,
    id: '',
    cardName: '',
    mode: 'add',
    showAddModal: false,
    selectedAddCode: '',
    selectedAddName: '',
    lastSelectedCode: 'cny', // 新增：记录上次选择的币种，默认人民币
    addAmount: '',
    allCurrencyList: [
      { code: 'cny', name: '人民币' }, { code: 'usd', name: '美元' },
      { code: 'hkd', name: '港币' }, { code: 'eur', name: '欧元' },
      { code: 'jpy', name: '日元' }, { code: 'gbp', name: '英镑' },
      { code: 'cad', name: '加拿大元' }, { code: 'aud', name: '澳大利亚元' },
      { code: 'nzd', name: '新西兰元' }, { code: 'chf', name: '瑞士法郎' },
      { code: 'sgd', name: '新加坡元' }, { code: 'thb', name: '泰铢' },
      { code: 'myr', name: '林吉特' }, { code: 'krw', name: '韩元' }
    ],
    currencyList: [],
    showMergeToast: false,
    toastAni: {}
  },

  onLoad(options) {
    this.initCustomNavBar();
    const { mode, id } = options;
    this.setData({ mode: mode || 'add', id: id || '' });
    if (mode === 'edit' && id) this.loadCardData(id);
    this.toastAnimation = wx.createAnimation({ duration: 300, timingFunction: 'ease-out' });
  },

  onNavBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 });
      return;
    }
    wx.switchTab({ url: '/pages/index/index' });
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

  loadCardData(id) {
    const card = app.globalData.bankCards.find(item => item.id === id);
    if (!card) return;
    const currencyList = card.currencies.map(cur => {
      const info = this.data.allCurrencyList.find(a => a.code === cur.code);
      return { code: cur.code, name: info ? info.name : cur.code.toUpperCase(), amount: cur.amount };
    });
    this.setData({ cardName: card.name, currencyList });
  },

  // --- 弹窗逻辑：默认选中上次币种 ---
  showAddCurrencyModal() {
    const lastCode = this.data.lastSelectedCode;
    const lastInfo = this.data.allCurrencyList.find(i => i.code === lastCode);
    this.setData({ 
      showAddModal: true, 
      selectedAddCode: lastCode, 
      selectedAddName: lastInfo ? lastInfo.name : '',
      addAmount: '' 
    });
  },

  hideAddModal() { this.setData({ showAddModal: false }); },

  selectAddCurrency(e) {
    const { code, name } = e.currentTarget.dataset;
    this.setData({ 
      selectedAddCode: code, 
      selectedAddName: name,
      lastSelectedCode: code // 实时记录本次选择，作为下次的“上次选择”
    });
  },

  bindAddAmount(e) {
    let val = e.detail.value.replace(/[^0-9.]/g, '');
    this.setData({ addAmount: val });
  },

  onCardNameInput(e) { this.setData({ cardName: e.detail.value.trim() }); },

  confirmAddCurrency() {
    const { selectedAddCode, selectedAddName, addAmount, currencyList } = this.data;
    if (!selectedAddCode || !addAmount) return;
    
    const amount = parseFloat(addAmount).toFixed(2);
    const newList = [...currencyList];
    const idx = newList.findIndex(item => item.code === selectedAddCode);
    
    if (idx > -1) {
      newList[idx].amount = amount;
    } else {
      newList.push({ code: selectedAddCode, name: selectedAddName, amount });
    }
    
    this.setData({ 
      currencyList: newList, 
      showAddModal: false,
      // 确认添加时也确保记录了币种
      lastSelectedCode: selectedAddCode 
    });
  },

  delCurrency(e) {
    const idx = e.currentTarget.dataset.index;
    const newList = [...this.data.currencyList];
    newList.splice(idx, 1);
    this.setData({ currencyList: newList });
  },

  async saveCard() {
    const { mode, id, cardName, currencyList } = this.data;
    if (!cardName) return wx.showToast({ title: '请输入银行名', icon: 'none' });
    if (currencyList.length === 0) return wx.showToast({ title: '请添加币种', icon: 'none' });

    const finalCurrencies = currencyList.map(item => ({ code: item.code, amount: item.amount }));
    let bankCards = [...app.globalData.bankCards];
    let isMerge = false;

    if (mode === 'add') {
      const sameNameIdx = bankCards.findIndex(card => card.name.trim() === cardName.trim());
      if (sameNameIdx !== -1) {
        isMerge = true;
        const oldCur = bankCards[sameNameIdx].currencies;
        finalCurrencies.forEach(n => {
          const oIdx = oldCur.findIndex(o => o.code === n.code);
          if (oIdx > -1) {
            oldCur[oIdx].amount = (parseFloat(oldCur[oIdx].amount) + parseFloat(n.amount)).toFixed(2);
          } else {
            oldCur.push(n);
          }
        });
      } else {
        bankCards.push({ id: 'card_' + Date.now(), name: cardName, currencies: finalCurrencies });
      }
    } else {
      bankCards = bankCards.map(c => c.id === id ? { ...c, name: cardName, currencies: finalCurrencies } : c);
    }

    app.globalData.bankCards = bankCards;
    app.sync(); 

    if (isMerge) {
      this.showMergeToast();
      setTimeout(() => wx.navigateBack(), 2000);
    } else {
      wx.showToast({ title: '保存成功' });
      setTimeout(() => wx.navigateBack(), 1000);
    }
  },

  showMergeToast() {
    this.toastAnimation.opacity(1).scale(1).step();
    this.setData({ showMergeToast: true, toastAni: this.toastAnimation.export() });
  },
  hideMergeToast() { this.setData({ showMergeToast: false }); },
  stopPropagation() {}
});