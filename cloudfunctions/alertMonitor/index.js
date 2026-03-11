const cloud = require('wx-server-sdk');
const https = require('https');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function fetchJson(url, timeout = 1500) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout }, (res) => {
      let buf = '';
      res.on('data', (chunk) => {
        buf += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(buf || '{}'));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Request timeout')));
  });
}

async function fetchRate(code) {
  const safeCode = String(code || '').toUpperCase();
  if (safeCode === 'CNY') return 1;
  const json = await fetchJson(`https://open.er-api.com/v6/latest/${safeCode}`);
  const cny = Number(json && json.rates && json.rates.CNY);
  return Number.isFinite(cny) && cny > 0 ? cny : 0;
}

async function buildRateMap(codes, currentRates) {
  const map = {};
  for (const code of codes) {
    const upper = String(code || '').toUpperCase();
    const existing = Number((currentRates && (currentRates[upper] || currentRates[upper.toLowerCase()])) || 0);
    map[upper] = existing > 0 ? existing : await fetchRate(upper).catch(() => 0);
  }
  return map;
}

function evaluateRules(alertRules, rateMap) {
  const rules = Array.isArray(alertRules) ? alertRules : [];
  return rules
    .filter((rule) => rule && rule.enabled !== false)
    .map((rule) => {
      const code = String(rule.code || '').toUpperCase();
      const current = Number(rateMap[code] || 0);
      const threshold = Number(rule.threshold || 0);
      const direction = String(rule.direction || 'above');
      const triggered = direction === 'below' ? current > 0 && current <= threshold : current >= threshold;
      return {
        id: String(rule.id || `${code}_${direction}_${threshold}`),
        code,
        current: Number(current.toFixed(4)),
        threshold: Number(threshold.toFixed(4)),
        direction,
        note: String(rule.note || ''),
        triggered
      };
    })
    .filter((item) => item.triggered);
}

function formatTimestamp() {
  return new Date().toLocaleString('zh-CN', { hour12: false });
}

function buildAlertHistoryEntry(triggers, source) {
  const checkedAt = formatTimestamp();
  const normalizedTriggers = (Array.isArray(triggers) ? triggers : []).map((item) => ({
    id: String(item.id || ''),
    code: String(item.code || '').toUpperCase(),
    current: Number(item.current || 0),
    threshold: Number(item.threshold || 0),
    direction: String(item.direction || 'above'),
    note: String(item.note || '')
  }));

  return {
    id: `alert_history_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    checkedAt,
    source: source || 'manual',
    matchedCount: normalizedTriggers.length,
    summary: normalizedTriggers.length
      ? normalizedTriggers.map((item) => `${item.code} ${item.direction === 'below' ? '低于' : '高于'} ${item.threshold}`).join(' | ')
      : '本次检查未命中任何提醒',
    triggers: normalizedTriggers.slice(0, 5)
  };
}

exports.main = async (event) => {
  try {
    if (event && event.manual) {
      const alertRules = Array.isArray(event.alertRules) ? event.alertRules : [];
      const codeList = [...new Set(alertRules.map((rule) => String(rule.code || '').toUpperCase()).filter(Boolean))];
      const rateMap = await buildRateMap(codeList, event.currentRates || {});
      const triggers = evaluateRules(alertRules, rateMap);
      return {
        success: true,
        manual: true,
        checkedAt: formatTimestamp(),
        triggers,
        historyEntry: buildAlertHistoryEntry(triggers, 'manual')
      };
    }

    const configs = await db.collection('user_configs').limit(100).get();
    const users = Array.isArray(configs.data) ? configs.data : [];
    const results = [];
    const templateId = process.env.ALERT_TEMPLATE_ID || '';
    const page = process.env.ALERT_PAGE_PATH || 'pages/index/index';

    for (const user of users) {
      const alertRules = Array.isArray(user.alertRules) ? user.alertRules : [];
      if (!alertRules.length) continue;
      const codeList = [...new Set(alertRules.map((rule) => String(rule.code || '').toUpperCase()).filter(Boolean))];
      const rateMap = await buildRateMap(codeList, {});
      const triggers = evaluateRules(alertRules, rateMap);
      const historyEntry = buildAlertHistoryEntry(triggers, 'scheduled');
      const existingHistory = Array.isArray(user.alertHistory) ? user.alertHistory : [];
      const nextHistory = [historyEntry, ...existingHistory].slice(0, 20);
      await db.collection('user_configs').doc(user._id).update({
        data: {
          alertHistory: nextHistory,
          lastAlertCheckAt: historyEntry.checkedAt
        }
      }).catch(() => null);

      if (!triggers.length) continue;

      let sent = false;
      if (templateId && cloud.openapi && cloud.openapi.subscribeMessage) {
        try {
          await cloud.openapi.subscribeMessage.send({
            touser: user._id,
            templateId,
            page,
            data: {
              thing1: { value: `${triggers[0].code} 汇率提醒` },
              amount2: { value: String(triggers[0].current) },
              phrase3: { value: triggers[0].direction === 'below' ? '低于阈值' : '高于阈值' }
            }
          });
          sent = true;
        } catch (error) {
          sent = false;
        }
      }

      results.push({
        openid: user._id,
        triggers,
        historyEntry,
        sent
      });
    }

    return {
      success: true,
      manual: false,
      checkedUsers: users.length,
      matchedUsers: results.length,
      results
    };
  } catch (error) {
    return {
      success: false,
      msg: error && error.message ? error.message : 'alertMonitor failed'
    };
  }
};
