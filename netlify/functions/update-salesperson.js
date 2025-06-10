// Netlify Function for updating salesperson data with GitHub integration
const fs = require('fs').promises;
const path = require('path');
const GitHubStorage = require('./github-storage');

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
        
        // GitHub 토큰이 있으면 GitHub에서 로드, 없으면 로컬 파일 로드
        let jsonData;
        let useGitHub = false;
        
        if (process.env.GITHUB_TOKEN) {
            try {
                const githubStorage = new GitHubStorage();
                const result = await githubStorage.getData();
                jsonData = result.data;
                useGitHub = true;
                console.log('GitHub에서 데이터 로드 완료');
            } catch (error) {
                console.warn('GitHub 로드 실패, 로컬 파일 사용:', error.message);
                useGitHub = false;
            }
        }
        
        if (!useGitHub) {
            // 로컬 파일에서 로드
            const dataPath = path.join(__dirname, '../../public/data.json');
            const data = await fs.readFile(dataPath, 'utf8');
            jsonData = JSON.parse(data);
            console.log('로컬 파일에서 데이터 로드 완료');
        }
        
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
        
        // 데이터 저장
        const commitMessage = `Update salesperson: ${originalItem.거래처명} - ${originalItem['담당 영업사원']} → ${newSalesperson || originalItem['담당 영업사원']}`;
        let storageType = 'readonly';
        let saveResult = null;
        
        if (useGitHub) {
            try {
                const githubStorage = new GitHubStorage();
                saveResult = await githubStorage.updateData(jsonData, commitMessage);
                storageType = 'github';
                console.log('GitHub에 저장 완료:', saveResult.commit);
            } catch (error) {
                console.error('GitHub 저장 실패:', error.message);
                storageType = 'github_error';
                saveResult = { error: error.message };
            }
        } else {
            console.log('변경 사항 (로컬 읽기 전용):', commitMessage);
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
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ 
                success: true, 
                message: storageType === 'github' ? 
                    '담당자 정보가 GitHub에 성공적으로 저장되었습니다.' :
                    storageType === 'github_error' ?
                    '담당자 정보가 수정되었지만 GitHub 저장에 실패했습니다.' :
                    '담당자 정보가 수정되었습니다 (읽기 전용 모드).',
                updatedItem: jsonData[itemIndex],
                editRecord: editRecord,
                storage: {
                    type: storageType,
                    result: saveResult,
                    githubEnabled: !!process.env.GITHUB_TOKEN
                }
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