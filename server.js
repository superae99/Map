// Express.js 서버 설정
const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Railway 호환성을 위해 추가

// 미들웨어 설정
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 정적 파일 서빙 (HTML, CSS, JS, images 등)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/data', express.static(path.join(__dirname, 'data')));

// API 라우트
app.use('/api', require('./routes/api'));

// 메인 페이지 (index.html)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 404 처리
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});

// 에러 처리
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
});

// 서버 시작
app.listen(PORT, HOST, () => {
    console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`📱 로컬 접속: http://localhost:${PORT}`);
    console.log(`🌐 Railway URL: ${process.env.RAILWAY_STATIC_URL || 'Railway에 배포 후 확인'}`);
});

module.exports = app;