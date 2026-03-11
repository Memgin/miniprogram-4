// 云函数 getUserProfile/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  try {
    const res = await db.collection('user_configs').doc(OPENID).get()
    return { success: true, data: res.data }
  } catch (err) {
    // 关键：如果是新用户找不到记录，必须返回基础结构，否则 app.js 会报错
    return { 
      success: true, 
      data: {
        bankCards: [],
        depositTarget: '',
        selectedRateCodes: ['usd', 'hkd'],
        savedStressScenarios: [],
        latestStressResult: null,
        alertRules: [],
        alertHistory: [],
        lastAlertCheckAt: '',
        latestRiskSummary: null,
        latestAdvice: null,
        privacyMode: false,
        biometricEnabled: false
      }
    }
  }
}