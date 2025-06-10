// Express.js 서버 설정
const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Railway 호환성을 위해 추가

// 메모리 사용량 로깅
console.log('서버 시작 메모리:', process.memoryUsage());

// 미들웨어 설정 (메모리 절약을 위해 limit 축소)
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 정적 파일 서빙 (HTML, CSS, JS, images 등)
app.use(express.static(path.join(__dirname, 'public')));

// API 라우트
app.use('/api', require('./routes/api'));

// 메인 페이지 (public/index.html 사용)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
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

// Health check 엔드포인트 추가
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', memory: process.memoryUsage() });
});

// 서버 시작
const server = app.listen(PORT, HOST, () => {
    console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`📱 로컬 접속: http://localhost:${PORT}`);
    console.log(`🌐 Railway URL: ${process.env.RAILWAY_STATIC_URL || 'Railway에 배포 후 확인'}`);
    console.log(`💾 메모리 사용량:`, process.memoryUsage());
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM 신호 수신, 서버 종료 중...');
    server.close(() => {
        console.log('서버가 정상적으로 종료되었습니다.');
        process.exit(0);
    });
});

module.exports = app;