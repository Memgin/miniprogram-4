let rateCache = null;
let lastUpdateTime = 0;
const CACHE_TIME = 30 * 60 * 1000;

module.exports = {
  async getSinaRealTimeRates() {
    const now = Date.now();
    if (rateCache && now - lastUpdateTime < CACHE_TIME) {
      return rateCache;
    }

    return new Promise((resolve, reject) => {
      wx.request({
        url: 'https://api.exchangerate-api.com/v4/latest/USD',
        method: 'GET',
        success: (res) => {
          if (res.statusCode === 200 && res.data && res.data.rates) {
            const base = res.data.rates;
            const usdToCny = base.CNY || 7.2; 

            // 币种白名单
            const whitelist = ['USD', 'HKD', 'EUR', 'JPY', 'GBP', 'CAD', 'AUD', 'NZD', 'CHF', 'SGD', 'THB', 'MYR', 'KRW'];
            
            const rates = {
              CNY: 1.0,
              updateTime: new Date().toLocaleString()
            };

            // 动态计算：CNY / (USD_to_Target) = Target_to_CNY
            whitelist.forEach(code => {
              const targetToUsd = base[code];
              if (targetToUsd) {
                const val = parseFloat((usdToCny / targetToUsd).toFixed(4));
                rates[code] = val;
                rates[code.toLowerCase()] = val;
                if (code === 'MYR') { rates['RM'] = val; rates['rm'] = val; }
              }
            });

            console.log('✅ 汇率链路已打通:', rates);
            rateCache = rates;
            lastUpdateTime = now;
            resolve(rates);
          } else {
            reject(new Error('接口异常'));
          }
        },
        fail: (err) => reject(err)
      });
    });
  }
};