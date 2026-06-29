// backend/routes/api.js
const express = require('express');
const router = express.Router();
const feishuService = require('../services/feishu');
const axios = require('axios');

// ... (你之前的 /items 相关路由) ...
// 模拟内存数据库（数组）
let items = [
  { id: 1, name: 'Item 1' },
  { id: 2, name: 'Item 2' },
];
let nextId = 3;

// GET /api/items - 获取所有数据
router.get('/items', (req, res) => {
  res.json(items);
});

// POST /api/items - 添加新数据
router.post('/items', (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }
  const newItem = { id: nextId++, name };
  items.push(newItem);
  res.status(201).json(newItem);
});

// DELETE /api/items/:id - 删除数据（可选）
router.delete('/items/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const index = items.findIndex(item => item.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Item not found' });
  }
  items.splice(index, 1);
  res.status(204).send();
});

/**
 * POST /api/send-batch-message
 * 前端调用此接口来发送飞书批量消息
 * 请求体示例: { "openIds": ["ou_xxx"], "msgType": "text", "content": { "text": "Hello" } }
 */
router.post('/send-batch-message', async (req, res) => {
    const { openIds, departmentIds, msgType, content } = req.body;

    // 校验：至少有一个接收对象
    if ((!openIds || openIds.length === 0) && (!departmentIds || departmentIds.length === 0)) {
        return res.status(400).json({ error: '至少指定一个用户或部门' });
    }

    try {
        // 调用飞书服务，传入 departmentIds
        const result = await feishuService.sendBatchMessage(
            openIds || [],
            msgType,
            content,
            departmentIds || [] // 新增参数
        );
        res.json({
            success: true,
            data: result.data,
            message: '消息发送成功',
        });
    } catch (error) {
        // ... 错误处理 ...
    }
});

/**
 * GET /api/users
 * 获取当前应用通讯录权限范围内的用户列表
 */
router.get('/users', async (req, res) => {
    try {
        // 1. 获取一个有效的 tenant_access_token
        const token = await feishuService.getTenantAccessToken();

        // 2. 调用飞书 API 获取用户列表
        // 注意：不传 department_id 会返回权限范围内的所有独立用户[reference:4][reference:5]
        const response = await axios.get(
            'https://open.feishu.cn/open-apis/contact/v3/users', // 接口地址[reference:6][reference:7]
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json; charset=utf-8',
                },
                params: {
                    page_size: 100, // 每页数量，最大100[reference:8][reference:9]
                    // 不传 department_id 以获取所有权限范围内用户[reference:10]
                }
            }
        );

        // 3. 处理飞书 API 返回结果
        if (response.data.code !== 0) {
            throw new Error(`获取用户列表失败: ${response.data.msg}`);
        }

        // 提取用户数据，只返回前端需要的字段（如 open_id 和 name）
        const users = response.data.data.items.map(user => ({
            open_id: user.open_id,
            name: user.name,
        }));

        res.json({
            success: true,
            data: users,
        });
    } catch (error) {
        console.error('获取用户列表失败:', error.message);
        res.status(500).json({
            success: false,
            error: error.message || '获取用户列表失败，请稍后重试',
        });
    }
});

// 获取部门列表
router.get('/departments', async (req, res) => {
    try {
        const departments = await feishuService.getDepartments();
        res.json({
            success: true,
            data: departments,
        });
    } catch (error) {
        console.error('获取部门列表失败:', error.message);
        res.status(500).json({
            success: false,
            error: error.message || '获取部门列表失败',
        });
    }
});

const {
    startScheduledTask,
    stopScheduledTask,
    getScheduledTaskConfig,
} = require('../services/scheduler');

// 获取当前定时任务配置
router.get('/scheduled-task', (req, res) => {
    const config = getScheduledTaskConfig();
    res.json({
        success: true,
        data: config || null,
    });
});

// 更新定时任务配置
router.post('/scheduled-task', async (req, res) => {
    const { 
        repeatType,      // 'once' | 'daily' | 'workday' | 'weekly'
        dateTime,        // ISO 字符串
        dayOfWeek,       // 当 repeatType='weekly' 时必填
        openIds,
        msgType,
        content,
        enabled
    } = req.body;

    // 基本校验
    if (!repeatType) {
        return res.status(400).json({ error: 'repeatType 不能为空' });
    }
    if (!dateTime) {
        return res.status(400).json({ error: 'dateTime 不能为空' });
    }
    if (repeatType === 'weekly' && (dayOfWeek === undefined || dayOfWeek === null)) {
        return res.status(400).json({ error: 'weekly 类型需要指定 dayOfWeek' });
    }
    if (!openIds || !Array.isArray(openIds) || openIds.length === 0) {
        return res.status(400).json({ error: 'openIds 必须是非空数组' });
    }
    if (!content) {
        return res.status(400).json({ error: 'content 不能为空' });
    }

    try {
        startScheduledTask({
            repeatType,
            dateTime,
            dayOfWeek,
            openIds,
            msgType: msgType || 'text',
            content,
            enabled: enabled !== undefined ? enabled : true,
        });
        res.json({
            success: true,
            message: '定时任务已更新',
        });
    } catch (error) {
        console.error('更新定时任务失败:', error);
        res.status(500).json({
            success: false,
            error: error.message || '更新定时任务失败',
        });
    }
});

// 停止定时任务
router.delete('/scheduled-task', (req, res) => {
    stopScheduledTask();
    res.json({
        success: true,
        message: '定时任务已停止',
    });
});

module.exports = router;