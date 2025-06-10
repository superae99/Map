const DataLoader = require('./data-loader');
const corsHandler = require('./cors-handler');

exports.handler = async (event, context) => {
    // CORS 처리
    if (event.httpMethod === 'OPTIONS') {
        return corsHandler.handleCors();
    }
    
    try {
        console.log('데이터 API 호출됨');
        const result = await DataLoader.loadData();
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify({
                success: true,
                data: result.data,
                count: result.data.length,
                source: result.storage ? 'github' : 'local'
            })
        };
    } catch (error) {
        console.error('데이터 로드 에러:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
};