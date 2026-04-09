const app = getApp();
const exchangeRateUtil = require('../../utils/exchangeRate.js');
const echarts = require('../../components/ec-canvas/echarts');

function initChart(canvas, width, height, dpr) {
  const chart = echarts.init(canvas, null, {
    width,
    height,
    devicePixelRatio: dpr
  });
  canvas.setChart(chart);
  return chart;
}

const STORAGE_KEY = 'XISHU_ASSETS_V1';
const LEGACY_STORAGE_KEY = 'YOUSHU_ASSETS_V3';
const LOCAL_AI_KEY_STORAGE = 'SILICONFLOW_API_KEY';
const RECENT_ICON_STORAGE_KEY = 'XISHU_RECENT_ICONS_V1';
const GET_XISHU_ASSETS_FN = 'getXishuAssets';
const SYNC_XISHU_ASSETS_FN = 'syncXishuAssets';
const TEMP_FALLBACK_AI_KEY = 'sk-mawvwwscqojwzibuscyhkyooyitszaxfvykfeuodpmzmliwm';
const PULL_DOWN_LOADING_TEXT = '全量同步中...';
const PULL_DOWN_SUCCESS_TEXT = '同步成功';
const PULL_DOWN_FAIL_TEXT = '刷新延迟';
const DOUBLE_TAP_WINDOW = 280;

Page({
  data: {
    navTitle: '悉数',
    navStatusHeight: 20,
    navContentHeight: 44,
    navTotalHeight: 64,
    navCapsuleSpace: 96,
    filters: [
      { id: 'all', text: '全部' },
      { id: 'serving', text: '服役中' },
      { id: 'retired', text: '已退役' },
      { id: 'sold', text: '已卖出' }
    ],
    activeFilter: 'all',
    listType: 'asset',
    searchKeyword: '',
    searchFocus: false,
    showOnlyPinned: false,
    sortOrder: 'desc',
    editorVisible: false,
    editorMode: 'create',
    editingId: '',
    editorTab: 'asset',
    editorTabs: [
      { id: 'asset', text: '资产' },
      { id: 'wish', text: '心愿' }
    ],
    costModes: [
      { id: 'time', text: '按时间计算' },
      { id: 'use', text: '按次打卡计算' }
    ],
    activeCostMode: 'time',
    formStatusOptions: [
      { id: 'serving', text: '服役中' },
      { id: 'retired', text: '已退役' },
      { id: 'sold', text: '已卖出' }
    ],
    categoryOptions: ['全部', '数码', '黄金', '外币', '潮玩', '账号', '其他'],
    iconPresets: ['📦', '🎒', '📱', '⌚', '💻', '🎧', '🎮', '🧸', '💄', '👟'],
    localIconPresets: [
      { id: 'usercenter', name: '用户', path: '/images/icons/usercenter.png' },
      { id: 'home', name: '主页', path: '/images/icons/home.png' }
    ],
    iconLibraryVisible: false,
    iconLibraryLoading: false,
    iconLibraryItems: [],
    iconLibraryDisplayedItems: [],
    recentIconItems: [],
    iconLibraryCategories: ['全部'],
    iconLibraryActiveCategory: '全部',
    iconLibraryKeyword: '',
    iconLibraryPage: 1,
    iconLibraryPageSize: 24,
    iconLibraryHasMore: false,
    iconPickerTab: 'emoji',
    iconPickerDraftType: 'emoji',
    iconPickerDraftEmoji: '📦',
    iconPickerDraftImagePath: '',
    formIconType: 'emoji',
    formIconEmoji: '📦',
    formIconImagePath: '',
    categoryIndex: 0,
    formStatus: 'serving',
    statusSwitches: {
      retired: false,
      sold: false
    },
    formModel: {
      name: '',
      price: '',
      date: '',
      resalePrice: '',
      note: '',
      relatedItems: ''
    },
    showPriceCurrencyModal: false,
    selectedPriceCurrencyCode: 'CNY',
    selectedPriceCurrencyName: '人民币',
    allCurrencyList: [
      { code: 'CNY', name: '人民币' },
      { code: 'USD', name: '美元' },
      { code: 'HKD', name: '港币' },
      { code: 'EUR', name: '欧元' },
      { code: 'JPY', name: '日元' },
      { code: 'GBP', name: '英镑' },
      { code: 'CAD', name: '加拿大元' },
      { code: 'AUD', name: '澳大利亚元' },
      { code: 'NZD', name: '新西兰元' },
      { code: 'CHF', name: '瑞士法郎' },
      { code: 'SGD', name: '新加坡元' },
      { code: 'THB', name: '泰铢' },
      { code: 'RM', name: '林吉特' },
      { code: 'KRW', name: '韩元' }
    ],
    exchangeRates: { cny: 1 },
    priceRateText: '实时汇率：1 CNY = ¥1.0000',
    priceCnyPreviewText: '折合人民币：¥0.00',
    showRelatedCurrencyModal: false,
    selectedRelatedCurrencyCode: 'CNY',
    selectedRelatedCurrencyName: '人民币',
    relatedRateText: '实时汇率：1 CNY = ¥1.0000',
    relatedCnyPreviewText: '折合人民币：¥0.00',
    relatedDraft: {
      name: '',
      price: '',
      qty: '1'
    },
    relatedList: [],
    relatedTotalText: '¥0.00',
    editorResalePredicting: false,
    editorResaleResult: null,
    noteImagePath: '',
    toggles: {
      pinned: false,
      excludeAsset: false,
      excludeDaily: false
    },
    assets: [],
    viewAssets: [],
    detailVisible: false,
    detailItem: null,
    ecDetailTrend: { lazyLoad: true },
    overviewBadge: '0/0',
    totalAssetText: '¥0.00',
    avgDailyCostText: '¥0.00',
    categoryVisualList: [],
    cloudSyncState: 'idle',
    cloudSyncText: '云端未同步',
    statusSummary: [
      { id: 'serving', text: '服役中', count: 0, progress: 0 },
      { id: 'retired', text: '已退役', count: 0, progress: 0 },
      { id: 'sold', text: '已卖出', count: 0, progress: 0 }
    ]
  },

  onLoad() {
    this.initCustomNavBar();
    this.assetTapTimer = null;
    this.lastTapAssetId = '';
    this.lastTapAt = 0;
    this.loadAssets();
    this.loadRecentIcons();
    this.ensureExchangeRates(false);
    this.syncAssetsFromCloud();
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

  syncCustomTabBar() {
    if (!this.getTabBar) return;
    const tabBar = this.getTabBar();
    if (!tabBar || !tabBar.setData) return;
    tabBar.setData({
      selected: 1,
      visualSelected: 1,
      pressedIndex: -1,
      slideHoverIndex: -1,
      isTracking: false,
      highlightX: 50,
      highlightY: 16
    });
  },

  setTabBarVisibility(visible) {
    const tabBar = this.getTabBar ? this.getTabBar() : null;
    if (visible) {
      if (tabBar && typeof tabBar.show === 'function') {
        tabBar.show();
      } else if (tabBar && tabBar.setData) {
        tabBar.setData({ hidden: false });
      }
      this.syncCustomTabBar();
      return;
    }

    if (tabBar && typeof tabBar.hide === 'function') {
      tabBar.hide();
    } else if (tabBar && tabBar.setData) {
      tabBar.setData({ hidden: true });
    }
  },

  onShow() {
    if (this.data.editorVisible || this.data.detailVisible) {
      this.setTabBarVisibility(false);
      return;
    }
    this.setTabBarVisibility(true);
  },

  async onPullDownRefresh() {
    wx.showLoading({ title: PULL_DOWN_LOADING_TEXT, mask: true });
    try {
      await this.ensureExchangeRates(true);
      await this.syncAssetsFromCloud();
      wx.showToast({ title: PULL_DOWN_SUCCESS_TEXT, icon: 'success' });
    } catch (error) {
      console.warn('下拉刷新失败', error);
      wx.showToast({ title: PULL_DOWN_FAIL_TEXT, icon: 'none' });
    } finally {
      wx.stopPullDownRefresh();
      wx.hideLoading();
    }
  },

  loadRecentIcons() {
    const saved = wx.getStorageSync(RECENT_ICON_STORAGE_KEY) || [];
    const recent = Array.isArray(saved)
      ? saved
        .map((item) => ({
          id: String(item.id || ''),
          name: String(item.name || ''),
          category: String(item.category || '最近'),
          path: String(item.path || ''),
          source: String(item.source || 'recent')
        }))
        .filter((item) => item.path)
        .slice(0, 12)
      : [];
    this.setData({ recentIconItems: recent });
  },

  saveRecentIcon(item) {
    if (!item || !item.path) return;
    const incoming = {
      id: String(item.id || `recent_${Date.now()}`),
      name: String(item.name || '图标'),
      category: String(item.category || '最近'),
      path: String(item.path || ''),
      source: String(item.source || 'recent')
    };

    const current = Array.isArray(this.data.recentIconItems) ? this.data.recentIconItems : [];
    const merged = [incoming, ...current.filter((icon) => icon.path !== incoming.path)].slice(0, 12);
    this.setData({ recentIconItems: merged });
    wx.setStorageSync(RECENT_ICON_STORAGE_KEY, merged);
  },

  onUnload() {
    this.clearAssetTapTimer();
    if (this.data.editorVisible && this.data.editorMode === 'edit' && this.data.editingId) {
      this.onSubmitEditor();
      return;
    }
    this.setTabBarVisibility(true);
  },

  onHide() {
    this.clearAssetTapTimer();
    if (this.data.editorVisible && this.data.editorMode === 'edit' && this.data.editingId) {
      this.onSubmitEditor();
    }
  },

  clearAssetTapTimer() {
    if (this.assetTapTimer) {
      clearTimeout(this.assetTapTimer);
      this.assetTapTimer = null;
    }
  },

  parseNumber(value) {
    const number = Number(value);
    if (Number.isFinite(number)) {
      return number;
    }
    return 0;
  },

  formatMoney(value) {
    const number = this.parseNumber(value);
    return `¥${number.toFixed(2)}`;
  },

  async ensureExchangeRates(force = false) {
    const cached = app.globalData.exchangeRates || wx.getStorageSync('exchangeRates') || { cny: 1 };
    const hasEnoughRates = cached && Object.keys(cached).length > 4;

    if (!force && hasEnoughRates) {
      this.setData({ exchangeRates: cached });
      this.updatePriceCnyPreview();
      return cached;
    }

    try {
      const latest = await exchangeRateUtil.getSinaRealTimeRates();
      if (latest && Object.keys(latest).length > 4) {
        app.globalData.exchangeRates = latest;
        wx.setStorageSync('exchangeRates', latest);
        this.setData({ exchangeRates: latest });
        this.updatePriceCnyPreview();
        return latest;
      }
    } catch (error) {
      console.warn('汇率拉取失败，使用缓存汇率', error);
    }

    this.setData({ exchangeRates: cached || { cny: 1 } });
    this.updatePriceCnyPreview();
    return cached || { cny: 1 };
  },

  getRateByCode(code, rates = this.data.exchangeRates) {
    const upperCode = String(code || 'CNY').toUpperCase();
    if (upperCode === 'CNY') return 1;

    const table = rates || {};
    if (upperCode === 'RM') {
      const myrRate = this.parseNumber(table.MYR || table.myr);
      return myrRate > 0 ? myrRate : 1;
    }

    const rate = this.parseNumber(table[upperCode] || table[upperCode.toLowerCase()]);
    return rate > 0 ? rate : 1;
  },

  updatePriceCnyPreview() {
    const amount = this.parseNumber(this.data.formModel.price);
    const code = String(this.data.selectedPriceCurrencyCode || 'CNY').toUpperCase();
    const rate = this.getRateByCode(code);
    const cnyAmount = amount * rate;

    this.setData({
      priceRateText: `实时汇率：1 ${code} = ¥${rate.toFixed(4)}`,
      priceCnyPreviewText: `折合人民币：${this.formatMoney(cnyAmount)}`
    });
  },

  updateRelatedCnyPreview() {
    const amount = this.parseNumber(this.data.relatedDraft.price);
    const code = String(this.data.selectedRelatedCurrencyCode || 'CNY').toUpperCase();
    const rate = this.getRateByCode(code);
    const cnyAmount = amount * rate;

    this.setData({
      relatedRateText: `实时汇率：1 ${code} = ¥${rate.toFixed(4)}`,
      relatedCnyPreviewText: `折合人民币：${this.formatMoney(cnyAmount)}`
    });
  },

  normalizeRelatedItems(input) {
    const list = Array.isArray(input) ? input : [];
    return list
      .map((item) => {
        const name = `${item.name || ''}`.trim();
        if (!name) return null;
        const price = this.parseNumber(item.price);
        const qty = Math.max(1, Math.floor(this.parseNumber(item.qty) || 1));
        const amount = price * qty;
        return {
          id: item.id || `rel_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
          name,
          price,
          qty,
          amount,
          priceText: this.formatMoney(price),
          amountText: this.formatMoney(amount)
        };
      })
      .filter(Boolean);
  },

  updateRelatedTotal(relatedList = this.data.relatedList) {
    const total = relatedList.reduce((sum, item) => sum + this.parseNumber(item.amount), 0);
    this.setData({
      relatedTotalText: this.formatMoney(total)
    });
    return total;
  },

  getStatusText(status) {
    if (status === 'retired') return '已退役';
    if (status === 'sold') return '已卖出';
    return '服役中';
  },

  daysSince(dateText) {
    if (!dateText) {
      return 1;
    }
    const start = new Date(`${dateText}T00:00:00`);
    if (Number.isNaN(start.getTime())) {
      return 1;
    }
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    const days = Math.floor(diff / (24 * 60 * 60 * 1000)) + 1;
    return Math.max(1, days);
  },

  getDefaultIconByType(type = 'asset') {
    return type === 'wish' ? '🎯' : '📦';
  },

  buildDustIndex(holdDays, useCount) {
    const safeHoldDays = Math.max(1, Number(holdDays) || 1);
    const safeUseCount = Math.max(0, Number(useCount) || 0);
    const idleWeight = Math.max(0, safeHoldDays - safeUseCount);
    const index = Math.max(0, Math.min(100, Math.round((idleWeight / safeHoldDays) * 100)));

    let levelText = '活跃使用';
    if (index >= 85) levelText = '重度吃灰';
    else if (index >= 65) levelText = '明显吃灰';
    else if (index >= 40) levelText = '轻度吃灰';

    return {
      index,
      levelText,
      trackWidth: index > 0 ? `${Math.max(6, index)}%` : '0%'
    };
  },

  buildUseProgress(holdDays, useCount) {
    const safeUseCount = Math.max(0, Number(useCount) || 0);
    const index = safeUseCount > 0
      ? Math.max(0, Math.min(100, Math.round(100 / safeUseCount)))
      : 100;

    let levelText = '待使用';
    if (index <= 20) levelText = '降本明显';
    else if (index <= 40) levelText = '持续下降';
    else if (index <= 70) levelText = '开始摊薄';

    return {
      index,
      levelText,
      trackWidth: index > 0 ? `${Math.max(6, index)}%` : '0%'
    };
  },

  buildTimeProgress(holdDays) {
    const safeHoldDays = Math.max(1, Number(holdDays) || 1);
    const index = Math.max(0, Math.min(100, Math.round(100 / safeHoldDays)));

    return {
      index,
      trackWidth: index > 0 ? `${Math.max(6, index)}%` : '0%'
    };
  },

  normalizeCostMode(value) {
    if (value === 'use') return 'use';
    if (value === 'time') return 'time';
    // 兼容旧版本字段
    if (value === 'period') return 'time';
    return 'time';
  },

  buildUsageModel(item) {
    const useCount = Math.max(0, Number(item.useCount) || 0);
    const holdDays = Math.max(1, Number(item.holdDays) || this.daysSince(item.date));
    const effectivePrice = this.parseNumber(item.effectivePrice);
    const dailyCost = this.parseNumber(item.dailyCost);
    const useCost = useCount > 0 ? (effectivePrice / useCount) : 0;
    const selectedMode = this.normalizeCostMode(item.costMode);
    const modeOptions = [
      { id: 'time', text: '按时间' },
      { id: 'use', text: '按次打卡' }
    ];

    const selectedValueText = selectedMode === 'use'
      ? (useCount > 0 ? this.formatMoney(useCost) : '待打卡')
      : this.formatMoney(dailyCost);
    const selectedUnitText = selectedMode === 'use' ? '/次' : '/天';

    return {
      useCount,
      holdDays,
      selectedMode,
      modeOptions,
      dailyCostText: this.formatMoney(dailyCost),
      useCostText: useCount > 0 ? this.formatMoney(useCost) : '待打卡',
      selectedValueText,
      selectedUnitText,
      summaryText: useCount > 0
        ? `累计打卡 ${useCount} 次，单次成本已降到 ${this.formatMoney(useCost)}`
        : '双击卡片或在详情点 +1 使用打卡，激活单次成本曲线'
    };
  },

  buildDustRadar(item) {
    const holdDays = Math.max(1, Number(item.holdDays) || this.daysSince(item.date));
    const useCount = Math.max(0, Number(item.useCount) || 0);
    const dust = this.buildDustIndex(holdDays, useCount);
    const activeRate = Math.max(0, Math.min(100, 100 - dust.index));

    return {
      index: dust.index,
      levelText: dust.levelText,
      trackWidth: dust.trackWidth,
      activeRateText: `${activeRate}%`,
      idleRateText: `${dust.index}%`,
      summaryText: dust.index >= 65
        ? '建议优先使用或走二手残值评估后出手'
        : '当前使用活跃度良好，继续保持'
    };
  },

  buildDetailItem(item) {
    const projectionDays = 90;
    return {
      ...item,
      dateText: item.date || '未填写',
      totalText: item.effectivePriceText || this.formatMoney(item.effectivePrice),
      dailyText: item.dailyCostText || this.formatMoney(item.dailyCost),
      holdText: item.holdText || `${item.holdDays || this.daysSince(item.date)}天`,
      usageModel: this.buildUsageModel(item),
      dustRadar: this.buildDustRadar(item),
      paybackQuantile: this.buildPaybackQuantile(item),
      futureProjection: this.buildFutureProjection(item, projectionDays)
    };
  },

  normalizeAssets(rawAssets) {
    return rawAssets.map((item) => {
      const price = this.parseNumber(item.price);
      const priceCurrencyCode = String(item.priceCurrencyCode || 'CNY').toUpperCase();
      const priceRate = this.parseNumber(item.priceRate) || 1;
      const originalPrice = (item.originalPrice !== undefined && item.originalPrice !== null && item.originalPrice !== '')
        ? this.parseNumber(item.originalPrice)
        : (priceCurrencyCode === 'CNY' ? price : (priceRate > 0 ? (price / priceRate) : price));
      const relatedList = this.normalizeRelatedItems(item.relatedList);
      const relatedTotal = relatedList.reduce((sum, rel) => sum + rel.amount, 0);
      const effectivePrice = price + relatedTotal;
      const resalePrice = this.parseNumber(item.resalePrice);
      const holdDays = this.daysSince(item.date);
      const dailyCost = holdDays ? effectivePrice / holdDays : effectivePrice;
      const useCount = Math.max(0, Number(item.useCount) || 0);
      const useCost = useCount > 0 ? (effectivePrice / useCount) : 0;
      const dustMeta = this.buildDustIndex(holdDays, useCount);
      const timeProgressMeta = this.buildTimeProgress(holdDays);
      const useProgressMeta = this.buildUseProgress(holdDays, useCount);
      const costMode = this.normalizeCostMode(item.costMode);
      const primaryCostText = (item.type || 'asset') === 'wish'
        ? this.formatMoney(effectivePrice)
        : (costMode === 'use'
          ? (useCount > 0 ? `${this.formatMoney(useCost)}/次` : '待打卡/次')
          : `${this.formatMoney(dailyCost)}/天`);
      const modeHintText = costMode === 'use'
        ? `${useCount > 0 ? `打卡${useCount}次` : '双击打卡'} · 单次 ${useCount > 0 ? this.formatMoney(useCost) : '待打卡'}`
        : `按时间计算 · 日均 ${this.formatMoney(dailyCost)}/天`;
      const progressMeta = costMode === 'use' ? useProgressMeta : timeProgressMeta;
      const progressLevelText = progressMeta.index >= 70
        ? '偏高'
        : (progressMeta.index >= 40 ? '中等' : '良好');
      const progressFillClass = progressMeta.index >= 70
        ? 'progress-red'
        : (progressMeta.index >= 40 ? 'progress-yellow' : 'progress-green');
      const status = item.status || 'serving';

      return {
        id: item.id,
        type: item.type || 'asset',
        name: item.name,
        price,
        originalPrice,
        priceCurrencyCode,
        priceCurrencyName: item.priceCurrencyName || priceCurrencyCode,
        priceRate,
        date: item.date,
        note: item.note || '',
        noteImagePath: item.noteImagePath || '',
        iconType: item.iconType || 'emoji',
        iconEmoji: item.iconEmoji || this.getDefaultIconByType(item.type || 'asset'),
        iconImagePath: item.iconImagePath || '',
        category: item.category || '全部',
        costMode,
        relatedList,
        relatedTotal,
        relatedTotalText: this.formatMoney(relatedTotal),
        effectivePrice,
        resalePrice,
        status,
        pinned: !!item.pinned,
        excludeAsset: !!item.excludeAsset,
        excludeDaily: !!item.excludeDaily,
        holdDays,
        dailyCost,
        useCount,
        useCost,
        useCostReady: useCount > 0,
        useCostText: useCount > 0 ? this.formatMoney(useCost) : '待打卡',
        useSummaryText: useCount > 0 ? `打卡 ${useCount} 次` : '双击打卡',
        primaryCostText,
        modeHintText,
        progressLabelText: `成本进度 ${progressMeta.index}% · ${progressLevelText}`,
        progressTrackWidth: progressMeta.trackWidth,
        progressFillClass,
        dustIndex: dustMeta.index,
        dustLevel: dustMeta.levelText,
        dustTrackWidth: dustMeta.trackWidth,
        priceText: this.formatMoney(price),
        effectivePriceText: this.formatMoney(effectivePrice),
        dailyCostText: this.formatMoney(dailyCost),
        holdText: `${holdDays}天`,
        statusText: this.getStatusText(status)
      };
    });
  },

  computeOverview(assets) {
    const visibleAssets = assets.filter((item) => item.type === 'asset');
    const total = visibleAssets.length;
    const servingCount = visibleAssets.filter((item) => item.status === 'serving').length;
    const retiredCount = visibleAssets.filter((item) => item.status === 'retired').length;
    const soldCount = visibleAssets.filter((item) => item.status === 'sold').length;

    const totalAsset = visibleAssets.reduce((sum, item) => {
      if (item.excludeAsset || item.status === 'sold') {
        return sum;
      }
      return sum + item.effectivePrice;
    }, 0);

    const dailyRows = visibleAssets.filter((item) => !item.excludeDaily);
    const avgDaily = dailyRows.reduce((sum, item) => sum + item.dailyCost, 0);

    const categoryRows = visibleAssets
      .filter((item) => !item.excludeAsset && item.status !== 'sold')
      .reduce((map, item) => {
        const key = item.category || '其他';
        map[key] = (map[key] || 0) + item.effectivePrice;
        return map;
      }, {});
    const categoryVisualList = Object.keys(categoryRows)
      .map((name) => {
        const value = categoryRows[name];
        const ratio = totalAsset > 0 ? Math.round((value / totalAsset) * 100) : 0;
        return {
          name,
          valueText: this.formatMoney(value),
          ratio,
          width: `${Math.max(8, ratio)}%`
        };
      })
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 5);

    const toProgress = (count) => {
      if (!total) return 0;
      return Math.round((count / total) * 100);
    };

    this.setData({
      overviewBadge: `${servingCount}/${total}`,
      totalAssetText: this.formatMoney(totalAsset),
      avgDailyCostText: this.formatMoney(avgDaily),
      categoryVisualList,
      statusSummary: [
        { id: 'serving', text: '服役中', count: servingCount, progress: toProgress(servingCount) },
        { id: 'retired', text: '已退役', count: retiredCount, progress: toProgress(retiredCount) },
        { id: 'sold', text: '已卖出', count: soldCount, progress: toProgress(soldCount) }
      ]
    });
  },

  rebuildViewAssets() {
    const { assets, activeFilter, sortOrder, listType, searchKeyword, showOnlyPinned } = this.data;
    const keyword = (searchKeyword || '').trim().toLowerCase();
    const filtered = assets
      .filter((item) => item.type === listType)
      .filter((item) => {
        if (listType !== 'asset') {
          return true;
        }
        return activeFilter === 'all' ? true : item.status === activeFilter;
      })
      .filter((item) => {
        if (!keyword) return true;
        const text = `${item.name || ''} ${item.note || ''}`.toLowerCase();
        return text.includes(keyword);
      })
      .filter((item) => {
        if (!showOnlyPinned) return true;
        return !!item.pinned;
      });

    filtered.sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }
      const diff = a.dailyCost - b.dailyCost;
      return sortOrder === 'desc' ? -diff : diff;
    });

    this.setData({ viewAssets: filtered });
  },

  loadAssets() {
    let rawAssets = wx.getStorageSync(STORAGE_KEY) || [];
    if (!Array.isArray(rawAssets) || !rawAssets.length) {
      const legacyAssets = wx.getStorageSync(LEGACY_STORAGE_KEY) || [];
      if (Array.isArray(legacyAssets) && legacyAssets.length) {
        rawAssets = legacyAssets;
        wx.setStorageSync(STORAGE_KEY, legacyAssets);
      }
    }
    const assets = this.normalizeAssets(rawAssets);
    this.setData({ assets });
    this.computeOverview(assets);
    this.rebuildViewAssets();
  },

  buildRawAssets(assets) {
    return (assets || []).map((item) => ({
      id: item.id,
      type: item.type,
      name: item.name,
      price: item.price,
      originalPrice: item.originalPrice,
      priceCurrencyCode: String(item.priceCurrencyCode || 'CNY').toUpperCase(),
      priceCurrencyName: item.priceCurrencyName || '人民币',
      priceRate: item.priceRate || 1,
      date: item.date,
      note: item.note,
      noteImagePath: item.noteImagePath || '',
      iconType: item.iconType || 'emoji',
      iconEmoji: item.iconEmoji || this.getDefaultIconByType(item.type || 'asset'),
      iconImagePath: item.iconImagePath || '',
      category: item.category,
      costMode: this.normalizeCostMode(item.costMode),
      relatedList: (item.relatedList || []).map((rel) => ({
        id: rel.id,
        name: rel.name,
        price: rel.price,
        originalPrice: rel.originalPrice,
        currencyCode: rel.currencyCode,
        currencyName: rel.currencyName,
        rate: rel.rate,
        qty: rel.qty
      })),
      resalePrice: item.resalePrice,
      status: item.status,
      pinned: !!item.pinned,
      excludeAsset: !!item.excludeAsset,
      excludeDaily: !!item.excludeDaily,
      useCount: Math.max(0, Number(item.useCount) || 0),
      lastUseAt: item.lastUseAt || ''
    }));
  },

  persistAssets(assets) {
    const raw = this.buildRawAssets(assets);
    wx.setStorageSync(STORAGE_KEY, raw);
  },

  setCloudSyncHint(state, text) {
    this.setData({
      cloudSyncState: state,
      cloudSyncText: text
    });
  },

  async syncAssetsFromCloud() {
    this.setCloudSyncHint('syncing', '正在同步云端...');
    try {
      const res = await wx.cloud.callFunction({ name: GET_XISHU_ASSETS_FN });
      const cloudAssets = Array.isArray(res.result && res.result.data) ? res.result.data : [];

      if (cloudAssets.length) {
        wx.setStorageSync(STORAGE_KEY, cloudAssets);
        const assets = this.normalizeAssets(cloudAssets);
        this.setData({ assets }, () => {
          this.computeOverview(assets);
          this.rebuildViewAssets();
        });
        this.setCloudSyncHint('synced', '已从云端同步');
        return;
      }

      const localAssets = wx.getStorageSync(STORAGE_KEY) || [];
      if (Array.isArray(localAssets) && localAssets.length) {
        this.setCloudSyncHint('syncing', '本地数据正在上传...');
        this.syncAssetsToCloud(localAssets, false);
      } else {
        this.setCloudSyncHint('synced', '云端已就绪');
      }
    } catch (error) {
      this.setCloudSyncHint('failed', '云端连接失败，使用本地数据');
      console.warn('悉数云端拉取失败，使用本地数据', error);
    }
  },

  async syncAssetsToCloud(rawAssets, showToast = false) {
    this.setCloudSyncHint('syncing', '正在同步云端...');
    try {
      const safeRaw = Array.isArray(rawAssets) ? rawAssets : [];
      const res = await wx.cloud.callFunction({
        name: SYNC_XISHU_ASSETS_FN,
        data: {
          xishuAssets: safeRaw
        }
      });

      if (res.result && res.result.success) {
        this.setCloudSyncHint('synced', '已同步到云端');
        if (showToast) {
          wx.showToast({ title: '已同步云端', icon: 'success' });
        }
        return;
      }

      this.setCloudSyncHint('failed', '云端同步失败，仅保存在本地');
      console.warn('悉数云端同步失败', res.result);
    } catch (error) {
      this.setCloudSyncHint('failed', '云端同步失败，仅保存在本地');
      console.warn('悉数云端同步异常', error);
    }
  },

  onFilterTap(event) {
    if (this.data.listType !== 'asset') {
      return;
    }
    const { id } = event.currentTarget.dataset;
    this.setData({ activeFilter: id }, () => {
      this.rebuildViewAssets();
    });
  },

  onSwitchListType(event) {
    const { type } = event.currentTarget.dataset;
    this.setData({
      listType: type,
      activeFilter: 'all'
    }, () => {
      this.rebuildViewAssets();
    });
  },

  onSearchInput(event) {
    this.setData({ searchKeyword: event.detail.value || '' }, () => {
      this.rebuildViewAssets();
    });
  },

  onSearchBlur() {
    this.setData({ searchFocus: false });
  },

  onToggleSort() {
    this.setData({
      sortOrder: this.data.sortOrder === 'desc' ? 'asc' : 'desc'
    }, () => {
      this.rebuildViewAssets();
    });
  },

  onToolbarAction(event) {
    const action = event.currentTarget.dataset.action;
    if (action === 'focus-search') {
      this.setData({ searchFocus: true });
      return;
    }

    if (action === 'toggle-pinned') {
      this.setData({
        showOnlyPinned: !this.data.showOnlyPinned
      }, () => {
        this.rebuildViewAssets();
      });
      return;
    }

    if (action === 'switch-list') {
      const nextType = this.data.listType === 'asset' ? 'wish' : 'asset';
      this.setData({
        listType: nextType,
        activeFilter: 'all'
      }, () => {
        this.rebuildViewAssets();
      });
      return;
    }

    if (action === 'reset') {
      this.setData({
        searchKeyword: '',
        activeFilter: 'all',
        showOnlyPinned: false,
        sortOrder: 'desc'
      }, () => {
        this.rebuildViewAssets();
      });
    }
  },

  onTapOcrImport() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const file = (res.tempFiles || [])[0];
        if (!file || !file.tempFilePath) {
          return;
        }
        
        wx.showLoading({
          title: 'AI 识别中...',
          mask: true
        });

        try {
          let parseImagePath = file.tempFilePath;

          try {
            const compressed = await new Promise((resolve, reject) => {
              wx.compressImage({
                src: file.tempFilePath,
                quality: 60,
                success: resolve,
                fail: reject
              });
            });
            if (compressed && compressed.tempFilePath) {
              parseImagePath = compressed.tempFilePath;
            }
          } catch (compressError) {
            console.warn('图片压缩失败，使用原图继续识别', compressError);
          }

          // 1. 读取图片转换为 Base64
          const fs = wx.getFileSystemManager();
          const base64Data = fs.readFileSync(parseImagePath, 'base64');
          const localApiKey = wx.getStorageSync(LOCAL_AI_KEY_STORAGE) || TEMP_FALLBACK_AI_KEY;
          if (!localApiKey) {
            wx.hideLoading();
            wx.showModal({
              title: '缺少 API Key',
              content: '请先在本地配置 SILICONFLOW_API_KEY，或在云函数环境变量中配置。',
              showCancel: false
            });
            return;
          }
          
          // 2. 调用云函数请求大模型
          const resCloud = await wx.cloud.callFunction({
            name: 'aiParseAsset',
            data: {
              imageBase64: base64Data,
              apiKey: localApiKey
            }
          });

          wx.hideLoading();

          if (resCloud.result && resCloud.result.success) {
            const aiData = resCloud.result.data || {};
            const rawName = aiData.name ? String(aiData.name) : '';
            const looksMeta = /"object"\s*:\s*"chat\.completion"|"id"\s*:\s*"[a-z0-9]+"/i.test(rawName);
            const normalizedName = (!looksMeta && rawName) ? rawName : '待确认商品';
            const normalizedPrice = aiData.price && Number(aiData.price) > 0 ? String(aiData.price) : '';
            const normalizedDate = aiData.date || '';
            const rawPreview = aiData.raw ? String(aiData.raw).slice(0, 120) : '';
            wx.showToast({
              title: '智能解析成功',
              icon: 'success'
            });

            this.setData({
              'formModel.name': normalizedName,
              'formModel.price': normalizedPrice,
              'formModel.date': normalizedDate,
              noteImagePath: parseImagePath,
              'formModel.note': rawPreview ? `【AI原图识别导入】${rawPreview}` : '【AI原图识别导入】'
            }, () => {
              this.updatePriceCnyPreview();
            });
          } else {
            // 如果云端 API 没配置好或解析失败，使用保底提示
            console.error('AI 解析失败:', resCloud.result);
            const errorMessage = (resCloud.result && resCloud.result.error) || 'AI 引擎当前未配置或响应异常';
            const providerMessage = (resCloud.result && resCloud.result.originalResponse && resCloud.result.originalResponse.error && (resCloud.result.originalResponse.error.message || resCloud.result.originalResponse.error.code || resCloud.result.originalResponse.error.type)) || '';
            wx.showModal({
              title: '识别超时或失败',
              content: `${errorMessage}${providerMessage ? `\n${providerMessage}` : ''}\n\n请确认：云函数 aiParseAsset 已部署到当前环境，并且已配置 SILICONFLOW_API_KEY。`,
              showCancel: false
            });
          }
        } catch (error) {
          wx.hideLoading();
          console.error("云函数调用异常:", error);
          wx.showModal({
            title: '网络异常',
            content: '无法连接到云端 AI 大模型，请确保云开发环境已激活。',
            showCancel: false
          });
        }
      }
    });
  },

  onOpenEditor() {
    this.resetEditorForm();
    this.setTabBarVisibility(false);
    this.setData({
      editorVisible: true,
      editorMode: 'create',
      editingId: ''
    });
  },

  onCloseEditor() {
    if (this.data.editorMode === 'edit' && this.data.editingId) {
      this.onSubmitEditor();
      return;
    }
    this.setTabBarVisibility(true);
    this.setData({ editorVisible: false });
  },

  onEditorTabChange(event) {
    const nextTab = event.currentTarget.dataset.id;
    const updates = {
      editorTab: nextTab,
      editorResalePredicting: false,
      editorResaleResult: null
    };
    if (this.data.editorMode !== 'edit' && this.data.formIconType !== 'image') {
      updates.formIconEmoji = this.getDefaultIconByType(nextTab);
      updates.formIconType = 'emoji';
    }
    this.setData(updates);
  },

  onTapAssetCard(event) {
    const { id } = event.currentTarget.dataset;
    const found = this.data.assets.find((item) => item.id === id);
    if (!found) {
      return;
    }

    if (found.type !== 'asset') {
      this.openAssetEditor(found);
      return;
    }

    const now = Date.now();
    if (this.lastTapAssetId === id && now - this.lastTapAt <= DOUBLE_TAP_WINDOW) {
      this.clearAssetTapTimer();
      this.lastTapAssetId = '';
      this.lastTapAt = 0;
      this.onQuickUseCheckin(id);
      return;
    }

    this.clearAssetTapTimer();
    this.lastTapAssetId = id;
    this.lastTapAt = now;
    this.assetTapTimer = setTimeout(() => {
      const latest = this.data.assets.find((item) => item.id === id);
      if (latest && latest.type === 'asset') {
        this.openAssetDetail(latest);
      }
      this.lastTapAssetId = '';
      this.lastTapAt = 0;
      this.clearAssetTapTimer();
    }, DOUBLE_TAP_WINDOW + 20);
  },

  openAssetDetail(found) {
    this.setTabBarVisibility(false);
    this.setData({
      detailVisible: true,
      detailItem: this.buildDetailItem(found)
    }, () => {
      this.refreshDetailTrendChart(found);
    });
  },

  onTapDetailUseCheckin() {
    const detail = this.data.detailItem;
    if (!detail || !detail.id) return;
    this.onQuickUseCheckin(detail.id, true);
  },

  onQuickUseCheckin(assetId, fromDetail = false) {
    const target = this.data.assets.find((item) => item.id === assetId && item.type === 'asset');
    if (!target) return;

    const next = this.data.assets.map((item) => {
      if (item.id !== assetId) return item;
      const currentUseCount = Math.max(0, Number(item.useCount) || 0);
      return {
        ...item,
        useCount: currentUseCount + 1,
        lastUseAt: new Date().toISOString().slice(0, 10)
      };
    });

    const rawNext = this.buildRawAssets(next);
    this.persistAssets(next);
    this.syncAssetsToCloud(rawNext, false);
    this.loadAssets();

    if (this.data.detailVisible) {
      const refreshed = this.data.assets.find((item) => item.id === assetId);
      if (refreshed) {
        this.setData({ detailItem: this.buildDetailItem(refreshed) }, () => {
          this.refreshDetailTrendChart(refreshed);
        });
      }
    }

    wx.showToast({ title: fromDetail ? '已打卡 +1' : '双击打卡 +1', icon: 'none' });
  },

  onCloseDetail() {
    this.setTabBarVisibility(true);
    this.setData({ detailVisible: false, detailItem: null });
  },

  onTapDetailEdit() {
    const detail = this.data.detailItem;
    if (!detail) return;
    const found = this.data.assets.find((item) => item.id === detail.id);
    if (!found) return;
    this.setData({ detailVisible: false, detailItem: null }, () => {
      this.openAssetEditor(found);
    });
  },

  buildDailyTrendSeries(item) {
    const totalDays = Math.max(1, item.holdDays || this.daysSince(item.date));
    const maxPoints = 45;
    const dayList = [];
    if (totalDays <= maxPoints) {
      for (let i = 1; i <= totalDays; i += 1) dayList.push(i);
    } else {
      for (let i = 0; i < maxPoints; i += 1) {
        const day = Math.max(1, Math.round((i * (totalDays - 1)) / (maxPoints - 1)) + 1);
        if (!dayList.length || day !== dayList[dayList.length - 1]) {
          dayList.push(day);
        }
      }
    }

    const start = item.date ? new Date(`${item.date}T00:00:00`) : new Date();
    const labels = dayList.map((day) => {
      const d = new Date(start.getTime() + (day - 1) * 24 * 60 * 60 * 1000);
      const m = `${d.getMonth() + 1}`.padStart(2, '0');
      const dd = `${d.getDate()}`.padStart(2, '0');
      return `${m}.${dd}`;
    });
    const values = dayList.map((day) => Number((this.parseNumber(item.effectivePrice) / Math.max(1, day)).toFixed(2)));
    return { labels, values };
  },

  buildPaybackQuantile(item) {
    const minSampleSize = 5;
    const { peers, sourceText } = this.getPaybackPeers(item);
    const peerDailyCosts = peers
      .map((peer) => this.parseNumber(peer.dailyCost))
      .filter((cost) => Number.isFinite(cost) && cost > 0);

    if (peerDailyCosts.length < minSampleSize) {
      return {
        ready: false,
        title: '样本不足',
        hint: `当前仅有 ${peerDailyCosts.length} 条有效样本（${sourceText}），至少需要 ${minSampleSize} 条`,
        sampleSize: peerDailyCosts.length,
        sourceText
      };
    }

    const currentDailyCost = this.parseNumber(item.dailyCost);
    if (!Number.isFinite(currentDailyCost) || currentDailyCost <= 0) {
      return {
        ready: false,
        title: '数据不足',
        hint: '当前资产日均成本异常，暂时无法计算分位线',
        sampleSize: peerDailyCosts.length,
        sourceText
      };
    }

    const betterCount = peerDailyCosts.filter((cost) => cost >= currentDailyCost).length;
    const beatPercent = Math.round((betterCount / peerDailyCosts.length) * 100);
    const clampedPercent = Math.max(0, Math.min(100, beatPercent));

    return {
      ready: true,
      beatPercent: clampedPercent,
      percentileTag: `P${Math.max(1, Math.min(99, clampedPercent || 1))}`,
      levelText: this.getPaybackQuantileLevel(clampedPercent),
      hint: `你当前的回本速度超过了 ${clampedPercent}% 的样本（${sourceText}）`,
      sampleSize: peerDailyCosts.length,
      sourceText,
      trackWidth: `${Math.max(6, clampedPercent)}%`
    };
  },

  getPaybackPeers(item) {
    const allAssets = (this.data.assets || []).filter((asset) => this.isValidPaybackSample(asset) && asset.id !== item.id);
    if (!allAssets.length) {
      return {
        peers: [],
        sourceText: '同类别'
      };
    }

    const sameCategory = allAssets.filter((asset) => (asset.category || '全部') === (item.category || '全部'));
    if (sameCategory.length >= 5) {
      return {
        peers: sameCategory,
        sourceText: `同类别·${item.category || '未分类'}`
      };
    }

    return {
      peers: allAssets,
      sourceText: '全资产'
    };
  },

  isValidPaybackSample(asset) {
    if (!asset || asset.type !== 'asset') return false;
    if (asset.status && asset.status !== 'serving') return false;
    if (asset.excludeDaily) return false;

    const dailyCost = this.parseNumber(asset.dailyCost);
    if (!Number.isFinite(dailyCost) || dailyCost <= 0) return false;

    const holdDays = Math.max(1, Number(asset.holdDays) || this.daysSince(asset.date));
    if (!Number.isFinite(holdDays) || holdDays <= 0) return false;

    return true;
  },

  getPaybackQuantileLevel(percent) {
    if (percent >= 80) return '回本效率领先';
    if (percent >= 60) return '回本效率良好';
    if (percent >= 40) return '回本效率居中';
    return '回本效率偏慢';
  },

  buildFutureProjection(item, selectedDays = 90) {
    const options = [30, 90, 180];
    const horizonDays = options.includes(Number(selectedDays)) ? Number(selectedDays) : 90;
    const effectivePrice = this.parseNumber(item.effectivePrice);
    const holdDays = Math.max(1, Number(item.holdDays) || this.daysSince(item.date));
    const currentDaily = effectivePrice > 0 ? (effectivePrice / holdDays) : 0;
    const futureHoldDays = holdDays + horizonDays;
    const projectedDaily = effectivePrice > 0 ? (effectivePrice / futureHoldDays) : 0;
    const dropPerDay = Math.max(0, currentDaily - projectedDaily);
    const dropPercent = currentDaily > 0 ? Math.round((dropPerDay / currentDaily) * 100) : 0;
    const benchmark = this.buildDailyBenchmark(item);

    return {
      options,
      selectedDays: horizonDays,
      currentDailyText: this.formatMoney(currentDaily),
      projectedDailyText: this.formatMoney(projectedDaily),
      dropDailyText: this.formatMoney(dropPerDay),
      dropPercentText: `${Math.max(0, Math.min(100, dropPercent))}%`,
      benchmarkText: benchmark.targetText,
      benchmarkSourceText: benchmark.sourceText,
      targetNeedDaysText: benchmark.needDaysText,
      summaryText: `继续使用 ${horizonDays} 天后，日均成本预计降至 ${this.formatMoney(projectedDaily)}/天`
    };
  },

  buildDailyBenchmark(item) {
    const { peers, sourceText } = this.getPaybackPeers(item);
    const validDailyCosts = peers
      .map((peer) => this.parseNumber(peer.dailyCost))
      .filter((cost) => Number.isFinite(cost) && cost > 0)
      .sort((a, b) => a - b);

    if (validDailyCosts.length < 5) {
      return {
        targetText: '样本不足',
        sourceText: `${sourceText} · P50`,
        needDaysText: '待更多样本',
        targetDaily: 0
      };
    }

    const mid = Math.floor(validDailyCosts.length / 2);
    const targetDaily = validDailyCosts.length % 2 === 0
      ? (validDailyCosts[mid - 1] + validDailyCosts[mid]) / 2
      : validDailyCosts[mid];
    const holdDays = Math.max(1, Number(item.holdDays) || this.daysSince(item.date));
    const effectivePrice = this.parseNumber(item.effectivePrice);
    const targetTotalDays = Math.ceil(effectivePrice / Math.max(0.01, targetDaily));
    const needDays = Math.max(0, targetTotalDays - holdDays);

    return {
      targetText: this.formatMoney(targetDaily),
      sourceText: `${sourceText} · P50`,
      needDaysText: needDays > 0 ? `${needDays} 天` : '已达到',
      targetDaily
    };
  },

  onSelectProjectionHorizon(event) {
    const days = Number(event.currentTarget.dataset.days || 90);
    const detail = this.data.detailItem;
    if (!detail) return;

    const found = this.data.assets.find((asset) => asset.id === detail.id) || detail;
    const projection = this.buildFutureProjection(found, days);
    this.setData({
      'detailItem.futureProjection': projection
    });
  },

  onShowPaybackSpec() {
    const quantile = (this.data.detailItem && this.data.detailItem.paybackQuantile) || {};
    const sampleSize = Number(quantile.sampleSize) || 0;
    const sourceText = quantile.sourceText || '同类别';

    wx.showModal({
      title: '回本分位线口径',
      content:
        `样本来源：${sourceText}\n` +
        `当前样本：${sampleSize} 条有效记录\n\n` +
        '计算公式：\n' +
        '超过占比 = 日均成本 >= 当前资产日均成本 的样本数 / 全部样本数\n\n' +
        '仅纳入：资产类型、服役中、未勾选“不计入日均”、日均成本有效。\n' +
        '不纳入：心愿、已退役、已卖出、无效或异常记录。',
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  buildEditorResaleAssetData() {
    const name = `${this.data.formModel.name || ''}`.trim();
    if (!name) {
      return { error: '请先填写物品名称' };
    }

    const priceOriginal = this.parseNumber(this.data.formModel.price);
    if (!(priceOriginal > 0)) {
      return { error: '请先填写价格' };
    }

    const date = this.data.formModel.date;
    if (!date) {
      return { error: '请先填写购买日期' };
    }

    const priceRate = this.getRateByCode(this.data.selectedPriceCurrencyCode || 'CNY');
    const basePrice = priceOriginal * priceRate;
    const relatedTotal = (this.data.relatedList || []).reduce((sum, item) => sum + this.parseNumber(item.amount), 0);
    const totalPrice = Math.max(0, basePrice + relatedTotal);
    const holdDays = Math.max(1, this.daysSince(date));

    return {
      data: {
        name,
        category: this.data.categoryOptions[this.data.categoryIndex] || '全部',
        price: totalPrice,
        holdDays
      }
    };
  },

  async onPredictEditorResale() {
    if (this.data.editorTab !== 'asset') {
      return;
    }

    const localApiKey = wx.getStorageSync(LOCAL_AI_KEY_STORAGE) || TEMP_FALLBACK_AI_KEY;
    if (!localApiKey) {
      wx.showModal({
        title: '缺少 API Key',
        content: '请先在本地配置 SILICONFLOW_API_KEY',
        showCancel: false
      });
      return;
    }

    const { data: assetData, error } = this.buildEditorResaleAssetData();
    if (error) {
      wx.showToast({ title: error, icon: 'none' });
      return;
    }

    this.setData({
      editorResalePredicting: true,
      editorResaleResult: null
    });

    try {
      const res = await wx.cloud.callFunction({
        name: 'aiEstimateResale',
        data: {
          asset: assetData,
          apiKey: localApiKey
        }
      });

      if (res.result && res.result.success && res.result.data) {
        const resaleData = res.result.data;
        const estPrice = Number(resaleData.estimatedPrice) || 0;
        const netCost = Math.max(0, assetData.price - estPrice);
        const netDaily = Number((netCost / Math.max(1, assetData.holdDays)).toFixed(2));
        const generatedAt = new Date().toLocaleString('zh-CN', { hour12: false });

        this.setData({
          editorResaleResult: {
            ...resaleData,
            estimatedPriceRaw: estPrice,
            estimatedPriceText: this.formatMoney(estPrice),
            netDailyText: this.formatMoney(netDaily),
            generatedAt,
            sourceText: resaleData.sourceText || 'SiliconFlow + 微信云函数',
            modelText: resaleData.modelText || 'Qwen/Qwen2.5-7B-Instruct'
          },
          editorResalePredicting: false
        });
      } else {
        throw new Error(res.result ? res.result.error : '预测失败');
      }
    } catch (e) {
      this.setData({ editorResalePredicting: false });
      wx.showToast({ title: e.message || '网络异常', icon: 'none' });
    }
  },

  onApplyEditorResalePrice() {
    const result = this.data.editorResaleResult;
    if (!result) return;

    const estimated = this.parseNumber(result.estimatedPriceRaw || result.estimatedPrice);
    if (!(estimated > 0)) {
      wx.showToast({ title: '预测价格无效', icon: 'none' });
      return;
    }

    this.setData({
      'formModel.resalePrice': `${Number(estimated.toFixed(2))}`
    });
    wx.showToast({ title: '已回填到卖出价格', icon: 'none' });
  },

  async onPredictResale() {
    const detail = this.data.detailItem;
    if (!detail) return;

    // Check if API KEY is set
    const localApiKey = wx.getStorageSync(LOCAL_AI_KEY_STORAGE) || TEMP_FALLBACK_AI_KEY;
    if (!localApiKey) {
      wx.showModal({
        title: '缺少 API Key',
        content: '请先在本地配置 SILICONFLOW_API_KEY',
        showCancel: false
      });
      return;
    }

    this.setData({
      'detailItem.resalePredicting': true,
      'detailItem.resaleResult': null
    });

    try {
      const assetData = {
        name: detail.name,
        category: detail.category,
        price: this.parseNumber(detail.effectivePrice),
        holdDays: Math.max(1, Number(detail.holdDays) || this.daysSince(detail.date))
      };

      const res = await wx.cloud.callFunction({
        name: 'aiEstimateResale',
        data: {
          asset: assetData,
          apiKey: localApiKey
        }
      });

      if (res.result && res.result.success && res.result.data) {
        const resaleData = res.result.data;
        const estPrice = Number(resaleData.estimatedPrice) || 0;
        const netCost = Math.max(0, assetData.price - estPrice);
        const netDaily = Number((netCost / assetData.holdDays).toFixed(2));
        const generatedAt = new Date().toLocaleString('zh-CN', { hour12: false });

        this.setData({
          'detailItem.resaleResult': {
            ...resaleData,
            estimatedPriceText: this.formatMoney(estPrice),
            netDailyText: this.formatMoney(netDaily),
            generatedAt,
            sourceText: resaleData.sourceText || 'SiliconFlow + 微信云函数',
            modelText: resaleData.modelText || 'Qwen/Qwen2.5-7B-Instruct'
          },
          'detailItem.resalePredicting': false
        });
      } else {
        throw new Error(res.result ? res.result.error : '预测失败');
      }
    } catch (e) {
      this.setData({ 'detailItem.resalePredicting': false });
      wx.showToast({ title: e.message || '网络异常', icon: 'none' });
    }
  },

  refreshDetailTrendChart(item) {
    const chartComponent = this.selectComponent('#xishu-detail-trend-chart');
    if (!chartComponent || !item) return;

    const { labels, values } = this.buildDailyTrendSeries(item);
    if (!labels.length || !values.length) return;

    chartComponent.init((canvas, width, height, dpr) => {
      const chart = initChart(canvas, width, height, dpr);
      chart.setOption({
        color: ['#84d816'],
        grid: { top: '14%', left: '8%', right: '8%', bottom: '14%', containLabel: true },
        tooltip: {
          trigger: 'axis',
          confine: true,
          valueFormatter: (value) => `¥${Number(value || 0).toFixed(2)}`
        },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: labels,
          axisLabel: { color: '#8d93a1', fontSize: 10 }
        },
        yAxis: {
          type: 'value',
          axisLabel: { color: '#8d93a1', fontSize: 10 },
          splitLine: { lineStyle: { color: '#eceff5' } }
        },
        series: [{
          type: 'line',
          data: values,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 3 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(132, 216, 22, 0.26)' },
                { offset: 1, color: 'rgba(132, 216, 22, 0.03)' }
              ]
            }
          }
        }]
      });
      return chart;
    });
  },

  openAssetEditor(found) {

    const categoryIndex = Math.max(0, this.data.categoryOptions.indexOf(found.category || '全部'));
    const statusSwitches = {
      retired: found.status === 'retired',
      sold: found.status === 'sold'
    };

    this.setTabBarVisibility(false);

    this.setData({
      editorVisible: true,
      editorMode: 'edit',
      editingId: found.id,
      editorTab: found.type || 'asset',
      categoryIndex,
      formStatus: found.status || 'serving',
      statusSwitches,
      formModel: {
        name: found.name || '',
        price: `${found.originalPrice || found.price || 0}`,
        date: found.date || '',
        resalePrice: `${found.resalePrice || 0}`,
        note: found.note || '',
        relatedItems: ''
      },
      selectedPriceCurrencyCode: String(found.priceCurrencyCode || 'CNY').toUpperCase(),
      selectedPriceCurrencyName: found.priceCurrencyName || '人民币',
      formIconType: found.iconType || 'emoji',
      formIconEmoji: found.iconEmoji || this.getDefaultIconByType(found.type || 'asset'),
      formIconImagePath: found.iconImagePath || '',
      noteImagePath: found.noteImagePath || '',
      activeCostMode: this.normalizeCostMode(found.costMode),
      relatedList: this.normalizeRelatedItems(found.relatedList || []),
      relatedDraft: {
        name: '',
        price: '',
        qty: '1'
      },
      showRelatedCurrencyModal: false,
      selectedRelatedCurrencyCode: 'CNY',
      selectedRelatedCurrencyName: '人民币',
      toggles: {
        pinned: !!found.pinned,
        excludeAsset: !!found.excludeAsset,
        excludeDaily: !!found.excludeDaily
      },
      editorResalePredicting: false,
      editorResaleResult: null
    }, () => {
      this.updateRelatedTotal(this.data.relatedList);
      this.updatePriceCnyPreview();
      this.updateRelatedCnyPreview();
    });
  },

  onCostModeChange(event) {
    this.setData({ activeCostMode: event.currentTarget.dataset.id });
  },

  onSelectDetailCostMode(event) {
    const detail = this.data.detailItem;
    const mode = this.normalizeCostMode(event.currentTarget.dataset.mode);
    if (!detail || !detail.id || !mode) return;

    const next = this.data.assets.map((item) => {
      if (item.id !== detail.id) return item;
      return {
        ...item,
        costMode: mode
      };
    });

    const rawNext = this.buildRawAssets(next);
    this.persistAssets(next);
    this.syncAssetsToCloud(rawNext, false);
    this.loadAssets();

    const refreshed = this.data.assets.find((item) => item.id === detail.id);
    if (refreshed) {
      this.setData({ detailItem: this.buildDetailItem(refreshed) });
    }
  },

  onChooseNoteImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const file = (res.tempFiles || [])[0];
        if (!file || !file.tempFilePath) {
          return;
        }
        this.setData({ noteImagePath: file.tempFilePath });
      }
    });
  },

  onPreviewNoteImage() {
    const path = this.data.noteImagePath;
    if (!path) return;
    wx.previewImage({
      urls: [path],
      current: path
    });
  },

  onRemoveNoteImage() {
    wx.showModal({
      title: '删除确认',
      content: '确定删除这张备注图片吗？',
      confirmText: '删除',
      confirmColor: '#d84444',
      success: ({ confirm }) => {
        if (!confirm) return;
        this.setData({ noteImagePath: '' });
      }
    });
  },

  onCategoryChange(event) {
    this.setData({ categoryIndex: Number(event.detail.value) || 0 });
  },

  onOpenPriceCurrencyModal() {
    this.ensureExchangeRates(false);
    this.setData({ showPriceCurrencyModal: true });
  },

  onClosePriceCurrencyModal() {
    this.setData({ showPriceCurrencyModal: false });
  },

  onSelectPriceCurrency(event) {
    const code = String(event.currentTarget.dataset.code || 'CNY').toUpperCase();
    const name = String(event.currentTarget.dataset.name || code);
    this.setData({
      selectedPriceCurrencyCode: code,
      selectedPriceCurrencyName: name
    }, () => {
      this.updatePriceCnyPreview();
    });
  },

  onConfirmPriceCurrency() {
    this.setData({ showPriceCurrencyModal: false }, () => {
      this.updatePriceCnyPreview();
    });
  },

  onOpenRelatedCurrencyModal() {
    this.ensureExchangeRates(false);
    this.setData({ showRelatedCurrencyModal: true }, () => {
      this.updateRelatedCnyPreview();
    });
  },

  onCloseRelatedCurrencyModal() {
    this.setData({ showRelatedCurrencyModal: false });
  },

  onSelectRelatedCurrency(event) {
    const code = String(event.currentTarget.dataset.code || 'CNY').toUpperCase();
    const name = String(event.currentTarget.dataset.name || code);
    this.setData({
      selectedRelatedCurrencyCode: code,
      selectedRelatedCurrencyName: name
    }, () => {
      this.updateRelatedCnyPreview();
    });
  },

  onRelatedPriceInput(event) {
    const value = (event.detail.value || '').replace(/[^0-9.]/g, '');
    this.setData({ 'relatedDraft.price': value }, () => {
      this.updateRelatedCnyPreview();
    });
  },

  onConfirmRelatedCurrency() {
    const trimmedName = `${this.data.relatedDraft.name || ''}`.trim();
    const unitOriginalPrice = this.parseNumber(this.data.relatedDraft.price);
    if (!trimmedName) {
      wx.showToast({ title: '请输入附加物品名称', icon: 'none' });
      return;
    }
    if (!(unitOriginalPrice > 0)) {
      wx.showToast({ title: '请输入附加物品单价', icon: 'none' });
      return;
    }

    this.setData({ showRelatedCurrencyModal: false }, () => {
      this.onAddRelatedItem();
    });
  },

  onPickIconEmoji(event) {
    const emoji = event.currentTarget.dataset.emoji;
    if (!emoji) return;
    this.setData({
      iconPickerDraftType: 'emoji',
      iconPickerDraftEmoji: emoji,
      iconPickerDraftImagePath: '',
      iconPickerTab: 'emoji'
    });
  },

  onTapIconEdit() {
    this.openIconLibraryPanel();
  },

  async openIconLibraryPanel() {
    const draftType = this.data.formIconType || 'emoji';
    const draftEmoji = this.data.formIconEmoji || this.getDefaultIconByType(this.data.editorTab);
    const draftImagePath = this.data.formIconImagePath || '';

    this.setData({
      iconLibraryVisible: true,
      iconLibraryLoading: true,
      iconLibraryItems: [],
      iconLibraryDisplayedItems: [],
      iconLibraryCategories: ['全部'],
      iconLibraryActiveCategory: '全部',
      iconLibraryKeyword: '',
      iconLibraryPage: 1,
      iconLibraryHasMore: false,
      iconPickerTab: draftType === 'image' ? 'library' : 'emoji',
      iconPickerDraftType: draftType,
      iconPickerDraftEmoji: draftEmoji,
      iconPickerDraftImagePath: draftImagePath
    });

    try {
      const res = await wx.cloud.callFunction({ name: 'getIconLibrary' });
      let cloudItems = [];
      if (res.result && res.result.success && Array.isArray(res.result.data)) {
        cloudItems = res.result.data.map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category || '其他',
          path: item.url,
          source: 'cloud'
        }));
      }

      const localItems = (this.data.localIconPresets || []).map((item) => ({
        id: item.id,
        name: item.name,
        category: '本地',
        path: item.path,
        source: 'local'
      }));

      const merged = [...cloudItems, ...localItems];
      const dynamicCategories = Array.from(new Set(merged.map((item) => item.category).filter(Boolean)));
      const categories = [
        '全部',
        ...(this.data.recentIconItems && this.data.recentIconItems.length ? ['最近'] : []),
        ...dynamicCategories
      ];

      this.setData({
        iconLibraryItems: merged,
        iconLibraryCategories: categories,
        iconLibraryActiveCategory: '全部',
        iconLibraryLoading: false
      }, () => {
        this.resetDisplayedIconLibraryItems();
      });
    } catch (error) {
      const localItems = (this.data.localIconPresets || []).map((item) => ({
        id: item.id,
        name: item.name,
        category: '本地',
        path: item.path,
        source: 'local'
      }));
      this.setData({
        iconLibraryItems: localItems,
        iconLibraryDisplayedItems: [],
        iconLibraryCategories: [
          '全部',
          ...(this.data.recentIconItems && this.data.recentIconItems.length ? ['最近'] : []),
          '本地'
        ],
        iconLibraryActiveCategory: '全部',
        iconLibraryLoading: false
      }, () => {
        this.resetDisplayedIconLibraryItems();
      });
      wx.showToast({ title: '云图标库加载失败，已回退本地', icon: 'none' });
    }
  },

  getFilteredIconLibraryItems() {
    const { iconLibraryItems, iconLibraryActiveCategory, iconLibraryKeyword, recentIconItems } = this.data;
    const keyword = String(iconLibraryKeyword || '').trim().toLowerCase();
    const sourceList = iconLibraryActiveCategory === '最近' ? (recentIconItems || []) : (iconLibraryItems || []);
    return sourceList.filter((item) => {
      const byCategory = iconLibraryActiveCategory === '全部' || iconLibraryActiveCategory === '最近' || item.category === iconLibraryActiveCategory;
      if (!byCategory) return false;
      if (!keyword) return true;
      const name = String(item.name || '').toLowerCase();
      const id = String(item.id || '').toLowerCase();
      const category = String(item.category || '').toLowerCase();
      return name.includes(keyword) || id.includes(keyword) || category.includes(keyword);
    });
  },

  resetDisplayedIconLibraryItems() {
    const filtered = this.getFilteredIconLibraryItems();
    const pageSize = Number(this.data.iconLibraryPageSize || 24);
    const next = filtered.slice(0, pageSize);
    this.setData({
      iconLibraryPage: 1,
      iconLibraryDisplayedItems: next,
      iconLibraryHasMore: filtered.length > next.length
    });
  },

  loadMoreIconLibraryItems() {
    const filtered = this.getFilteredIconLibraryItems();
    const pageSize = Number(this.data.iconLibraryPageSize || 24);
    const nextPage = Number(this.data.iconLibraryPage || 1) + 1;
    const nextLength = nextPage * pageSize;
    const next = filtered.slice(0, nextLength);
    this.setData({
      iconLibraryPage: nextPage,
      iconLibraryDisplayedItems: next,
      iconLibraryHasMore: filtered.length > next.length
    });
  },

  onCloseIconLibraryPanel() {
    this.setData({ iconLibraryVisible: false });
  },

  onConfirmIconLibraryPanel() {
    const nextType = this.data.iconPickerDraftType || 'emoji';
    const nextEmoji = this.data.iconPickerDraftEmoji || this.getDefaultIconByType(this.data.editorTab);
    const nextImage = this.data.iconPickerDraftImagePath || '';

    if (nextType === 'image' && nextImage) {
      this.saveRecentIcon({
        id: `recent_${Date.now()}`,
        name: '最近使用',
        category: '最近',
        path: nextImage,
        source: 'recent'
      });
    }

    this.setData({
      formIconType: nextType,
      formIconEmoji: nextEmoji,
      formIconImagePath: nextType === 'image' ? nextImage : '',
      iconLibraryVisible: false
    });
  },

  onIconPickerTabTap(event) {
    const tab = event.currentTarget.dataset.tab;
    if (!tab) return;
    this.setData({ iconPickerTab: tab });
    if (tab === 'album') {
      this.onChooseIconImage();
    }
  },

  onIconLibraryCategoryTap(event) {
    const category = event.currentTarget.dataset.category || '全部';
    this.setData({ iconLibraryActiveCategory: category }, () => {
      this.resetDisplayedIconLibraryItems();
    });
  },

  onIconLibrarySearchInput(event) {
    const keyword = event.detail.value || '';
    this.setData({ iconLibraryKeyword: keyword }, () => {
      this.resetDisplayedIconLibraryItems();
    });
  },

  onIconLibraryScrollToLower() {
    if (this.data.iconLibraryLoading || !this.data.iconLibraryHasMore) {
      return;
    }
    this.loadMoreIconLibraryItems();
  },

  onIconGridImageError(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isFinite(index) || index < 0) return;

    const list = Array.isArray(this.data.iconLibraryDisplayedItems)
      ? [...this.data.iconLibraryDisplayedItems]
      : [];
    const found = list[index];
    if (!found) return;

    const fallbackPath = '/images/icons/usercenter.png';
    if (found.path === fallbackPath) return;

    list[index] = {
      ...found,
      path: fallbackPath
    };
    this.setData({ iconLibraryDisplayedItems: list });
  },

  onPickLibraryIcon(event) {
    const path = event.currentTarget.dataset.path;
    const name = event.currentTarget.dataset.name || '';
    const id = event.currentTarget.dataset.id || '';
    const category = event.currentTarget.dataset.category || '最近';
    const source = event.currentTarget.dataset.source || 'library';
    if (!path) return;
    this.setData({
      iconPickerDraftType: 'image',
      iconPickerDraftImagePath: path,
      iconPickerDraftEmoji: this.data.iconPickerDraftEmoji || this.getDefaultIconByType(this.data.editorTab),
      iconPickerTab: 'library'
    });
  },

  onChooseIconImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const file = (res.tempFiles || [])[0];
        if (!file || !file.tempFilePath) return;
        wx.saveFile({
          tempFilePath: file.tempFilePath,
          success: ({ savedFilePath }) => {
            this.setData({
              iconPickerDraftType: 'image',
              iconPickerDraftImagePath: savedFilePath,
              iconPickerDraftEmoji: this.data.iconPickerDraftEmoji || this.getDefaultIconByType(this.data.editorTab),
              iconPickerTab: 'album'
            });
          },
          fail: () => {
            this.setData({
              iconPickerDraftType: 'image',
              iconPickerDraftImagePath: file.tempFilePath,
              iconPickerDraftEmoji: this.data.iconPickerDraftEmoji || this.getDefaultIconByType(this.data.editorTab),
              iconPickerTab: 'album'
            });
          }
        });
      }
    });
  },

  onClearIconImage() {
    this.setData({
      iconPickerDraftType: 'emoji',
      iconPickerDraftImagePath: '',
      iconPickerDraftEmoji: this.getDefaultIconByType(this.data.editorTab),
      iconPickerTab: 'emoji'
    });
  },

  onFormStatusChange(event) {
    const key = event.currentTarget.dataset.key;
    const checked = !!event.detail.value;
    const next = {
      ...this.data.statusSwitches,
      [key]: checked
    };

    if (next.sold) {
      this.setData({
        statusSwitches: {
          sold: true,
          retired: false
        },
        formStatus: 'sold'
      });
      return;
    }

    if (next.retired) {
      this.setData({
        statusSwitches: {
          sold: false,
          retired: true
        },
        formStatus: 'retired'
      });
      return;
    }

    this.setData({
      statusSwitches: {
        sold: false,
        retired: false
      },
      formStatus: 'serving'
    });
  },

  onToggleSetting(event) {
    const { key } = event.currentTarget.dataset;
    this.setData({ [`toggles.${key}`]: !!event.detail.value });
  },

  onFormInput(event) {
    const { field } = event.currentTarget.dataset;
    this.setData({ [`formModel.${field}`]: event.detail.value });
  },

  onPriceInput(event) {
    const value = (event.detail.value || '').replace(/[^0-9.]/g, '');
    this.setData({ 'formModel.price': value }, () => {
      this.updatePriceCnyPreview();
    });
  },

  onRelatedInput(event) {
    const { field } = event.currentTarget.dataset;
    this.setData({ [`relatedDraft.${field}`]: event.detail.value });
  },

  onAddRelatedItem() {
    const { name, price, qty } = this.data.relatedDraft;
    const trimmedName = `${name || ''}`.trim();
    const unitOriginalPrice = this.parseNumber(price);
    const currencyCode = String(this.data.selectedRelatedCurrencyCode || 'CNY').toUpperCase();
    const currencyName = this.data.selectedRelatedCurrencyName || currencyCode;
    const unitRate = this.getRateByCode(currencyCode);
    const unitPrice = unitOriginalPrice * unitRate;
    const quantity = Math.max(1, Math.floor(this.parseNumber(qty) || 1));

    if (!trimmedName) {
      wx.showToast({ title: '请输入附加物品名称', icon: 'none' });
      return;
    }

    const newItem = {
      id: `rel_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      name: trimmedName,
      price: unitPrice,
      originalPrice: unitOriginalPrice,
      currencyCode,
      currencyName,
      rate: unitRate,
      qty: quantity,
      amount: unitPrice * quantity,
      priceText: this.formatMoney(unitPrice),
      amountText: this.formatMoney(unitPrice * quantity)
    };

    const next = [...this.data.relatedList, newItem];
    this.setData({
      relatedList: next,
      relatedDraft: {
        name: '',
        price: '',
        qty: '1'
      },
      selectedRelatedCurrencyCode: 'CNY',
      selectedRelatedCurrencyName: '人民币'
    });
    this.updateRelatedTotal(next);
    this.updateRelatedCnyPreview();
  },

  onRemoveRelatedItem(event) {
    const { id } = event.currentTarget.dataset;
    wx.showModal({
      title: '删除确认',
      content: '确定删除该附加物品吗？',
      confirmText: '删除',
      confirmColor: '#d84444',
      success: ({ confirm }) => {
        if (!confirm) return;
        const next = this.data.relatedList.filter((item) => item.id !== id);
        this.setData({ relatedList: next });
        this.updateRelatedTotal(next);
      }
    });
  },

  onFormDateChange(event) {
    this.setData({ 'formModel.date': event.detail.value });
  },

  resetEditorForm() {
    this.setData({
      editorTab: 'asset',
      activeCostMode: 'time',
      categoryIndex: 0,
      formStatus: 'serving',
      statusSwitches: {
        retired: false,
        sold: false
      },
      formModel: {
        name: '',
        price: '',
        date: '',
        resalePrice: '',
        note: '',
        relatedItems: ''
      },
      showPriceCurrencyModal: false,
      selectedPriceCurrencyCode: 'CNY',
      selectedPriceCurrencyName: '人民币',
      formIconType: 'emoji',
      formIconEmoji: this.getDefaultIconByType('asset'),
      formIconImagePath: '',
      noteImagePath: '',
      relatedDraft: {
        name: '',
        price: '',
        qty: '1'
      },
      showRelatedCurrencyModal: false,
      selectedRelatedCurrencyCode: 'CNY',
      selectedRelatedCurrencyName: '人民币',
      relatedList: [],
      relatedTotalText: '¥0.00',
      editorResalePredicting: false,
      editorResaleResult: null,
      toggles: {
        pinned: false,
        excludeAsset: false,
        excludeDaily: false
      }
    }, () => {
      this.updatePriceCnyPreview();
      this.updateRelatedCnyPreview();
    });
  },

  onSubmitEditor() {
    const {
      formModel,
      editorTab,
      formStatus,
      toggles,
      categoryOptions,
      categoryIndex,
      editorMode,
      editingId,
      assets,
      relatedList
    } = this.data;
    const { name, price, date, resalePrice, note } = formModel;
    const priceCurrencyCode = String(this.data.selectedPriceCurrencyCode || 'CNY').toUpperCase();
    const priceCurrencyName = this.data.selectedPriceCurrencyName || priceCurrencyCode;
    const originalPrice = this.parseNumber(price);
    const priceRate = this.getRateByCode(priceCurrencyCode);
    const priceInCny = originalPrice * priceRate;

    if (editorTab === 'asset') {
      if (!name || !price || !date) {
        wx.showToast({ title: '请填写名称、价格、日期', icon: 'none' });
        return;
      }
    } else if (!name || !price) {
      wx.showToast({ title: '请填写心愿名称和价格', icon: 'none' });
      return;
    }

    const payload = {
      id: editorMode === 'edit' ? editingId : `asset_${Date.now()}`,
      type: editorTab,
      name,
      price: priceInCny,
      originalPrice,
      priceCurrencyCode,
      priceCurrencyName,
      priceRate,
      date,
      note,
      noteImagePath: this.data.noteImagePath,
      iconType: this.data.formIconType,
      iconEmoji: this.data.formIconEmoji || this.getDefaultIconByType(editorTab),
      iconImagePath: this.data.formIconType === 'image' ? this.data.formIconImagePath : '',
      category: categoryOptions[categoryIndex] || '全部',
      costMode: this.data.activeCostMode,
      relatedList: (relatedList || []).map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        originalPrice: item.originalPrice,
        currencyCode: item.currencyCode,
        currencyName: item.currencyName,
        rate: item.rate,
        qty: item.qty
      })),
      resalePrice: this.parseNumber(resalePrice),
      useCount: editorMode === 'edit'
        ? Math.max(0, Number((assets.find((item) => item.id === editingId) || {}).useCount) || 0)
        : 0,
      status: formStatus,
      pinned: toggles.pinned,
      excludeAsset: toggles.excludeAsset,
      excludeDaily: toggles.excludeDaily
    };

    const next = editorMode === 'edit'
      ? assets.map((item) => (item.id === editingId ? { ...item, ...payload } : item))
      : [payload, ...assets];

    const rawNext = this.buildRawAssets(next);
    this.persistAssets(next);
    this.syncAssetsToCloud(rawNext, false);
    this.loadAssets();
    this.setTabBarVisibility(true);
    this.setData({
      editorVisible: false,
      editorMode: 'create',
      editingId: ''
    });
    this.resetEditorForm();
    wx.showToast({
      title: editorMode === 'edit' ? '已更新' : (editorTab === 'asset' ? '资产已保存' : '心愿已保存'),
      icon: 'success'
    });
  },

  onDeleteAsset(event) {
    const { id } = event.currentTarget.dataset;
    this.deleteAssetById(id);
  },

  onDeleteDetailAsset() {
    const detail = this.data.detailItem;
    if (!detail || !detail.id) return;
    this.deleteAssetById(detail.id, true);
  },

  deleteAssetById(id, fromDetail = false) {
    wx.showModal({
      title: '删除确认',
      content: '确定删除这条资产记录吗？',
      confirmText: '删除',
      confirmColor: '#d84444',
      success: ({ confirm }) => {
        if (!confirm) return;
        const left = this.data.assets.filter((item) => item.id !== id);
        const rawLeft = this.buildRawAssets(left);
        this.persistAssets(left);
        this.syncAssetsToCloud(rawLeft, false);
        this.loadAssets();
        if (fromDetail) {
          this.setTabBarVisibility(true);
          this.setData({ detailVisible: false, detailItem: null });
        }
        wx.showToast({ title: '已删除', icon: 'none' });
      }
    });
  }
});
