// Vercel Serverless Function with GitHub Storage Integration
const DataLoader = require('./data-loader');
const { corsMiddleware, runMiddleware } = require('./cors-handler');

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

exports.handler = async (event, context) => {
    const { httpMethod: method, headers, body, queryStringParameters } = event;
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
        
        const { data: jsonData } = await DataLoader.loadData();
        
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
        
        // 데이터 저장 (GitHub 또는 로컬 파일에)
        const commitMessage = `Update salesperson: ${originalItem.거래처명} - ${originalItem['담당 영업사원']} → ${newSalesperson || originalItem['담당 영업사원']}`;
        const storageType = await DataLoader.saveData(jsonData, commitMessage);
        
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
            storage: storageType
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