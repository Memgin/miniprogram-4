const cloud = require('wx-server-sdk');
const https = require('https');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const SUPPORTED_CODES = ['USD', 'HKD', 'EUR', 'JPY', 'GBP', 'CAD', 'AUD', 'NZD', 'CHF', 'SGD', 'THB', 'MYR', 'KRW'];

function fetchJson(url, timeout = 1800) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout }, (res) => {
      let buffer = '';
      res.on('data', (chunk) => {
        buffer += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(buffer || '{}'));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Request timeout')));
  });
}

function normalizeRates(sourceRates, updateTime, provider) {
  const rates = {
    CNY: 1,
    cny: 1,
    provider,
    updateTime: updateTime || new Date().toISOString()
  };

  SUPPORTED_CODES.forEach((code) => {
    const value = Number(sourceRates && sourceRates[code]);
    if (!Number.isFinite(value) || value <= 0) {
      return;
    }
    const fixed = Number((1 / value).toFixed(4));
    rates[code] = fixed;
    rates[code.toLowerCase()] = fixed;
    if (code === 'MYR') {
      rates.RM = fixed;
      rates.rm = fixed;
    }
  });

  const available = SUPPORTED_CODES.filter((code) => Number.isFinite(Number(rates[code])) && Number(rates[code]) > 0);
  if (!available.length) {
    throw new Error('No supported real-time FX quotes available');
  }

  return rates;
}

async function fetchFromErApi() {
  const json = await fetchJson('https://open.er-api.com/v6/latest/CNY');
  if (!json || json.result !== 'success' || !json.rates) {
    throw new Error('ER API returned invalid payload');
  }
  return normalizeRates(json.rates, json.time_last_update_utc || json.time_last_update_unix || '', 'open.er-api.com');
}

async function fetchFromFrankfurter() {
  const json = await fetchJson('https://api.frankfurter.app/latest?from=CNY');
  if (!json || !json.rates) {
    throw new Error('Frankfurter returned invalid payload');
  }
  return normalizeRates(json.rates, json.date || '', 'api.frankfurter.app');
}

exports.main = async () => {
  const providers = [fetchFromErApi, fetchFromFrankfurter];
  let lastError = null;

  for (const provider of providers) {
    try {
      return {
        success: true,
        rates: await provider()
      };
    } catch (error) {
      lastError = error;
    }
  }

  return {
    success: false,
    msg: lastError && lastError.message ? lastError.message : 'Unable to fetch live FX rates'
  };
};