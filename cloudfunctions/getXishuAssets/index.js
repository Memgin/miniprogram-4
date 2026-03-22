const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async () => {
  const { OPENID } = cloud.getWXContext();
  try {
    const res = await db.collection('user_configs').doc(OPENID).get();
    const assets = Array.isArray(res.data && res.data.xishuAssets) ? res.data.xishuAssets : [];
    return { success: true, data: assets };
  } catch (err) {
    return { success: true, data: [] };
  }
};
