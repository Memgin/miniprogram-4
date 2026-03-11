# 多币种资产小程序

这个项目当前包含以下核心能力：

- 多银行卡、多币种资产管理
- 首页实时汇率、目标进度和压力测试中心
- 单卡资产占比图、历史趋势图和组合预测曲线
- AI 汇率监测、组合风险雷达、AI 组合建议
- 汇率提醒规则和云端定时检查

## 新增云函数

需要在微信开发者工具中重新上传并部署以下云函数：

- `getUserProfile`
- `syncUserProfile`
- `tushareImport`
- `riskAnalyzer`
- `aiPortfolioAdvisor`
- `alertMonitor`
- `aiFxMonitor` 或 `aiOnnxInference`

## 云函数说明

### `tushareImport`

- 用途：从 Tushare 导入历史汇率到 `rates_history`
- 新增能力：按 `symbol + date` 去重更新，支持定时触发
- 依赖：`axios`、`wx-server-sdk`

### `riskAnalyzer`

- 用途：根据持仓和历史汇率计算 VaR、波动率和币种敞口
- 数据源：优先读取 `rates_history`，不足时回退到外部汇率接口

### `aiPortfolioAdvisor`

- 用途：结合持仓、风险结果和压力测试，生成结构化文字建议
- 说明：当前实现为规则化建议，不依赖外部大模型密钥

### `alertMonitor`

- 用途：检查用户配置的汇率阈值提醒
- 运行方式：支持前端手动检查，也支持云端定时任务巡检
- 若要真正发送订阅消息，需要配置环境变量：`ALERT_TEMPLATE_ID`、`ALERT_PAGE_PATH`

## 前端新增能力

### 首页

- 金额隐私开关
- 生物认证开关
- 风险雷达卡片
- 汇率提醒卡片
- AI 组合建议卡片

### 账户详情页

- 金额隐私开关
- 生物认证开关
- 组合预测曲线
- 组合展望摘要

## 部署建议

1. 先部署 `getUserProfile` 和 `syncUserProfile`，确保新增字段可正常读写。
2. 再部署 `tushareImport`，并验证 `rates_history` 集合开始有去重后的历史数据。
3. 部署 `riskAnalyzer`、`aiPortfolioAdvisor`、`alertMonitor`。
4. 若需要 AI 预测曲线，确保 `aiFxMonitor` 或 `aiOnnxInference` 至少有一个可用。
5. 真机验证生物认证能力，模拟器通常不能完整覆盖。

## 参考文档

- [云开发文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)
- [订阅消息文档](https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/mp-message-management/subscribe-message/sendMessage.html)

