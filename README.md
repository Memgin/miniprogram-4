# 悉数：个人资产全生命周期管理小程序

本项目基于微信小程序云开发，面向个人用户提供金融资产与生活资产的一体化管理能力。

## 核心能力

### 资产主线
- 多银行卡与多币种统一管理
- 实时汇率换算与人民币总览
- 目标体系与进度追踪
- 风险雷达与压力测试
- 汇率提醒规则与历史记录
- 账户详情可视化分析与导出

### 悉数主线
- 资产与心愿双列表管理
- 成本追踪与使用效率分析
- OCR 识别录入与残值估算
- 云端图标库与最近使用
- 本地与云端双向同步

## 技术栈
- 前端：微信小程序原生 WXML / WXSS / JS
- 后端：微信云函数 Node.js
- 数据：云数据库 user_configs 与 rates_history
- 图表：ECharts

## 项目结构
- `miniprogram/` 小程序前端代码
- `cloudfunctions/` 云函数代码
- `ai/` 模型训练与推理脚本

## 云函数清单
- `getUserProfile`
- `syncUserProfile`
- `getRealtimeFx`
- `riskAnalyzer`
- `aiPortfolioAdvisor`
- `alertMonitor`
- `aiFxMonitor`
- `tushareImport`
- `getXishuAssets`
- `syncXishuAssets`
- `aiParseAsset`
- `aiEstimateResale`
- `getIconLibrary`

## 本地运行与部署
1. 使用微信开发者工具打开项目根目录。
2. 确认 `project.config.json` 中小程序目录和云函数目录配置正确。
3. 在云开发中创建并绑定环境。
4. 逐个上传部署 `cloudfunctions/` 下的云函数。
5. 真机运行，先新增银行卡再验证风险分析、提醒与导出流程。

## 说明
- 项目包含安卓端兼容处理与弱网兜底逻辑。
- 建议使用真机完成最终验收与录屏。

