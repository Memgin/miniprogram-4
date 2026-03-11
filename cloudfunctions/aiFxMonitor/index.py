import json
import os
import traceback
import requests
from math import sqrt
try:
    import onnxruntime as ort
except Exception:
    ort = None


def fetch_current_price(symbol):
    """Get latest spot quote for BASE/CNY."""
    try:
        url = f'https://open.er-api.com/v6/latest/{symbol}'
        r = requests.get(url, timeout=5)
        j = r.json()
        return j.get('rates', {}).get('CNY')
    except Exception:
        return None


def fetch_recent_daily_rates(symbol, days=45):
    """Get recent daily close sequence for BASE/CNY from Frankfurter."""
    try:
        # Frankfurter returns latest if date omitted; use range for time-series.
        # 45 days gives enough points after weekends/holidays.
        from datetime import date, timedelta

        end_date = date.today()
        start_date = end_date - timedelta(days=max(days, 30))
        url = (
            f'https://api.frankfurter.app/{start_date.isoformat()}..{end_date.isoformat()}'
            f'?from={symbol}&to=CNY'
        )
        r = requests.get(url, timeout=8)
        j = r.json() if r is not None else {}
        rates_map = j.get('rates', {})
        if not isinstance(rates_map, dict):
            return []

        # Sort by date key to guarantee sequence order.
        items = sorted(rates_map.items(), key=lambda x: x[0])
        seq = []
        for _, day_rates in items:
            if isinstance(day_rates, dict) and 'CNY' in day_rates:
                try:
                    seq.append(float(day_rates['CNY']))
                except Exception:
                    pass
        return seq
    except Exception:
        return []


def calc_volatility(prices):
    """Annualized volatility from daily log-return approximation."""
    if not prices or len(prices) < 3:
        return 0.0

    rets = []
    for i in range(1, len(prices)):
        prev_p = prices[i - 1]
        cur_p = prices[i]
        if prev_p and prev_p > 0:
            rets.append((cur_p - prev_p) / prev_p)

    if len(rets) < 2:
        return 0.0

    mean_r = sum(rets) / len(rets)
    var_r = sum((r - mean_r) ** 2 for r in rets) / (len(rets) - 1)
    # 252 trading days annualization.
    return float(sqrt(max(var_r, 0.0)) * sqrt(252))


def ewma_predict(prices, alpha=0.35):
    """Simple fallback predictor when ONNX runtime/model unavailable."""
    if not prices:
        return 1.0
    level = float(prices[0])
    for p in prices[1:]:
        level = alpha * float(p) + (1 - alpha) * level
    return float(level)


def score_risk(volatility, expected_change_pct):
    """Map numeric metrics to readable risk level and trading signal."""
    if volatility < 0.06:
        risk_level = 'low'
    elif volatility < 0.12:
        risk_level = 'medium'
    else:
        risk_level = 'high'

    if expected_change_pct >= 0.4:
        signal = 'up_breakout'
    elif expected_change_pct <= -0.4:
        signal = 'down_breakout'
    elif abs(expected_change_pct) <= 0.1:
        signal = 'range'
    else:
        signal = 'trend'

    return risk_level, signal


def main(event, context):
    try:
        symbol = (event.get('symbol') or 'USD').upper()
        seq_len = int(event.get('seq_len', 20))
        seq = event.get('sequence')

        prices = []
        if isinstance(seq, list) and len(seq) > 0:
            prices = [float(x) for x in seq]
        else:
            # Prefer multi-day sequence for model inference.
            prices = fetch_recent_daily_rates(symbol, days=max(seq_len + 20, 45))

            # If external API unavailable, fall back to a single spot quote.
            if not prices:
                cur = fetch_current_price(symbol)
                if cur is not None:
                    prices = [float(cur)]

        # pad/trim to seq_len
        if not prices:
            prices = [1.0] * seq_len
        while len(prices) < seq_len:
            prices.append(prices[-1])
        prices = prices[-seq_len:]

        current_price = float(prices[-1]) if prices else 1.0
        volatility = calc_volatility(prices)

        model_path = os.path.join(os.path.dirname(__file__), 'model.onnx')
        method = 'ewma_fallback'

        if ort is not None and os.path.exists(model_path):
            sess = ort.InferenceSession(model_path)
            import numpy as np

            arr = np.array(prices, dtype=np.float32).reshape(1, seq_len, 1)
            input_name = sess.get_inputs()[0].name
            out = sess.run(None, {input_name: arr})
            pred = float(out[0].flatten()[0])
            method = 'onnx_python'
        else:
            pred = ewma_predict(prices)

        expected_change_pct = 0.0
        if current_price > 0:
            expected_change_pct = float((pred - current_price) / current_price * 100.0)

        risk_level, signal = score_risk(volatility, expected_change_pct)

        return {
            'success': True,
            'method': method,
            'symbol': symbol,
            'current': current_price,
            'pred': pred,
            'expected_change_pct': expected_change_pct,
            'volatility': volatility,
            'risk_level': risk_level,
            'signal': signal,
            'sample_size': len(prices)
        }
    except Exception as e:
        return { 'success': False, 'msg': str(e), 'trace': traceback.format_exc() }
