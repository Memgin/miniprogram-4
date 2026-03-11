"""
Simple LSTM baseline trainer for a single numeric series CSV.
Expect CSV with a date-like column and one numeric column (price).

Example:
  python train_model.py --csv data.csv --datecol trade_date --pricecol CNY --epochs 20 --out model.pth

This uses PyTorch and saves model and scaler params.
"""
import argparse
import pandas as pd
import numpy as np
import json
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader


class SeriesDataset(Dataset):
    def __init__(self, series, seq_len=20):
        self.seq_len = seq_len
        self.x = []
        self.y = []
        for i in range(len(series) - seq_len):
            self.x.append(series[i:i+seq_len])
            self.y.append(series[i+seq_len])
        self.x = np.array(self.x, dtype=np.float32)
        self.y = np.array(self.y, dtype=np.float32)

    def __len__(self):
        return len(self.x)

    def __getitem__(self, idx):
        return self.x[idx], self.y[idx]


class LSTMModel(nn.Module):
    def __init__(self, input_size=1, hidden_size=32, num_layers=1):
        super().__init__()
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True)
        self.fc = nn.Linear(hidden_size, 1)

    def forward(self, x):
        out, _ = self.lstm(x)
        out = out[:, -1, :]
        return self.fc(out)


def minmax_scale(arr):
    arr = np.array(arr)
    mn = arr.min()
    mx = arr.max()
    if mx - mn == 0:
        return arr - mn, mn, mx
    return (arr - mn) / (mx - mn), mn, mx


def inverse_scale(x, mn, mx):
    return x * (mx - mn) + mn


def train(csv_path, datecol, pricecol, seq_len, epochs, out_model):
    df = pd.read_csv(csv_path)
    df = df.sort_values(by=datecol)
    series = df[pricecol].astype(float).values
    scaled, mn, mx = minmax_scale(series)

    ds = SeriesDataset(scaled, seq_len=seq_len)
    dl = DataLoader(ds, batch_size=32, shuffle=True)

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model = LSTMModel(input_size=1, hidden_size=64, num_layers=1).to(device)
    opt = torch.optim.Adam(model.parameters(), lr=1e-3)
    loss_fn = nn.MSELoss()

    for epoch in range(1, epochs+1):
        model.train()
        total_loss = 0.0
        for xb, yb in dl:
            xb = xb.unsqueeze(-1).to(device)
            yb = yb.unsqueeze(-1).to(device)
            pred = model(xb)
            loss = loss_fn(pred, yb)
            opt.zero_grad()
            loss.backward()
            opt.step()
            total_loss += loss.item() * xb.size(0)
        avg = total_loss / len(ds)
        print(f'Epoch {epoch}/{epochs} loss={avg:.6f}')

    # save model and scaler
    torch.save(model.state_dict(), out_model)
    meta = { 'mn': float(mn), 'mx': float(mx), 'seq_len': seq_len, 'pricecol': pricecol }
    with open(out_model + '.meta.json', 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print('Saved', out_model)


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--csv', required=True)
    p.add_argument('--datecol', default='trade_date')
    p.add_argument('--pricecol', default='CNY')
    p.add_argument('--seq', type=int, default=20)
    p.add_argument('--epochs', type=int, default=10)
    p.add_argument('--out', default='model.pth')
    args = p.parse_args()
    train(args.csv, args.datecol, args.pricecol, args.seq, args.epochs, args.out)
