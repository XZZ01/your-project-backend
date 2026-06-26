require('dotenv').config();
// backend/services/feishu.js
const axios = require('axios');

// 飞书应用凭证，你需要替换成自己的
const APP_ID = process.env.APP_ID;
const APP_SECRET = process.env.APP_SECRET;

// 用于缓存 tenant_access_token
let cachedToken = null;
let tokenExpireTime = 0;

/**
 * 获取 tenant_access_token
 * 参考文档：https://open.feishu.cn/document/ukTMukTMukTM/ukDNz4SO0MjL5QzM/auth-v3/auth/tenant_access_token_internal
 */
async function getTenantAccessToken() {
    // 如果缓存有效，直接返回
    const now = Date.now();
    if (cachedToken && tokenExpireTime > now) {
        return cachedToken;
    }

    try {
        if (!APP_ID || !APP_SECRET) {
            console.error('❌ 错误: APP_ID 和 APP_SECRET 未在环境变量中配置！');
            process.exit(1);
        }
        const response = await axios.post(
            'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
            {
                app_id: APP_ID,
                app_secret: APP_SECRET,
            }
        );

        if (response.data.code !== 0) {
            throw new Error(`获取 tenant_access_token 失败: ${response.data.msg}`);
        }

        // 缓存 token，设置过期时间为返回的过期时间减去 5 分钟，作为缓冲
        cachedToken = response.data.tenant_access_token;
        // 飞书返回的过期时间单位是秒
        const expiresIn = response.data.expire || 7200;
        tokenExpireTime = now + (expiresIn - 300) * 1000;

        console.log('✅ 成功获取 tenant_access_token');
        return cachedToken;
    } catch (error) {
        console.error('❌ 获取 tenant_access_token 出错:', error.message);
        throw new Error('获取飞书访问凭证失败，请检查网络或应用配置。');
    }
}

/**
 * 批量发送消息
 * @param {string[]} openIds - 接收者的 open_id 列表
 * @param {string} msgType - 消息类型，如 'text', 'post', 'interactive'
 * @param {object} content - 消息内容对象，不同消息类型结构不同
 * @returns {object} 飞书 API 返回的结果
 */
async function sendBatchMessage(openIds, msgType, content) {
    const token = await getTenantAccessToken();

    const requestBody = {
        open_ids: openIds,
        msg_type: msgType,
        content: content,
    };

    try {
        const response = await axios.post(
            'https://open.feishu.cn/open-apis/message/v4/batch_send/',
            requestBody,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json; charset=utf-8',
                },
            }
        );

        // 飞书 API 返回 code=0 表示成功
        if (response.data.code !== 0) {
            // 将飞书返回的错误信息抛出，便于上层处理
            throw new Error(JSON.stringify({
                code: response.data.code,
                msg: response.data.msg,
                data: response.data.data
            }));
        }

        return response.data;
    } catch (error) {
        // 如果是 axios 网络错误，重新包装一下
        if (error.response) {
            // 飞书 API 返回了错误响应
            const errorData = error.response.data;
            throw new Error(JSON.stringify({
                code: errorData.code || -1,
                msg: errorData.msg || error.message,
                data: errorData.data
            }));
        } else if (error.message) {
            // 我们手动抛出的错误
            throw error;
        } else {
            throw new Error(`调用飞书批量发送接口失败: ${error.message}`);
        }
    }
}

module.exports = {
    getTenantAccessToken,
    sendBatchMessage,
};
