AI 汇率分析 — 快速入门

- 目的：使用 Tushare 拉取历史外汇数据，训练简单 LSTM 模型以做短期预测或作为后续更复杂模型的基线。

- 准备：将你的 Tushare token 保存在环境变量 `TUSHARE_TOKEN`，或在命令行中通过 `--token` 传入。

1) 下载数据

示例：下载 2023 年的数据（api 名称与参数以 Tushare 文档为准）

```bash
python ai/data_prep.py --api fx_daily --token $TUSHARE_TOKEN --start 20230101 --end 20231231 --out ai/data.csv
```

脚本会把返回的 `fields` 作为 CSV 表头，`items` 写为行。

2) 训练模型（PyTorch）

```bash
pip install -r ai/requirements.txt
python ai/train_model.py --csv ai/data.csv --datecol trade_date --pricecol CNY --seq 20 --epochs 20 --out ai/model.pth
```

训练结束后，会生成 `ai/model.pth` 与 `ai/model.pth.meta.json`（包含缩放参数和序列长度）。

3) 推理

```bash
python ai/inference.py --model ai/model.pth --meta ai/model.pth.meta.json --csv ai/data.csv
```

注意与扩展建议：
- 本仓库的云端代码为 Node.js，因此若要在线部署 PyTorch 推理，建议部署一个小型 REST 服务（Flask/FastAPI）并将其作为云托管服务，或导出为 ONNX 供 Node 端推理。
- `ai/` 目录代码为最小可运行参考，建议根据实际 Tushare API 的字段调整 `--pricecol` 参数（例如 `CNY`、`close` 等）。
