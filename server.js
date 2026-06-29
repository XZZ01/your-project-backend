const express = require('express');
const cors = require('cors');
const apiRouter = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;  // 优先使用平台

app.use(cors());
app.use(express.json());
app.use('/api', apiRouter);

app.get('/', (req, res) => {
    res.send('✅ Backend is running!');
});

app.listen(PORT, () => {
    console.log(`✅ Server is running on port ${PORT}`);
});