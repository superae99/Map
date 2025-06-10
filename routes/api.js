const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

// 메모리 캐시 (간단한 캐싱)
let dataCache = null;
let cacheTime = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5분

// 데이터 로딩 함수
async function loadSalesData() {
    // 캐시 확인
    if (dataCache && cacheTime && (Date.now() - cacheTime < CACHE_DURATION)) {
        console.log('캐시에서 데이터 반환');
        return dataCache;
    }

    try {
        // public/data.json 파일 읽기
        const dataPath = path.join(__dirname, '../public/data.json');
        console.log('데이터 파일 경로:', dataPath);
        
        const data = await fs.readFile(dataPath, 'utf8');
        const jsonData = JSON.parse(data);
        
        // 캐시 업데이트
        dataCache = jsonData;
        cacheTime = Date.now();
        
        console.log(`데이터 로드 완료: ${jsonData.length}개 항목`);
        return jsonData;
    } catch (error) {
        console.error('데이터 로드 실패:', error);
        throw new Error('데이터 파일을 읽을 수 없습니다.');
    }
}

// GET /api/data - 영업 데이터 조회
router.get('/data', async (req, res) => {
    try {
        console.log('API /data 호출됨');
        const data = await loadSalesData();
        
        res.json({
            success: true,
            data: data,
            count: data.length,
            source: 'local_file',
            cached: dataCache && cacheTime && (Date.now() - cacheTime < CACHE_DURATION)
        });
    } catch (error) {
        console.error('API 에러:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// GET /api/health - API 상태 확인
router.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        cache: {
            hasCache: !!dataCache,
            cacheAge: cacheTime ? Date.now() - cacheTime : null
        }
    });
});

// POST /api/data/clear-cache - 캐시 클리어 (개발용)
router.post('/data/clear-cache', (req, res) => {
    dataCache = null;
    cacheTime = null;
    console.log('데이터 캐시 클리어됨');
    
    res.json({
        success: true,
        message: '캐시가 클리어되었습니다.'
    });
});

module.exports = router;