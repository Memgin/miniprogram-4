部署 riskAnalyzer

1. 在微信开发者工具中打开 cloudfunctions/riskAnalyzer。
2. 先执行云函数依赖安装，确保 wx-server-sdk 已安装。
3. 上传并部署当前云函数。
4. 确认数据库中存在 rates_history 集合；若没有历史数据，函数会自动回退到外部汇率接口。

建议验证

1. 在云开发控制台手动调用：
   {
     "bankCards": [
       {
         "currencies": [
           { "code": "usd", "amount": "1000" },
           { "code": "eur", "amount": "500" }
         ]
       }
     ],
     "currentRates": { "USD": 7.18, "EUR": 7.82, "CNY": 1 }
   }
2. 预期返回 success=true，并包含 totalValue、var95、var99、topExposures。
