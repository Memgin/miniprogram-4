// 云函数 syncUserProfile/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  // 从 event 中解构前端传来的数据
  const {
    bankCards,
    depositTarget,
    selectedRateCodes,
    savedStressScenarios,
    latestStressResult,
    alertRules,
    alertHistory,
    lastAlertCheckAt,
    latestRiskSummary,
    latestAdvice,
    privacyMode,
    biometricEnabled
  } = event 

  try {
    // 使用 doc(OPENID).set() 实现全量覆盖
    // 这样 _id 就是 OPENID，查找和更新效率最高
    await db.collection('user_configs').doc(OPENID).set({
      data: {
        // 确保数据为数组/字符串，防止 null 导致前端崩溃
        bankCards: bankCards || [],
        depositTarget: depositTarget || '',
        // 首页和详情页统一按小写币种代码处理，避免不同页面大小写混用
        selectedRateCodes: (selectedRateCodes || ['usd', 'hkd']).map(c => String(c || '').toLowerCase()),
        savedStressScenarios: Array.isArray(savedStressScenarios) ? savedStressScenarios : [],
        latestStressResult: latestStressResult || null,
        alertRules: Array.isArray(alertRules) ? alertRules : [],
        alertHistory: Array.isArray(alertHistory) ? alertHistory.slice(0, 20) : [],
        lastAlertCheckAt: lastAlertCheckAt || '',
        latestRiskSummary: latestRiskSummary || null,
        latestAdvice: latestAdvice || null,
        privacyMode: !!privacyMode,
        biometricEnabled: !!biometricEnabled,
        updateTime: db.serverDate() // 使用服务器时间戳
      }
    })
    return { success: true }
  } catch (err) {
    console.error('云端快照保存失败', err)
    return { success: false, errMsg: err.message }
  }
}