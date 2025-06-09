const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(cors({
    origin: true, // 모든 origin 허용
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// OPTIONS 요청 처리 (Preflight)
app.options('*', cors());

app.use(express.json());
app.use(express.static('./')); // 현재 디렉토리의 모든 파일을 정적으로 서빙

// 데이터 파일 경로
const DATA_FILE = './data/output_address.json';
const SALES_DATA_FILE = './data/juso_output_file.json';
const EDIT_HISTORY_FILE = './data/edit_history.json';
const BACKUP_DIR = './backups';

// 백업 디렉토리 생성
async function ensureBackupDir() {
    try {
        await fs.mkdir(BACKUP_DIR, { recursive: true });
    } catch (error) {
        console.warn('백업 디렉토리 생성 실패:', error.message);
    }
}

// 거래처 고유 ID 생성 함수 (프론트엔드와 동일)
function generateStoreId(item) {
    const businessNumber = item.사업자번호;
    if (businessNumber && businessNumber !== 'null' && businessNumber !== null) {
        return `BIZ_${businessNumber}`;
    }
    
    const storeName = item.거래처명 || '';
    const address = item['기본주소(사업자기준)'] || '';
    const combined = storeName + address;
    
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
        const char = combined.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return `STORE_${Math.abs(hash)}`;
}

// 데이터 백업 함수
async function backupData() {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(BACKUP_DIR, `data_backup_${timestamp}.json`);
        
        const data = await fs.readFile(DATA_FILE, 'utf8');
        await fs.writeFile(backupPath, data);
        
        console.log(`✅ 데이터 백업 생성: ${backupPath}`);
        return backupPath;
    } catch (error) {
        console.error('❌ 백업 생성 실패:', error);
        throw error;
    }
}

// 수정 기록 저장 함수
async function saveEditHistory(editRecord) {
    try {
        let history = [];
        
        // 기존 수정 기록 로드
        try {
            const existingHistory = await fs.readFile(EDIT_HISTORY_FILE, 'utf8');
            history = JSON.parse(existingHistory);
        } catch (error) {
            // 파일이 없으면 빈 배열로 시작
            console.log('새로운 수정 기록 파일을 생성합니다.');
        }
        
        // 새 기록 추가
        history.push(editRecord);
        
        // 최근 1000개 기록만 유지
        if (history.length > 1000) {
            history = history.slice(-1000);
        }
        
        // 파일에 저장
        await fs.writeFile(EDIT_HISTORY_FILE, JSON.stringify(history, null, 2));
        console.log('📝 수정 기록 저장 완료');
    } catch (error) {
        console.error('❌ 수정 기록 저장 실패:', error);
    }
}

// API 라우트들

// 1. 데이터 조회 API
app.get('/api/data', async (req, res) => {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error('데이터 로드 실패:', error);
        res.status(500).json({ 
            success: false, 
            error: '데이터를 불러올 수 없습니다.' 
        });
    }
});

// 2. 영업사원 데이터 조회 API
app.get('/api/sales-data', async (req, res) => {
    try {
        const data = await fs.readFile(SALES_DATA_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error('영업사원 데이터 로드 실패:', error);
        res.status(500).json({ 
            success: false, 
            error: '영업사원 데이터를 불러올 수 없습니다.' 
        });
    }
});

// 3. 담당자 수정 API
app.put('/api/update-salesperson', async (req, res) => {
    try {
        const { 
            storeId, 
            newSalesNumber, 
            newSalesperson, 
            editReason, 
            editNote,
            originalData 
        } = req.body;
        
        console.log(`🔄 담당자 수정 요청: ${storeId}`);
        
        // 데이터 백업 생성
        await backupData();
        
        // 현재 데이터 로드
        const data = await fs.readFile(DATA_FILE, 'utf8');
        const jsonData = JSON.parse(data);
        
        // 수정할 항목 찾기
        const itemIndex = jsonData.findIndex(item => 
            generateStoreId(item) === storeId
        );
        
        if (itemIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                error: '수정할 거래처를 찾을 수 없습니다.' 
            });
        }
        
        const originalItem = { ...jsonData[itemIndex] };
        
        // 데이터 수정
        if (newSalesNumber) {
            jsonData[itemIndex]['담당 사번'] = parseInt(newSalesNumber);
        }
        if (newSalesperson) {
            jsonData[itemIndex]['담당 영업사원'] = newSalesperson;
        }
        
        // 수정 시간 추가
        jsonData[itemIndex]['최종수정일시'] = new Date().toISOString();
        
        // 파일에 저장
        await fs.writeFile(DATA_FILE, JSON.stringify(jsonData, null, 2));
        
        // 수정 기록 생성
        const editRecord = {
            timestamp: new Date().toISOString(),
            storeId: storeId,
            storeName: originalItem.거래처명,
            businessNumber: originalItem.사업자번호,
            changes: {
                salesNumber: {
                    before: originalItem['담당 사번'],
                    after: newSalesNumber ? parseInt(newSalesNumber) : originalItem['담당 사번']
                },
                salesperson: {
                    before: originalItem['담당 영업사원'],
                    after: newSalesperson || originalItem['담당 영업사원']
                }
            },
            reason: editReason || '',
            note: editNote || '',
            user: 'system_user', // 향후 사용자 인증 시 실제 사용자 ID로 변경
            ipAddress: req.ip || req.connection.remoteAddress
        };
        
        // 수정 기록 저장
        await saveEditHistory(editRecord);
        
        console.log(`✅ 담당자 수정 완료: ${originalItem.거래처명}`);
        
        res.json({ 
            success: true, 
            message: '담당자 정보가 성공적으로 수정되었습니다.',
            updatedItem: jsonData[itemIndex],
            editRecord: editRecord
        });
        
    } catch (error) {
        console.error('❌ 담당자 수정 실패:', error);
        res.status(500).json({ 
            success: false, 
            error: '담당자 정보 수정 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

// 4. 수정 기록 조회 API
app.get('/api/edit-history', async (req, res) => {
    try {
        const { limit = 100, offset = 0, storeId } = req.query;
        
        let history = [];
        try {
            const data = await fs.readFile(EDIT_HISTORY_FILE, 'utf8');
            history = JSON.parse(data);
        } catch (error) {
            // 파일이 없으면 빈 배열 반환
        }
        
        // 특정 거래처 필터링
        if (storeId) {
            history = history.filter(record => record.storeId === storeId);
        }
        
        // 최신순 정렬
        history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // 페이징 처리
        const total = history.length;
        const paginatedHistory = history.slice(
            parseInt(offset), 
            parseInt(offset) + parseInt(limit)
        );
        
        res.json({
            success: true,
            data: paginatedHistory,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: parseInt(offset) + parseInt(limit) < total
            }
        });
        
    } catch (error) {
        console.error('수정 기록 조회 실패:', error);
        res.status(500).json({ 
            success: false, 
            error: '수정 기록을 불러올 수 없습니다.' 
        });
    }
});

// 5. 백업 파일 목록 조회 API
app.get('/api/backups', async (req, res) => {
    try {
        const files = await fs.readdir(BACKUP_DIR);
        const backupFiles = files
            .filter(file => file.startsWith('data_backup_') && file.endsWith('.json'))
            .map(file => ({
                filename: file,
                path: path.join(BACKUP_DIR, file),
                timestamp: file.replace('data_backup_', '').replace('.json', '')
            }))
            .sort((a, b) => b.timestamp.localeCompare(a.timestamp)); // 최신순
        
        res.json({
            success: true,
            backups: backupFiles
        });
    } catch (error) {
        console.error('백업 목록 조회 실패:', error);
        res.status(500).json({ 
            success: false, 
            error: '백업 목록을 불러올 수 없습니다.' 
        });
    }
});

// 6. 서버 상태 확인 API
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0'
    });
});

// 에러 핸들러
app.use((error, req, res, next) => {
    console.error('서버 오류:', error);
    res.status(500).json({
        success: false,
        error: '서버 내부 오류가 발생했습니다.',
        timestamp: new Date().toISOString()
    });
});

// 404 핸들러
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: '요청한 리소스를 찾을 수 없습니다.',
        path: req.path
    });
});

// 서버 시작
async function startServer() {
    try {
        // 백업 디렉토리 생성
        await ensureBackupDir();
        
        // 서버 시작
        app.listen(PORT, () => {
            console.log(`
🚀 영업 담당 상권 조회 시스템 API 서버가 시작되었습니다!

📍 서버 정보:
   - 포트: ${PORT}
   - URL: http://localhost:${PORT}
   - 환경: ${process.env.NODE_ENV || 'development'}

📋 API 엔드포인트:
   - GET  /api/data              : 거래처 데이터 조회
   - GET  /api/sales-data        : 영업사원 데이터 조회
   - PUT  /api/update-salesperson: 담당자 정보 수정
   - GET  /api/edit-history      : 수정 기록 조회
   - GET  /api/backups           : 백업 파일 목록
   - GET  /api/health            : 서버 상태 확인

🌐 웹 애플리케이션: http://localhost:${PORT}

⏹️  서버 종료: Ctrl+C
            `);
        });
    } catch (error) {
        console.error('❌ 서버 시작 실패:', error);
        process.exit(1);
    }
}

// 프로세스 종료 처리
process.on('SIGINT', () => {
    console.log('\n👋 서버를 종료합니다...');
    process.exit(0);
});

// 서버 시작
startServer();