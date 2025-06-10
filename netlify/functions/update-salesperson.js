// Netlify Function for updating salesperson data
const fs = require('fs').promises;
const path = require('path');

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
    
    // CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    };
    
    // OPTIONS 요청 처리
    if (method === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: ''
        };
    }
    
    // POST와 PUT 요청 처리
    if (method !== 'POST' && method !== 'PUT') {
        return {
            statusCode: 405,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
    
    try {
        const requestBody = JSON.parse(body || '{}');
        const { 
            storeId, 
            newSalesNumber, 
            newSalesperson, 
            editReason, 
            editNote 
        } = requestBody;
        
        console.log('수정 요청:', { storeId, newSalesNumber, newSalesperson });
        
        // 데이터 파일 직접 로드
        const dataPath = path.join(__dirname, '../../public/data.json');
        const data = await fs.readFile(dataPath, 'utf8');
        const jsonData = JSON.parse(data);
        
        // 수정할 항목 찾기
        const itemIndex = jsonData.findIndex(item => 
            generateStoreId(item) === storeId
        );
        
        if (itemIndex === -1) {
            return {
                statusCode: 404,
                headers: corsHeaders,
                body: JSON.stringify({ 
                    success: false, 
                    error: '수정할 거래처를 찾을 수 없습니다.' 
                })
            };
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
        
        // 데이터 저장 (읽기 전용 모드 - 실제 저장 없음)
        const commitMessage = `Update salesperson: ${originalItem.거래처명} - ${originalItem['담당 영업사원']} → ${newSalesperson || originalItem['담당 영업사원']}`;
        console.log('변경 사항 (읽기 전용):', commitMessage);
        const storageType = 'readonly';
        
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
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ 
                success: true, 
                message: '담당자 정보가 성공적으로 수정되었습니다.',
                updatedItem: jsonData[itemIndex],
                editRecord: editRecord,
                storage: storageType
            })
        };
        
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ 
                success: false, 
                error: '서버 오류가 발생했습니다.',
                details: error.message
            })
        };
    }
};