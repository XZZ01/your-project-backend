// backend/services/scheduler.js
const schedule = require('node-schedule');
const { isWorkdayInChina } = require('./holiday');
const { sendBatchMessage } = require('./feishu');

// 存储当前定时任务信息
let currentJob = null;
let currentConfig = null;

/**
 * 根据重复类型生成 schedule 规则
 * @param {string} repeatType - 'once' | 'daily' | 'workday' | 'weekly'
 * @param {Date} dateTime - 首次执行的时间（对于重复任务，表示起始时间）
 * @param {number} [dayOfWeek] - 当 repeatType='weekly' 时，指定星期几（0=周日,1=周一...）
 * @returns {object} node-schedule 的规则对象
 */
function buildScheduleRule(repeatType, dateTime, dayOfWeek) {
    const rule = new schedule.RecurrenceRule();
    // 从 dateTime 中提取时、分
    const hours = dateTime.getHours();
    const minutes = dateTime.getMinutes();

    switch (repeatType) {
        case 'once':
            // 一次性任务，精确到分钟
            rule.hour = hours;
            rule.minute = minutes;
            rule.date = dateTime.getDate();
            rule.month = dateTime.getMonth() + 1; // node-schedule 月份从1开始
            rule.year = dateTime.getFullYear();
            break;

        case 'daily':
            rule.hour = hours;
            rule.minute = minutes;
            // 每天执行，不限制日期和月份
            break;

        case 'workday':
            rule.hour = hours;
            rule.minute = minutes;
            // 周一到周五（1-5）
            rule.dayOfWeek = [1, 2, 3, 4, 5];
            break;

        case 'weekly':
            rule.hour = hours;
            rule.minute = minutes;
            rule.dayOfWeek = dayOfWeek; // 用户选择的星期几，如 [1,3,5]
            break;

        default:
            throw new Error(`不支持的重复类型: ${repeatType}`);
    }
    return rule;
}

/**
 * 启动或更新定时任务
 * @param {object} config
 * @param {string} config.repeatType - 'once' | 'daily' | 'workday' | 'weekly'
 * @param {string|Date} config.dateTime - ISO 字符串或 Date 对象，表示首次执行时间（对于重复任务，用于提取时分）
 * @param {number} [config.dayOfWeek] - 仅当 repeatType='weekly' 时必填，0-6
 * @param {string[]} config.openIds
 * @param {string} config.msgType
 * @param {object} config.content
 * @param {boolean} config.enabled
 */
function startScheduledTask(config) {
    // 如果已有任务，先取消
    if (currentJob) {
        currentJob.cancel();
        currentJob = null;
    }

    if (!config.enabled) {
        console.log('⏸️ 定时任务已禁用');
        currentConfig = null;
        return;
    }

    const { repeatType, dateTime, dayOfWeek, openIds, msgType, content } = config;

    // 解析时间
    const startDate = typeof dateTime === 'string' ? new Date(dateTime) : dateTime;
    if (isNaN(startDate.getTime())) {
        throw new Error('无效的日期时间');
    }


    // 如果是 'once' 且时间已过，则直接跳过（或报错）
    if (repeatType === 'once' && startDate <= new Date()) {
        throw new Error('一次性任务的时间不能是过去的时间');
    }

    // 存储配置
    currentConfig = { ...config, startDate };

// 创建定时任务
let job;

if (repeatType === 'once') {
    // 一次性任务：直接传入 Date 对象
    job = schedule.scheduleJob(startDate, async () => {
        const now = new Date();
        console.log(`⏰ 一次性任务触发: ${now.toLocaleString()}`);
        // 执行发送
        try {
            console.log(`📨 发送消息给 ${openIds.length} 位接收人...`);
            const result = await sendBatchMessage(openIds, msgType, content);
            console.log('✅ 消息发送成功:', result.data?.message_id);
        } catch (error) {
            console.error('❌ 消息发送失败:', error.message);
        }
        // 任务执行后，清除当前任务引用
        currentJob = null;
        currentConfig = null;
        console.log('✅ 一次性任务执行完成，已自动取消');
    });
} else {
    // 重复任务：使用 RecurrenceRule
    let rule;
    try {
        rule = buildScheduleRule(repeatType, startDate, dayOfWeek);
    } catch (err) {
        throw err;
    }
    job = schedule.scheduleJob(rule, async () => {
        const now = new Date();
        console.log(`⏰ 定时任务触发: ${now.toLocaleString()}`);
        if (repeatType === 'workday') {
            const todayStr = now.toISOString().split('T')[0];
            const isWorkday = await isWorkdayInChina(todayStr);
            if (!isWorkday) {
                console.log(`📅 ${todayStr} 是节假日或周末，跳过发送`);
                return;
            }
        }
        try {
            console.log(`📨 发送消息给 ${openIds.length} 位接收人...`);
            const result = await sendBatchMessage(openIds, msgType, content);
            console.log('✅ 消息发送成功:', result.data?.message_id);
        } catch (error) {
            console.error('❌ 消息发送失败:', error.message);
        }
    });
}

currentJob = job;
console.log('✅ 定时任务已启动，类型:', repeatType);
console.log('任务对象:', currentJob); // 调试用
}


/**
 * 取消定时任务
 */
function stopScheduledTask() {
    if (currentJob) {
        currentJob.cancel();
        currentJob = null;
    }
    currentConfig = null;
    console.log('⏹️ 定时任务已取消');
}

/**
 * 获取当前任务配置
 */
function getScheduledTaskConfig() {
    if (!currentConfig) return null;
    // 返回副本，避免外部修改
    return { ...currentConfig };
}

module.exports = {
    startScheduledTask,
    stopScheduledTask,
    getScheduledTaskConfig,
};