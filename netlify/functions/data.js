// 데이터 조회 API - GitHub 연동 지원
const fs = require('fs').promises;
const path = require('path');
const GitHubStorage = require('./github-storage');

exports.handler = async (event, context) => {
    const { httpMethod: method } = event;
    
    // CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };
    
    if (method === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: ''
        };
    }
    
    if (method !== 'GET') {
        return {
            statusCode: 405,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
    
    try {
        console.log('데이터 API 호출됨');
        
        let jsonData;
        let dataSource = 'local';
        let cacheInfo = null;
        
        // GitHub 토큰이 있으면 GitHub에서 먼저 시도
        if (process.env.GITHUB_TOKEN) {
            try {
                console.log('GitHub에서 데이터 로드 시도...');
                const githubStorage = new GitHubStorage();
                const result = await githubStorage.getData();
                jsonData = result.data;
                dataSource = 'github';
                console.log(`GitHub에서 ${jsonData.length}개 데이터 로드 완료`);
            } catch (error) {
                console.warn('GitHub 로드 실패, 로컬 파일로 폴백:', error.message);
                dataSource = 'local_fallback';
            }
        }
        
        // GitHub 로드 실패시 또는 토큰이 없을 때 로컬 파일 사용
        if (!jsonData) {
            try {
                console.log('로컬 파일에서 데이터 로드...');
                const dataPath = path.join(__dirname, '../../public/data.json');
                const data = await fs.readFile(dataPath, 'utf8');
                jsonData = JSON.parse(data);
                console.log(`로컬 파일에서 ${jsonData.length}개 데이터 로드 완료`);
            } catch (error) {
                console.error('로컬 파일 로드도 실패:', error.message);
                throw new Error('데이터를 로드할 수 없습니다.');
            }
        }
        
        // 데이터 품질 검증
        const validData = jsonData.filter(item => 
            item && 
            typeof item === 'object' && 
            item['거래처명'] && 
            item['담당 영업사원']
        );
        
        if (validData.length !== jsonData.length) {
            console.warn(`데이터 품질 이슈: ${jsonData.length - validData.length}개 항목이 불완전함`);
        }
        
        return {
            statusCode: 200,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
                success: true,
                data: validData,
                metadata: {
                    count: validData.length,
                    totalOriginal: jsonData.length,
                    source: dataSource,
                    githubEnabled: !!process.env.GITHUB_TOKEN,
                    timestamp: new Date().toISOString(),
                    cacheInfo: cacheInfo
                }
            })
        };
        
    } catch (error) {
        console.error('데이터 API 에러:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: error.message,
                metadata: {
                    githubEnabled: !!process.env.GITHUB_TOKEN,
                    timestamp: new Date().toISOString()
                }
            })
        };
    }
};