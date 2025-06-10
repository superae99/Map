// API 라우트 설정
const express = require('express');
const router = express.Router();

// 기존 API 파일들 import
const dataHandler = require('../api/data');
const updateSalespersonHandler = require('../api/update-salesperson');

// 데이터 조회 API
router.get('/data', dataHandler);
router.options('/data', dataHandler);

// 담당자 수정 API  
router.post('/update-salesperson', updateSalespersonHandler);
router.put('/update-salesperson', updateSalespersonHandler);
router.options('/update-salesperson', updateSalespersonHandler);

// API 상태 확인
router.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

module.exports = router;