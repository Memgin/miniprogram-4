// 本地存储封装
module.exports = {
  get(key, defaultValue = []) {
    try {
      const value = wx.getStorageSync(key);
      return value ? JSON.parse(value) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  },
  set(key, value) {
    try {
      wx.setStorageSync(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  },
  remove(key) {
    try {
      wx.removeStorageSync(key);
      return true;
    } catch (e) {
      return false;
    }
  }
};