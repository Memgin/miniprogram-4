const cloud = require('wx-server-sdk');
const fetch = require('node-fetch');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

exports.main = async (event, context) => {
  const { asset, apiKey } = event;

  if (!apiKey) {
    return { success: false, error: '缺少 API Key', errorType: 'auth_error' };
  }

  // 构造发给大模型的 Prompt
  const prompt = `你是一个资深的二手市场评估专家。
当前商品为【${asset.name || '未知商品'}】，类别为【${asset.category || '未分类'}】。
用户 ${asset.holdDays || 0} 天前以 ${asset.price || 0} 元购入，当前状态良好。
请结合最新的电子产品/物品贬值曲线与目前的二手市场行情，预测其残值。

你必须严格返回合法的 JSON 格式，且只返回 JSON，不要任何其他文字或Markdown格式（不要输出 \`\`\`json ），包含以下字段：
{
  "estimatedPrice": 1500, // (数字类型) 具体的预测评估数值，单位元
  "depreciationRate": "25%", // (字符串) 年化折旧率或当前贬值折损比例估算
  "marketTrend": "该机型即将迎来下一代发布，建议在30天内出手残值最高。" // (字符串) 一句话行情分析和卖出建议
}`;

  try {
    const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        // model: 'deepseek-ai/DeepSeek-V3', // 可以替换为支持的任意强模型
        model: 'Qwen/Qwen2.5-7B-Instruct', 
        messages: [
          { role: 'system', content: 'You are a helpful assistant that only outputs valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2, // 低温保证格式稳定
        max_tokens: 500
      })
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return { success: false, error: 'API返回结果不可解析', raw: text };
    }

    if (!data || !data.choices || !data.choices[0]) {
      return { success: false, error: 'API可能欠费或异常', raw: text };
    }

    const content = data.choices[0].message.content;
    const cleanContent = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    try {
      const parsedContent = JSON.parse(cleanContent);
      return {
        success: true,
        data: {
          ...parsedContent,
          sourceText: 'SiliconFlow API',
          modelText: 'Qwen/Qwen2.5-7B-Instruct'
        }
      };
    } catch (e) {
      return { success: false, error: '大模型未按要求返回 JSON', raw: cleanContent };
    }

  } catch (error) {
    return { success: false, error: '云端网络请求失败', details: error.toString() };
  }
};