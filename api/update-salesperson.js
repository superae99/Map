// Vercel Serverless Function with GitHub Storage Integration
const cors = require('cors');
const GitHubStorage = require('./github-storage');

// CORS 미들웨어 초기화
const corsMiddleware = cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
});

// Helper method to wait for a middleware to execute before continuing
function runMiddleware(req, res, fn) {
    return new Promise((resolve, reject) => {
        fn(req, res, (result) => {
            if (result instanceof Error) {
                return reject(result);
            }
            return resolve(result);
        });
    });
}

// 거래처 ID 생성 함수
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

module.exports = async (req, res) => {
    // CORS 미들웨어 실행
    await runMiddleware(req, res, corsMiddleware);
    
    // OPTIONS 요청 처리
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // POST와 PUT 요청 처리
    if (req.method !== 'POST' && req.method !== 'PUT') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { 
            storeId, 
            newSalesNumber, 
            newSalesperson, 
            editReason, 
            editNote 
        } = req.body;
        
        console.log('수정 요청:', { storeId, newSalesNumber, newSalesperson });
        
        // GitHub 설정 (환경 변수 사용)
        const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
        
        let jsonData;
        let storage = null;
        
        // GitHub 사용 여부 확인 (프로덕션 환경)
        if (GITHUB_TOKEN) {
            storage = new GitHubStorage();
            const result = await storage.getData();
            jsonData = result.data;
        } else {
            // 로컬 파일에서 데이터 읽기 (개발 환경)
            console.log('로컬 파일에서 데이터 로드 중...');
            const fs = require('fs').promises;
            const path = require('path');
            const dataPath = path.join(process.cwd(), 'data', 'output_address.json');
            const data = await fs.readFile(dataPath, 'utf8');
            jsonData = JSON.parse(data);
        }
        
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
        
        // 원본 데이터 백업
        const originalItem = { ...jsonData[itemIndex] };
        
        // 데이터 수정
        if (newSalesNumber !== null && newSalesNumber !== undefined && newSalesNumber !== '') {
            jsonData[itemIndex]['담당 사번'] = parseInt(newSalesNumber);
            console.log('사번 수정:', originalItem['담당 사번'], '→', newSalesNumber);
        }
        if (newSalesperson !== null && newSalesperson !== undefined && newSalesperson !== '') {
            jsonData[itemIndex]['담당 영업사원'] = newSalesperson;
            console.log('담당자 수정:', originalItem['담당 영업사원'], '→', newSalesperson);
        }
        
        jsonData[itemIndex]['최종수정일시'] = new Date().toISOString();
        
        // 데이터 저장
        if (storage) {
            // GitHub에 저장 (프로덕션 환경)
            const commitMessage = `Update salesperson: ${originalItem.거래처명} - ${originalItem['담당 영업사원']} → ${newSalesperson || originalItem['담당 영업사원']}`;
            await storage.updateData(jsonData, commitMessage);
        } else {
            // 로컬 파일에 저장 (개발 환경에서만)
            console.log('경고: Vercel 환경에서는 파일 저장이 영구적이지 않습니다.');
        }
        
        // 수정 기록 생성
        const editRecord = {
            timestamp: new Date().toISOString(),
            storeId: storeId,
            storeName: originalItem.거래처명,
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
            reason: editReason,
            note: editNote
        };
        
        // 성공 응답
        res.status(200).json({ 
            success: true, 
            message: '담당자 정보가 성공적으로 수정되었습니다.',
            updatedItem: jsonData[itemIndex],
            editRecord: editRecord,
            storage: storage ? 'github' : 'local'
        });
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ 
            success: false, 
            error: '서버 오류가 발생했습니다.',
            details: error.message
        });
    }
};