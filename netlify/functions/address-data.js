// Get address data endpoint
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
        // ADDRESS_DATA: output_address.json 로드 (큰 파일이므로 샘플링)
        const dataPath = path.join(__dirname, 'output_address.json');
        const data = await fs.readFile(dataPath, 'utf8');
        const jsonData = JSON.parse(data);
        
        // 파일이 너무 크므로 첫 1000개 항목만 반환
        const sampleData = jsonData.slice(0, 1000);
        
        console.log(`주소 데이터 로드 완료: ${sampleData.length}개 항목 (전체 ${jsonData.length}개 중 샘플)`);
        
        return {
            statusCode: 200,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(sampleData)
        };
    } catch (error) {
        console.error('주소 데이터 로드 오류:', error);
        
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: '주소 데이터를 불러올 수 없습니다.',
                details: error.message
            })
        };
    }
};