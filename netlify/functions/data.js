// Get store data endpoint with GitHub storage
const fs = require('fs').promises;
const path = require('path');

exports.handler = async (event, context) => {
    const { httpMethod: method, headers, body, queryStringParameters } = event;
    
    // CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
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
        console.log('데이터 로드 시작...');
        console.log('__dirname:', __dirname);
        
        // 직접 파일 경로 접근
        const dataPath = path.join(__dirname, '../../data/output_address.json');
        console.log('데이터 파일 경로:', dataPath);
        
        const data = await fs.readFile(dataPath, 'utf8');
        const jsonData = JSON.parse(data);
        
        console.log(`데이터 로드 완료: ${jsonData.length}개 항목`);
        
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify(jsonData)
        };
    } catch (error) {
        console.error('Error reading data:', error);
        console.error('Error stack:', error.stack);
        
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: '데이터를 불러올 수 없습니다.',
                details: error.message,
                path: path.join(__dirname, '../../data/output_address.json')
            })
        };
    }
};