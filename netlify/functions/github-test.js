// GitHub 연결 테스트 엔드포인트
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
        const hasToken = !!process.env.GITHUB_TOKEN;
        
        if (!hasToken) {
            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: false,
                    message: 'GITHUB_TOKEN 환경변수가 설정되지 않았습니다.',
                    github: {
                        enabled: false,
                        token: false
                    }
                })
            };
        }
        
        const githubStorage = new GitHubStorage();
        const connectionTest = await githubStorage.testConnection();
        
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                success: connectionTest.connected,
                message: connectionTest.connected ? 
                    'GitHub 연결이 성공적으로 확인되었습니다.' : 
                    'GitHub 연결에 실패했습니다.',
                github: {
                    enabled: true,
                    token: true,
                    connection: connectionTest
                },
                timestamp: new Date().toISOString()
            })
        };
        
    } catch (error) {
        console.error('GitHub 테스트 에러:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                message: 'GitHub 연결 테스트 중 오류가 발생했습니다.',
                error: error.message,
                github: {
                    enabled: !!process.env.GITHUB_TOKEN,
                    token: !!process.env.GITHUB_TOKEN
                }
            })
        };
    }
};