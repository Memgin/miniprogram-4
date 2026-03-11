部署 aiFxMonitor (Node 版，可直接创建)

1) 在微信开发者工具右键 cloudfunctions/aiFxMonitor
2) 选择：上传并部署：云端安装依赖（不上传 node_modules）
3) 首次部署会自动创建函数 aiFxMonitor

测试入参：
{
  "symbol": "USD",
  "seq_len": 20
}

成功返回字段：
success, method, current, pred, expected_change_pct, volatility, risk_level, signal, sample_size

说明：
- 当前目录中的 index.js/package.json/config.json 是 Node 运行时创建函数所需最小集合。
- 旧的 Python 依赖文件不会参与 Node 运行。
