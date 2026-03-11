let rateCache = null;
let lastUpdateTime = 0;
let inflightPromise = null;
const CACHE_TIME = 15 * 1000;

module.exports = {
  async getSinaRealTimeRates() {
    const now = Date.now();
    if (rateCache && now - lastUpdateTime < CACHE_TIME) {
      return rateCache;
    }

    if (inflightPromise) {
      return inflightPromise;
    }

    inflightPromise = wx.cloud.callFunction({
      name: 'getRealtimeFx'
    }).then((res) => {
      const rates = res && res.result && res.result.success ? res.result.rates : null;
      if (!rates || Object.keys(rates).length <= 4) {
        throw new Error((res && res.result && res.result.msg) || '实时汇率云函数返回异常');
      }
      rateCache = rates;
      lastUpdateTime = Date.now();
      return rates;
    }).finally(() => {
      inflightPromise = null;
    });

    return inflightPromise;
  }
};