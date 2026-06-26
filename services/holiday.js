// backend/services/holiday.js
const { isWorkday } = require('cn-holiday');

function isWorkdayInChina(date) {
    try {
        return isWorkday(date);
    } catch (error) {
        console.error('判断工作日失败:', error.message);
        return true; // 默认返回工作日
    }
}

module.exports = { isWorkdayInChina };