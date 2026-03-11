"""
Export PyTorch LSTM model to ONNX for Node.js inference.
Usage:
  python ai/export_onnx.py --model ai/model.pth --meta ai/model.pth.meta.json --out ai/model.onnx

Notes: ensure model architecture in this script matches the one used in `train_model.py`.
"""
import argparse
import torch
import json
from train_model import LSTMModel
import numpy as np


def export_onnx(model_path, meta_path, out_path):
    with open(meta_path, 'r', encoding='utf-8') as f:
        meta = json.load(f)
    seq_len = meta['seq_len']

    model = LSTMModel(input_size=1, hidden_size=64, num_layers=1)
    state = torch.load(model_path, map_location='cpu')
    model.load_state_dict(state)
    model.eval()

    dummy = torch.randn(1, seq_len, 1)
    torch.onnx.export(model, dummy, out_path, opset_version=11, input_names=['input'], output_names=['output'], dynamic_axes={'input':{0:1,1:1}, 'output':{0:1}})
    print('Exported ONNX to', out_path)


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--model', required=True)
    p.add_argument('--meta', required=True)
    p.add_argument('--out', required=True)
    args = p.parse_args()
    export_onnx(args.model, args.meta, args.out)
