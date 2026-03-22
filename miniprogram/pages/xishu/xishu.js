const STORAGE_KEY = 'XISHU_ASSETS_V1';
const LEGACY_STORAGE_KEY = 'YOUSHU_ASSETS_V3';
const LOCAL_AI_KEY_STORAGE = 'SILICONFLOW_API_KEY';
const RECENT_ICON_STORAGE_KEY = 'XISHU_RECENT_ICONS_V1';
const TEMP_FALLBACK_AI_KEY = 'sk-mawvwwscqojwzibuscyhkyooyitszaxfvykfeuodpmzmliwm';

Page({
  data: {
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
      { id: 'none', text: '不设定' },
      { id: 'price', text: '按价格' },
      { id: 'period', text: '按周期' },
      { id: 'custom', text: '自定义' }
    ],
    activeCostMode: 'none',
    formStatusOptions: [
      { id: 'serving', text: '服役中' },
      { id: 'retired', text: '已退役' },
      { id: 'sold', text: '已卖出' }
    ],
    categoryOptions: ['全部', '数码', '黄金', '外币', '潮玩', '账号', '其他'],
    iconPresets: ['📦', '🎒', '📱', '⌚', '💻', '🎧', '🎮', '🧸', '💄', '👟'],
    localIconPresets: [
      { id: 'goods', name: '商品', path: '/images/icons/goods.png' },
      { id: 'business', name: '业务', path: '/images/icons/business.png' },
      { id: 'examples', name: '案例', path: '/images/icons/examples.png' },
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
    relatedDraft: {
      name: '',
      price: '',
      qty: '1'
    },
    relatedList: [],
    relatedTotalText: '¥0.00',
    noteImagePath: '',
    toggles: {
      pinned: false,
      excludeAsset: false,
      excludeDaily: false
    },
    assets: [],
    viewAssets: [],
    overviewBadge: '0/0',
    totalAssetText: '¥0.00',
    avgDailyCostText: '¥0.00',
    statusSummary: [
      { id: 'serving', text: '服役中', count: 0, progress: 0 },
      { id: 'retired', text: '已退役', count: 0, progress: 0 },
      { id: 'sold', text: '已卖出', count: 0, progress: 0 }
    ]
  },

  onLoad() {
    this.loadAssets();
    this.loadRecentIcons();
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
    wx.showTabBar({
      animation: false
    });
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

  normalizeAssets(rawAssets) {
    return rawAssets.map((item) => {
      const price = this.parseNumber(item.price);
      const relatedList = this.normalizeRelatedItems(item.relatedList);
      const relatedTotal = relatedList.reduce((sum, rel) => sum + rel.amount, 0);
      const effectivePrice = price + relatedTotal;
      const resalePrice = this.parseNumber(item.resalePrice);
      const holdDays = this.daysSince(item.date);
      const dailyCost = holdDays ? effectivePrice / holdDays : effectivePrice;
      const status = item.status || 'serving';

      return {
        id: item.id,
        type: item.type || 'asset',
        name: item.name,
        price,
        date: item.date,
        note: item.note || '',
        noteImagePath: item.noteImagePath || '',
        iconType: item.iconType || 'emoji',
        iconEmoji: item.iconEmoji || this.getDefaultIconByType(item.type || 'asset'),
        iconImagePath: item.iconImagePath || '',
        category: item.category || '全部',
        costMode: item.costMode || 'none',
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
    const avgDaily = dailyRows.length
      ? dailyRows.reduce((sum, item) => sum + item.dailyCost, 0) / dailyRows.length
      : 0;

    const toProgress = (count) => {
      if (!total) return 0;
      return Math.round((count / total) * 100);
    };

    this.setData({
      overviewBadge: `${servingCount}/${total}`,
      totalAssetText: this.formatMoney(totalAsset),
      avgDailyCostText: this.formatMoney(avgDaily),
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

  persistAssets(assets) {
    const raw = assets.map((item) => ({
      id: item.id,
      type: item.type,
      name: item.name,
      price: item.price,
      date: item.date,
      note: item.note,
      noteImagePath: item.noteImagePath || '',
      iconType: item.iconType || 'emoji',
      iconEmoji: item.iconEmoji || this.getDefaultIconByType(item.type || 'asset'),
      iconImagePath: item.iconImagePath || '',
      category: item.category,
      costMode: item.costMode || 'none',
      relatedList: (item.relatedList || []).map((rel) => ({
        id: rel.id,
        name: rel.name,
        price: rel.price,
        qty: rel.qty
      })),
      resalePrice: item.resalePrice,
      status: item.status,
      pinned: !!item.pinned,
      excludeAsset: !!item.excludeAsset,
      excludeDaily: !!item.excludeDaily
    }));
    wx.setStorageSync(STORAGE_KEY, raw);
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
    wx.hideTabBar({
      animation: false
    });
    this.setData({
      editorVisible: true,
      editorMode: 'create',
      editingId: ''
    });
  },

  onCloseEditor() {
    wx.showTabBar({
      animation: false
    });
    this.setData({ editorVisible: false });
  },

  onEditorTabChange(event) {
    const nextTab = event.currentTarget.dataset.id;
    const updates = { editorTab: nextTab };
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

    const categoryIndex = Math.max(0, this.data.categoryOptions.indexOf(found.category || '全部'));
    const statusSwitches = {
      retired: found.status === 'retired',
      sold: found.status === 'sold'
    };

    wx.hideTabBar({
      animation: false
    });

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
        price: `${found.price || 0}`,
        date: found.date || '',
        resalePrice: `${found.resalePrice || 0}`,
        note: found.note || '',
        relatedItems: ''
      },
      formIconType: found.iconType || 'emoji',
      formIconEmoji: found.iconEmoji || this.getDefaultIconByType(found.type || 'asset'),
      formIconImagePath: found.iconImagePath || '',
      noteImagePath: found.noteImagePath || '',
      activeCostMode: found.costMode || 'none',
      relatedList: this.normalizeRelatedItems(found.relatedList || []),
      relatedDraft: {
        name: '',
        price: '',
        qty: '1'
      },
      toggles: {
        pinned: !!found.pinned,
        excludeAsset: !!found.excludeAsset,
        excludeDaily: !!found.excludeDaily
      }
    }, () => {
      this.updateRelatedTotal(this.data.relatedList);
    });
  },

  onCostModeChange(event) {
    this.setData({ activeCostMode: event.currentTarget.dataset.id });
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
    this.setData({ noteImagePath: '' });
  },

  onCategoryChange(event) {
    this.setData({ categoryIndex: Number(event.detail.value) || 0 });
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

    const fallbackPath = '/images/icons/goods.png';
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

  onRelatedInput(event) {
    const { field } = event.currentTarget.dataset;
    this.setData({ [`relatedDraft.${field}`]: event.detail.value });
  },

  onAddRelatedItem() {
    const { name, price, qty } = this.data.relatedDraft;
    const trimmedName = `${name || ''}`.trim();
    const unitPrice = this.parseNumber(price);
    const quantity = Math.max(1, Math.floor(this.parseNumber(qty) || 1));

    if (!trimmedName) {
      wx.showToast({ title: '请输入附加物品名称', icon: 'none' });
      return;
    }

    const newItem = {
      id: `rel_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      name: trimmedName,
      price: unitPrice,
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
      }
    });
    this.updateRelatedTotal(next);
  },

  onRemoveRelatedItem(event) {
    const { id } = event.currentTarget.dataset;
    const next = this.data.relatedList.filter((item) => item.id !== id);
    this.setData({ relatedList: next });
    this.updateRelatedTotal(next);
  },

  onFormDateChange(event) {
    this.setData({ 'formModel.date': event.detail.value });
  },

  resetEditorForm() {
    this.setData({
      editorTab: 'asset',
      activeCostMode: 'none',
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
      formIconType: 'emoji',
      formIconEmoji: this.getDefaultIconByType('asset'),
      formIconImagePath: '',
      noteImagePath: '',
      relatedDraft: {
        name: '',
        price: '',
        qty: '1'
      },
      relatedList: [],
      relatedTotalText: '¥0.00',
      toggles: {
        pinned: false,
        excludeAsset: false,
        excludeDaily: false
      }
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
      price: this.parseNumber(price),
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
        qty: item.qty
      })),
      resalePrice: this.parseNumber(resalePrice),
      status: formStatus,
      pinned: toggles.pinned,
      excludeAsset: toggles.excludeAsset,
      excludeDaily: toggles.excludeDaily
    };

    const next = editorMode === 'edit'
      ? assets.map((item) => (item.id === editingId ? { ...item, ...payload } : item))
      : [payload, ...assets];

    this.persistAssets(next);
    this.loadAssets();
    wx.showTabBar({
      animation: false
    });
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
    const left = this.data.assets.filter((item) => item.id !== id);
    this.persistAssets(left);
    this.loadAssets();
    wx.showToast({ title: '已删除', icon: 'none' });
  }
});
