const express = require('express');
const cors = require('cors');
const apiRouter = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// 允许的精确域名（可选）
const exactAllowed = [
    'http://localhost:5173',
    'https://your-project-frontend.pages.dev',
    // 可以添加固定的自定义域名
];

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);

        // 精确匹配
        if (exactAllowed.includes(origin)) {
            return callback(null, true);
        }

        // 正则动态匹配
        const allowedPatterns = [
            /^https?:\/\/.*\.pages\.dev$/,
            /^https?:\/\/.*\.vercel\.app$/,
        ];
        for (const pattern of allowedPatterns) {
            if (pattern.test(origin)) {
                return callback(null, true);
            }
        }

        callback(new Error(`CORS not allowed for origin: ${origin}`));
    },
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());
app.use('/api', apiRouter);

app.get('/', (req, res) => {
    res.send('✅ Backend is running!');
});

app.listen(PORT, () => {
    console.log(`✅ Server is running on port ${PORT}`);
});