// 引入汇率工具
const exchangeRate = require('./exchangeRate.js');

/**
 * 金额格式化：保留两位小数，添加千分位逗号
 * @param {number} num - 金额数字
 * @returns {string} 格式化后的金额
 */
function formatNumber(num) {
  if (isNaN(num)) return '0.00';
  return num.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
}

/**
 * 货币金额格式化（带符号）
 * @param {number} amount - 金额
 * @param {string} currencyCode - 货币代码
 * @returns {string} 格式化后的金额（如 ¥1,234.56）
 */
function formatCurrency(amount, currencyCode) {
  const currency = exchangeRate.getCurrencyInfo(currencyCode);
  const formattedNum = formatNumber(amount);
  return `${currency.symbol}${formattedNum}`;
}

/**
 * 日期格式化：YYYY-MM-DD
 * @param {string|Date} date - 日期字符串/Date对象
 * @returns {string} 格式化后的日期
 */
function formatDate(date) {
  if (!date) return '未知日期';
  
  // 统一转为Date对象
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  // 处理无效日期
  if (isNaN(dateObj.getTime())) return '无效日期';
  
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * 获取当前日期的周信息
 * @param {string|Date} date - 基准日期（默认当前日期）
 * @returns {object} 周信息 {start: 周一起始日期, end: 周日结束日期, weekNum: 周数, year: 年份, text: 周文本}
 */
function getWeekInfo(date = new Date()) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const year = dateObj.getFullYear();
  
  // 计算本周周一（中国周：周一为第一天）
  const day = dateObj.getDay() || 7; // 周日转为7
  const monday = new Date(dateObj);
  monday.setDate(dateObj.getDate() - day + 1);
  
  // 计算本周周日
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  // 计算当年第几周（ISO周数）
  const firstDay = new Date(year, 0, 1);
  const pastDaysOfYear = (dateObj - firstDay) / (24 * 60 * 60 * 1000);
  const weekNum = Math.ceil((pastDaysOfYear + firstDay.getDay() + 1) / 7);
  
  return {
    start: formatDate(monday), // 周起始日期 YYYY-MM-DD
    end: formatDate(sunday),   // 周结束日期 YYYY-MM-DD
    weekNum: weekNum,          // 当年第几周
    year: year,                // 年份
    text: `${year}年第${weekNum}周` // 周文本
  };
}

/**
 * 获取当前日期的月信息
 * @param {string|Date} date - 基准日期（默认当前日期）
 * @returns {object} 月信息 {year: 年份, month: 月份, text: 月文本}
 */
function getMonthInfo(date = new Date()) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth() + 1;
  
  return {
    year: year,
    month: month,
    text: `${year}年${month}月`
  };
}

/**
 * 获取指定周的上一周/下一周信息
 * @param {object} weekInfo - 当前周信息（getWeekInfo返回的对象）
 * @param {string} type - prev: 上一周, next: 下一周
 * @returns {object} 新的周信息
 */
function getAdjacentWeek(weekInfo, type = 'prev') {
  // 解析周起始日期
  const startDate = new Date(weekInfo.start);
  // 加减7天
  const offset = type === 'prev' ? -7 : 7;
  startDate.setDate(startDate.getDate() + offset);
  // 返回新周信息
  return getWeekInfo(startDate);
}

/**
 * 获取友好日期文本（今天/昨天/YYYY-MM-DD）
 * @param {string|Date} date - 日期
 * @returns {string} 友好文本
 */
function getFriendlyDate(date) {
  if (!date) return '未知日期';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  
  // 格式化日期为 YYYY-MM-DD 用于比较
  const dateStr = formatDate(dateObj);
  const todayStr = formatDate(today);
  const yesterdayStr = formatDate(yesterday);
  
  if (dateStr === todayStr) return '今天';
  if (dateStr === yesterdayStr) return '昨天';
  
  return dateStr;
}

module.exports = {
  formatNumber,
  formatCurrency,
  formatDate,
  getWeekInfo,
  getMonthInfo,
  getAdjacentWeek,
  getFriendlyDate
};