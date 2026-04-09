const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function normalizeAssets(input) {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 1000).map((item) => ({
    id: String((item && item.id) || ''),
    type: String((item && item.type) || 'asset'),
    name: String((item && item.name) || ''),
    price: Number((item && item.price) || 0),
    date: String((item && item.date) || ''),
    note: String((item && item.note) || ''),
    noteImagePath: String((item && item.noteImagePath) || ''),
    iconType: String((item && item.iconType) || 'emoji'),
    iconEmoji: String((item && item.iconEmoji) || ''),
    iconImagePath: String((item && item.iconImagePath) || ''),
    category: String((item && item.category) || '全部'),
    costMode: String((item && item.costMode) || 'none'),
    relatedList: Array.isArray(item && item.relatedList)
      ? item.relatedList.slice(0, 100).map((rel) => ({
          id: String((rel && rel.id) || ''),
          name: String((rel && rel.name) || ''),
          price: Number((rel && rel.price) || 0),
          qty: Number((rel && rel.qty) || 1)
        }))
      : [],
    resalePrice: Number((item && item.resalePrice) || 0),
    status: String((item && item.status) || 'serving'),
    pinned: !!(item && item.pinned),
    excludeAsset: !!(item && item.excludeAsset),
    excludeDaily: !!(item && item.excludeDaily),
    useCount: Math.max(0, Number((item && item.useCount) || 0)),
    lastUseAt: String((item && item.lastUseAt) || '')
  })).filter((item) => !!item.id);
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const safeAssets = normalizeAssets(event && event.xishuAssets);

  try {
    await db.collection('user_configs').doc(OPENID).update({
      data: {
        xishuAssets: safeAssets,
        xishuUpdateTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    });
    return { success: true };
  } catch (err) {
    const msg = String((err && (err.errMsg || err.message)) || '');
    const notFound = msg.includes('does not exist') || msg.includes('doc not exists') || msg.includes('document not found');

    if (!notFound) {
      return { success: false, errMsg: msg || 'syncXishuAssets failed' };
    }

    try {
      await db.collection('user_configs').add({
        data: {
          _id: OPENID,
          xishuAssets: safeAssets,
          xishuUpdateTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      });
      return { success: true };
    } catch (addErr) {
      const addMsg = String((addErr && (addErr.errMsg || addErr.message)) || '');
      const maybeExists = addMsg.includes('already exists') || addMsg.includes('duplicate key');
      if (maybeExists) {
        try {
          await db.collection('user_configs').doc(OPENID).update({
            data: {
              xishuAssets: safeAssets,
              xishuUpdateTime: db.serverDate(),
              updateTime: db.serverDate()
            }
          });
          return { success: true };
        } catch (retryErr) {
          return { success: false, errMsg: String((retryErr && (retryErr.errMsg || retryErr.message)) || 'syncXishuAssets retry failed') };
        }
      }
      return { success: false, errMsg: addMsg || 'syncXishuAssets add failed' };
    }
  }
};
