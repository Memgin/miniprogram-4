部署 aiPortfolioAdvisor

1. 在微信开发者工具中打开 cloudfunctions/aiPortfolioAdvisor。
2. 安装依赖并上传部署。
3. 该函数不依赖外部大模型密钥，当前为规则化建议生成器，部署即可使用。

建议验证

1. 在云开发控制台手动调用：
   {
     "bankCards": [
       {
         "currencies": [
           { "code": "usd", "amount": "1000" },
           { "code": "jpy", "amount": "300000" }
         ]
       }
     ],
     "currentRates": { "USD": 7.18, "JPY": 0.048, "CNY": 1 },
     "riskSummary": { "var95": 1200, "totalValue": 20000 },
     "stressResult": { "scenarioName": "美元上行 +2%", "deltaTotal": -520, "pnlPct": -2.6 }
   }
2. 预期返回 success=true，并包含 headline、summary、insights、actions。
