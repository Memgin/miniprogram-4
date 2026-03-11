"""
Flexible Tushare data downloader to CSV.
Usage:
  python data_prep.py --api fx_daily --start 20220101 --end 20221231 --token YOUR_TOKEN --out data.csv

The script POSTs to https://api.waditu.com and will save returned rows to CSV.
It expects the response format: {"data": {"fields": [...], "items": [[...], ...]}}
"""
import argparse
import json
import csv
import requests
from datetime import datetime


def fetch_tushare(api_name, token, params=None, fields=''):
    url = 'https://api.waditu.com'
    payload = { 'api_name': api_name, 'token': token, 'params': params or {}, 'fields': fields }
    resp = requests.post(url, json=payload, timeout=30)
    resp.raise_for_status()
    return resp.json()


def save_csv(fields, items, out_path):
    with open(out_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(fields)
        writer.writerows(items)


def main():
    p = argparse.ArgumentParser(description='Download Tushare data to CSV')
    p.add_argument('--api', required=True, help='Tushare api_name, e.g. fx_daily')
    p.add_argument('--token', required=True, help='Tushare token (or set env TUSHARE_TOKEN)')
    p.add_argument('--start', help='start_date YYYYMMDD', default=None)
    p.add_argument('--end', help='end_date YYYYMMDD', default=None)
    p.add_argument('--out', help='output CSV path', default='tushare_data.csv')
    p.add_argument('--fields', help='fields string (optional)', default='')
    args = p.parse_args()

    params = {}
    if args.start: params['start_date'] = args.start
    if args.end: params['end_date'] = args.end

    print('Requesting', args.api, 'range', args.start, args.end)
    data = fetch_tushare(args.api, args.token, params=params, fields=args.fields)
    if not data or 'data' not in data:
        print('Unexpected response:', data)
        return

    d = data['data']
    fields = d.get('fields') or []
    items = d.get('items') or []
    if not items:
        print('No items returned. Raw response saved to out.json')
        with open(args.out + '.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return

    save_csv(fields, items, args.out)
    print('Saved', len(items), 'rows to', args.out)


if __name__ == '__main__':
    main()
