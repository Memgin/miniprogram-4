部署 aiOnnxInference (Python ONNX 推理)

1) 确保 `cloudfunctions/aiOnnxInference/model.onnx` 已存在（可用 `ai/export_onnx.py` 导出并复制到此目录）。

2) 安装依赖并上传：

在你本地（有 Python 的机器）或 CI：
```bash
# 安装 deps 到本地目录（可选）
pip install -r cloudfunctions/aiOnnxInference/requirements.txt -t cloudfunctions/aiOnnxInference/

# 打包为 zip（Windows PowerShell 示例）
Compress-Archive -Path cloudfunctions/aiOnnxInference\* -DestinationPath aiOnnxInference.zip -Force
```

3) 在微信开发者工具上传云函数：选择 `cloudfunctions/aiOnnxInference` 或上传 `aiOnnxInference.zip`。

4) 测试示例：
```json
{ "symbol": "USD", "seq_len": 5 }
```

若返回 `{ "success": true, "method": "onnx_python", "pred": ... }` 则说明 Python ONNX 推理可用。
