// app.js
App({
    globalData: {
      bankCards: [],           // 银行卡列表
      depositTarget: '',       // 存款目标
      selectedRateCodes: [],   // 用户选中的汇率代码
      exchangeRates: { cny: 1 }, // 实时汇率表
      _syncTimer: null         // 全局同步防抖定时器
    },
  
    onLaunch() {
      // 1. 初始化云开发环境 (环境ID确保正确)
      if (wx.cloud) {
        wx.cloud.init({ 
          env: 'cloud1-5ggg03ctd1511d28', 
          traceUser: true 
        });
      }
  
      // 2. 立即读取本地缓存，保证首页秒开不白屏
      this.loadLocalCache();
  
      // 3. 异步拉取云端“全量快照”，对齐数据
      this.initData();
    },
  
    /**
     * 加载本地缓存 (启动时立即调用)
     */
    loadLocalCache() {
      try {
        this.globalData.bankCards = wx.getStorageSync('bankCards') || [];
        this.globalData.depositTarget = wx.getStorageSync('depositTarget') || '';
        this.globalData.selectedRateCodes = wx.getStorageSync('selectedRateCodes') || ['usd', 'hkd'];
        console.log('📦 本地缓存加载完成');
      } catch (e) {
        console.error('读取缓存失败', e);
      }
    },
  
    /**
     * 从云端拉取唯一的全量配置包
     */
    async initData() {
      console.log('🔄 正在对齐云端数据...');
      try {
        // 只调用这一个核心“读”函数
        const res = await wx.cloud.callFunction({ name: 'getUserProfile' });
        
        if (res.result?.success) {
          const cloudData = res.result.data;
          
          // 更新全局变量
          this.globalData.bankCards = cloudData.bankCards || [];
          this.globalData.depositTarget = cloudData.depositTarget || '';
          this.globalData.selectedRateCodes = cloudData.selectedRateCodes || ['usd', 'hkd'];
  
          // 刷新本地缓存，保持一致
          wx.setStorageSync('bankCards', this.globalData.bankCards);
          wx.setStorageSync('depositTarget', this.globalData.depositTarget);
          wx.setStorageSync('selectedRateCodes', this.globalData.selectedRateCodes);
          
          console.log('✅ 云端数据对齐完成');
  
          // 如果首页已经打开，通知首页刷新界面 (可选)
          if (this.dataReadyCallback) {
            this.dataReadyCallback();
          }
        }
      } catch (e) {
        console.error('☁️ 云端拉取失败，将使用本地模式运行:', e);
      }
    },
  
    /**
     * 核心：全量数据同步中心（防抖）
     * 被所有修改数据的页面调用：app.sync()
     */
    sync() {
      // A. 立即保存到本地存储（核心：防止数据丢失的第一道防线）
      try {
        wx.setStorageSync('bankCards', this.globalData.bankCards);
        wx.setStorageSync('depositTarget', this.globalData.depositTarget);
        wx.setStorageSync('selectedRateCodes', this.globalData.selectedRateCodes);
      } catch (e) {
        console.error('本地持久化失败', e);
      }
  
      // B. 防抖上传：1.5秒内多次变动只传一次
      if (this.globalData._syncTimer) clearTimeout(this.globalData._syncTimer);
      
      this.globalData._syncTimer = setTimeout(async () => {
        console.log('☁️ 正在同步全量数据到云端...');
        try {
          const res = await wx.cloud.callFunction({
            name: 'syncUserProfile', // 只调用这一个核心“写”函数
            data: {
              bankCards: this.globalData.bankCards,
              depositTarget: this.globalData.depositTarget,
              selectedRateCodes: this.globalData.selectedRateCodes
            }
          });
          
          if (res.result?.success) {
            console.log('✨ 云端快照同步一致');
          }
        } catch (err) {
          console.error('❌ 云端同步失败:', err);
        }
      }, 1500);
    },
  
    /**
     * 检查重名卡片
     */
    checkDuplicateCard(name, excludeId = '') {
      return this.globalData.bankCards.find(c => c.name === name && c.id !== excludeId);
    }
  })