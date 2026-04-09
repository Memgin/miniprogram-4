const axios = require('axios');
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function resolveDateRange(start, end) {
  if (start && end) {
    return {
      start: String(start),
      end: String(end)
    };
  }

  const today = new Date();
  const startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  return {
    start: String(start || formatDate(startDate)),
    end: String(end || formatDate(today))
  };
}

function pickFieldIndex(fields, candidates) {
  for (const candidate of candidates) {
    const idx = fields.indexOf(candidate);
    if (idx >= 0) return idx;
  }
  return -1;
}

function normalizeSymbol(apiName, fields, row) {
  const currencyIdx = pickFieldIndex(fields, ['currency', 'base_currency', 'ts_code']);
  if (currencyIdx >= 0 && row[currencyIdx]) {
    return String(row[currencyIdx]).toUpperCase().replace(/\/CNY$/, '');
  }

  if (String(apiName).includes('fx')) {
    return 'USD';
  }
  return 'UNKNOWN';
}

/**
 * tushareImport
 * event: { api_name: 'fx_daily', start_date: '20220101', end_date: '20231231', token: '...' }
 * Fetches data from Tushare (waditu) and inserts rows into `rates_history` collection.
 */
exports.main = async (event) => {
  const api_name = event.api_name || 'fx_daily';
  const { start, end } = resolveDateRange(event.start_date, event.end_date);
  const token = event.token || process.env.TUSHARE_TOKEN || '';

  if (!token) return { success: false, msg: 'Tushare token required' };

  const url = 'https://api.waditu.com';
  try {
    const resp = await axios.post(url, { api_name, token, params: { start_date: start, end_date: end }, fields: '' }, { timeout: 30000 });
    const data = resp.data?.data;
    const fields = data?.fields || [];
    const items = data?.items || [];
    if (!items.length) return { success: false, msg: 'no items returned', raw: resp.data };

    const priceIdx = pickFieldIndex(fields, ['CNY', 'close', 'bid_close', 'mid_close']);
    const dateIdx = pickFieldIndex(fields, ['trade_date', 'date']);

    const ops = items.map(it => {
      const date = dateIdx >= 0 ? it[dateIdx] : null;
      const price = priceIdx >= 0 ? it[priceIdx] : null;
      const symbol = normalizeSymbol(api_name, fields, it);
      return {
        symbol,
        price,
        date,
        raw: fields.reduce((acc, field, index) => {
          acc[field] = it[index];
          return acc;
        }, {})
      };
    }).filter(o => o.date && o.price != null);

    let inserted = 0;
    let updated = 0;

    for (let rec of ops) {
      try {
        const existing = await db.collection('rates_history')
          .where({ symbol: rec.symbol, date: rec.date })
          .limit(1)
          .get();

        const payload = {
          symbol: rec.symbol,
          price: Number(rec.price),
          date: rec.date,
          api_name,
          source: 'tushare',
          updatedAt: db.serverDate(),
          fields,
          raw: rec.raw
        };

        if (existing.data && existing.data.length > 0) {
          await db.collection('rates_history').doc(existing.data[0]._id).update({
            data: payload
          });
          updated += 1;
        } else {
          await db.collection('rates_history').add({ data: payload });
          inserted += 1;
        }
      } catch (e) { /* continue on error */ }
    }

    return {
      success: true,
      inserted,
      updated,
      total: ops.length,
      start_date: start,
      end_date: end
    };
  } catch (err) {
    return { success: false, msg: err.message, stack: err.stack };
  }
};
