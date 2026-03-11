"""
Load trained PyTorch LSTM model and produce next-step prediction.
Usage:
  python inference.py --model model.pth --meta model.pth.meta.json --csv data.csv
"""
import argparse
import pandas as pd
import numpy as np
import torch
import json
from train_model import LSTMModel


def load_series(csv_path, datecol, pricecol):
    df = pd.read_csv(csv_path)
    df = df.sort_values(by=datecol)
    return df[pricecol].astype(float).values


def predict_next(model_path, meta_path, series):
    with open(meta_path, 'r', encoding='utf-8') as f:
        meta = json.load(f)
    mn = meta['mn']; mx = meta['mx']; seq_len = meta['seq_len']
    scaled = (series - mn) / (mx - mn) if mx - mn != 0 else series - mn
    last_seq = scaled[-seq_len:]
    x = torch.tensor(last_seq, dtype=torch.float32).unsqueeze(0).unsqueeze(-1)

    model = LSTMModel(input_size=1, hidden_size=64, num_layers=1)
    state = torch.load(model_path, map_location='cpu')
    model.load_state_dict(state)
    model.eval()
    with torch.no_grad():
        pred = model(x).squeeze().item()
    pred_unscaled = pred * (mx - mn) + mn if mx - mn != 0 else pred + mn
    return pred_unscaled


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--model', required=True)
    p.add_argument('--meta', required=True)
    p.add_argument('--csv', required=True)
    p.add_argument('--datecol', default='trade_date')
    p.add_argument('--pricecol', default='CNY')
    args = p.parse_args()

    series = load_series(args.csv, args.datecol, args.pricecol)
    pred = predict_next(args.model, args.meta, series)
    print('Next step prediction:', pred)


if __name__ == '__main__':
    main()
