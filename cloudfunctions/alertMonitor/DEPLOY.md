部署 alertMonitor

1. 在微信开发者工具中打开 cloudfunctions/alertMonitor。
2. 安装依赖并上传部署。
3. 如需云端定时巡检，确认 config.json 已随云函数一起上传。
4. 如需真实发送订阅消息，请在云函数环境变量中配置：
   - ALERT_TEMPLATE_ID
   - ALERT_PAGE_PATH

建议验证

1. 手动模式调用：
   {
     "manual": true,
     "alertRules": [
       { "code": "USD", "direction": "above", "threshold": 7.1, "enabled": true }
     ],
     "currentRates": { "USD": 7.2 }
   }
2. 预期返回 success=true，且 triggers 数组包含命中的规则。
3. 如果需要验证订阅消息，再在数据库 user_configs 中准备 alertRules 和可用用户记录。
