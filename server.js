// backend/server.js
const express = require('express');
const cors = require('cors'); // 引入cors包
const apiRouter = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. 定义允许访问的域名列表
const allowedOrigins = [
    'https://your-project-frontend.pages.dev', // 替换为你的Cloudflare Pages域名
    'http://localhost:5173' // 本地开发环境
];

// 2. 配置CORS选项
const corsOptions = {
    origin: function (origin, callback) {
        // 允许没有origin的请求（如来自Postman或Curl）
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true, // 如果需要携带cookie
    optionsSuccessStatus: 200 // 兼容某些浏览器
};

// 3. 应用CORS中间件
app.use(cors(corsOptions));

// 其他中间件和路由...
app.use(express.json());
app.use('/api', apiRouter);

app.get('/', (req, res) => {
    res.send('✅ Backend is running!');
});

app.listen(PORT, () => {
    console.log(`✅ Server is running on port ${PORT}`);
});