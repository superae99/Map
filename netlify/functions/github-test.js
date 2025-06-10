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
        const token = process.env.GITHUB_TOKEN;
        const hasToken = !!token;
        
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
                    },
                    recommendations: [
                        '1. GitHub Personal Access Token 생성',
                        '2. Netlify 환경변수에 GITHUB_TOKEN 설정',
                        '3. Token에 repo 권한 부여 확인'
                    ]
                })
            };
        }
        
        // 토큰 기본 검증
        const tokenInfo = {
            length: token.length,
            prefix: token.substring(0, 8) + '...',
            format: token.startsWith('ghp_') ? 'Personal Access Token (Classic)' :
                   token.startsWith('github_pat_') ? 'Fine-grained Personal Access Token' :
                   'Unknown format',
            valid_format: token.startsWith('ghp_') || token.startsWith('github_pat_')
        };
        
        let githubStorage;
        try {
            githubStorage = new GitHubStorage();
        } catch (initError) {
            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({
                    success: false,
                    message: `GitHub Storage 초기화 실패: ${initError.message}`,
                    github: {
                        enabled: true,
                        token: true,
                        tokenInfo: tokenInfo,
                        initError: initError.message
                    }
                })
            };
        }
        
        const connectionTest = await githubStorage.testConnection();
        
        // 추가 진단 정보
        const diagnostics = {
            environment: {
                NODE_ENV: process.env.NODE_ENV,
                NETLIFY: !!process.env.NETLIFY,
                AWS_REGION: process.env.AWS_REGION
            },
            repository: {
                owner: process.env.GITHUB_OWNER || 'superae99',
                repo: process.env.GITHUB_REPO || 'Map',
                branch: process.env.GITHUB_BRANCH || 'main'
            }
        };
        
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                success: connectionTest.connected,
                message: connectionTest.connected ? 
                    'GitHub 연결이 성공적으로 확인되었습니다.' : 
                    `GitHub 연결에 실패했습니다: ${connectionTest.error}`,
                github: {
                    enabled: true,
                    token: true,
                    tokenInfo: tokenInfo,
                    connection: connectionTest,
                    diagnostics: diagnostics
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