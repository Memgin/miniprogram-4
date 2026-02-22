// 云函数 syncUserProfile/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  // 从 event 中解构前端传来的数据
  const { bankCards, depositTarget, selectedRateCodes } = event 

  try {
    // 使用 doc(OPENID).set() 实现全量覆盖
    // 这样 _id 就是 OPENID，查找和更新效率最高
    await db.collection('user_configs').doc(OPENID).set({
      data: {
        // 确保数据为数组/字符串，防止 null 导致前端崩溃
        bankCards: bankCards || [],
        depositTarget: depositTarget || '',
        // 将选中的币种统一转为大写存储，解决你之前的“小写变大写”烦恼
        selectedRateCodes: (selectedRateCodes || ['USD', 'HKD']).map(c => c.toUpperCase()),
        updateTime: db.serverDate() // 使用服务器时间戳
      }
    })
    return { success: true }
  } catch (err) {
    console.error('云端快照保存失败', err)
    return { success: false, errMsg: err.message }
  }
}