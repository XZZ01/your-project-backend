const express = require('express');
const cors = require('cors');
const apiRouter = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;  // 优先使用平台

app.use(cors({
  origin: [
    'https://your-project-frontend-al2v4r8d1-xzz1.vercel.app/',  // 你的 Vercel 前端地址
    'http://localhost:5173',            // 开发环境
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use('/api', apiRouter);

app.get('/', (req, res) => {
    res.send('✅ Backend is running!');
});

app.listen(PORT, () => {
    console.log(`✅ Server is running on port ${PORT}`);
});