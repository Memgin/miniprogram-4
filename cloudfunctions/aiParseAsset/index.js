const cloud = require('wx-server-sdk');
const fetch = require('node-fetch');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

function normalizeDateText(dateText) {
  if (!dateText) return '';
  const normalized = String(dateText)
    .replace(/年|\./g, '-')
    .replace(/月/g, '-')
    .replace(/日/g, '')
    .replace(/\//g, '-')
    .trim();
  const m = normalized.match(/(20\d{2})-(\d{1,2})-(\d{1,2})/);
  if (!m) return '';
  const y = m[1];
  const mo = String(Number(m[2])).padStart(2, '0');
  const d = String(Number(m[3])).padStart(2, '0');
  return `${y}-${mo}-${d}`;
}

function stripMarkdownFence(text) {
  if (!text) return '';
  return String(text)
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
}

function looksLikeCompletionMeta(text) {
  const t = String(text || '');
  return /"object"\s*:\s*"chat\.completion"/.test(t) || /"choices"\s*:/.test(t) && /"usage"\s*:/.test(t);
}

function extractCompletionInnerContent(maybeWrapper) {
  let data = maybeWrapper;
  if (typeof data === 'string') {
    const parsed = safeJsonParse(data);
    if (parsed) data = parsed;
  }
  if (!data || typeof data !== 'object') return '';

  if (data.object === 'chat.completion' && Array.isArray(data.choices) && data.choices[0]) {
    const c = data.choices[0];
    const m = c.message || {};
    return m.content || m.text || c.text || '';
  }
  return '';
}

function extractByRegex(rawText) {
  const text = String(rawText || '');

  if (looksLikeCompletionMeta(text)) {
    return { name: '', price: '', date: '' };
  }

  const dateMatch =
    text.match(/(20\d{2}[年\-\/.]\d{1,2}[月\-\/.]\d{1,2}日?)/) ||
    text.match(/(20\d{2}-\d{2}-\d{2})/);
  const date = normalizeDateText(dateMatch ? dateMatch[1] : '');

  const priceLineMatch = text.match(/(实付款|实付|应付|支付金额|支付|金额|合计|总价|订单金额|到手价|到手)\s*[:：=]?\s*(?:¥|￥|RMB)?\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
  const fallbackPriceMatch =
    text.match(/(?:合计|实付款|支付金额|到手)\s*(?:¥|￥|RMB)?\s*([0-9]+(?:\.[0-9]{1,2})?)/i) ||
    text.match(/(?:¥|￥|RMB\s*)\s*([0-9]+(?:\.[0-9]{1,2})?)/i) ||
    null;
  const price = (priceLineMatch && priceLineMatch[2]) || (fallbackPriceMatch && fallbackPriceMatch[1]) || '';

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/[\|]/g, ' ').trim())
    .filter(Boolean);
  const preferredNameLine = lines.find((line) => /商品|品名|商品名称|名称[:：]/.test(line));
  let name = '';
  if (preferredNameLine) {
    const m = preferredNameLine.match(/(?:商品名称|商品|品名|名称)[:：\s]*(.+)$/);
    name = m ? m[1].trim() : preferredNameLine;
  }
  if (!name) {
    const quantityLineIndex = lines.findIndex((line) => /数量\s*[x×]/i.test(line) || /x\s*1/i.test(line));
    if (quantityLineIndex > 0) {
      name = (lines[quantityLineIndex - 1] || '').trim();
    }
  }

  if (!name) {
    const candidate = lines
      .filter((line) => line.length >= 4)
      .filter((line) => !/(订单|金额|日期|时间|店铺|收货|地址|电话|支付|实付|合计|总价)/.test(line))
      .filter((line) => !/^[0-9\-:\s.¥￥]+$/.test(line))
      .sort((a, b) => b.length - a.length)[0];
    name = candidate || '';
  }

  return {
    name: name.slice(0, 80),
    price,
    date
  };
}

function normalizeModelResult(rawContent) {
  let text = '';
  if (typeof rawContent === 'string') {
    text = rawContent;
  } else if (Array.isArray(rawContent)) {
    text = rawContent
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item.text === 'string') return item.text;
        if (item && item.type === 'text' && typeof item.content === 'string') return item.content;
        return '';
      })
      .filter(Boolean)
      .join('\n');
  } else if (rawContent && typeof rawContent === 'object') {
    if (typeof rawContent.text === 'string') {
      text = rawContent.text;
    } else if (typeof rawContent.content === 'string') {
      text = rawContent.content;
    } else if (Array.isArray(rawContent.content)) {
      text = rawContent.content
        .map((item) => {
          if (typeof item === 'string') return item;
          if (item && typeof item.text === 'string') return item.text;
          return '';
        })
        .filter(Boolean)
        .join('\n');
    } else {
      text = JSON.stringify(rawContent);
    }
  } else {
    return { name: '', price: '', date: '' };
  }

  text = stripMarkdownFence(text);

  const innerContent = extractCompletionInnerContent(text);
  if (innerContent) {
    text = stripMarkdownFence(innerContent);
  }

  let parsed = safeJsonParse(text);
  if (!parsed) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) parsed = safeJsonParse(match[0]);
  }

  if (parsed && typeof parsed === 'object') {
    const nestedContent = extractCompletionInnerContent(parsed);
    if (nestedContent) {
      return normalizeModelResult(nestedContent);
    }

    const result = {
      name: String(parsed.name || parsed.product || parsed.productName || parsed.item_name || '').trim(),
      price: String(parsed.price || parsed.amount || parsed.total || parsed.paid || '').trim(),
      date: normalizeDateText(parsed.date || parsed.time || parsed.order_date || '')
    };
    if (result.name || result.price || result.date) {
      return {
        ...result,
        raw: text
      };
    }
  }

  const fallback = extractByRegex(text);
  const priceSafe = fallback.price && Number(fallback.price) > 0 ? fallback.price : '';
  return {
    name: fallback.name || '',
    price: priceSafe || '',
    date: fallback.date || '',
    raw: text
  };
}

async function requestVision(apiUrl, apiKey, payload) {
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    data = { raw: text };
  }
  return { response, data };
}

async function uploadToCloudAndGetTempUrl(imageBase64) {
  const fileContent = Buffer.from(imageBase64, 'base64');
  const cloudPath = `ai-ocr/${Date.now()}_${Math.random().toString(16).slice(2, 8)}.jpg`;
  const uploadRes = await cloud.uploadFile({ cloudPath, fileContent });
  const tempRes = await cloud.getTempFileURL({ fileList: [uploadRes.fileID] });
  const url = tempRes.fileList && tempRes.fileList[0] && tempRes.fileList[0].tempFileURL;
  return url || '';
}

exports.main = async (event) => {
  const { imageBase64, apiKey } = event;

  if (!imageBase64) {
    return { success: false, error: '缺少图像数据' };
  }

  try {
    const API_KEY = process.env.SILICONFLOW_API_KEY || apiKey || '';
    const API_URL = process.env.SILICONFLOW_API_URL || 'https://api.siliconflow.cn/v1/chat/completions';
    const modelCandidates = (process.env.SILICONFLOW_VISION_MODEL || 'deepseek-ai/DeepSeek-OCR,Qwen/Qwen2-VL-7B-Instruct,Qwen/Qwen2.5-VL-7B-Instruct,Qwen/Qwen2.5-VL-72B-Instruct')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (!API_KEY) {
      return { success: false, error: '缺少 API Key，请在云函数环境变量配置 SILICONFLOW_API_KEY' };
    }

    if (imageBase64.length > 6 * 1024 * 1024) {
      return { success: false, error: '图片过大，请压缩后重试' };
    }

    const promptText = '你是订单OCR信息抽取助手。请优先返回 JSON：{"name":"商品名称","price":"数字价格","date":"YYYY-MM-DD"}。若无法保证 JSON，也请返回清晰文本，至少包含商品名、金额、日期。';
    const imageDataUrl = `data:image/jpeg;base64,${imageBase64}`;

    let cloudImageUrl = '';
    try {
      cloudImageUrl = await uploadToCloudAndGetTempUrl(imageBase64);
    } catch (uploadErr) {
      cloudImageUrl = '';
    }

    const imagePayloadVariants = [];
    if (cloudImageUrl) {
      imagePayloadVariants.push({ type: 'image_url', image_url: { url: cloudImageUrl } });
      imagePayloadVariants.push({ type: 'image_url', image_url: cloudImageUrl });
    }
    imagePayloadVariants.push({ type: 'image_url', image_url: { url: imageDataUrl } });
    imagePayloadVariants.push({ type: 'image_url', image_url: imageDataUrl });

    let lastCallResult = null;
    let successResult = null;

    for (const model of modelCandidates) {
      for (const imageBlock of imagePayloadVariants) {
        const payload = {
          model,
          temperature: 0,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: promptText },
                imageBlock
              ]
            }
          ]
        };

        const callResult = await requestVision(API_URL, API_KEY, payload);
        lastCallResult = { ...callResult, model, imageBlockType: typeof imageBlock.image_url };

        if (callResult.response.ok && callResult.data && callResult.data.choices && callResult.data.choices.length > 0) {
          successResult = callResult;
          break;
        }
      }
      if (successResult) break;
    }

    if (!successResult) {
      const status = lastCallResult && lastCallResult.response ? lastCallResult.response.status : 'unknown';
      const val = lastCallResult ? lastCallResult.data : null;
      const providerMessage = val && val.error && (val.error.message || val.error.code || val.error.type);
      return {
        success: false,
        error: `上游模型接口错误: HTTP ${status}${providerMessage ? ` - ${providerMessage}` : ''}`,
        originalResponse: val
      };
    }

    const val = successResult.data;
    const choice = val.choices[0] || {};
    const message = choice.message || {};
    const content =
      message.content ||
      message.text ||
      choice.text ||
      val.output_text ||
      val.result ||
      '';
    const parsedData = normalizeModelResult(content);

    if (!parsedData.name && !parsedData.price && !parsedData.date) {
      const backupParsed = extractByRegex(JSON.stringify(val));
      return {
        success: true,
        data: {
          ...backupParsed,
          raw: JSON.stringify(val).slice(0, 800)
        }
      };
    }

    return {
      success: true,
      data: parsedData
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || '大模型请求失败'
    };
  }
};
