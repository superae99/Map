// TopoJSON data endpoint
const fs = require('fs').promises;
const path = require('path');

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
        // TOPO_DATA: HangJeongDong_ver20250401.json 로드
        const dataPath = path.join(__dirname, 'HangJeongDong_ver20250401.json');
        
        console.log('TopoJSON 파일 로드 시작...');
        
        // 파일 크기 확인
        const stats = await fs.stat(dataPath);
        console.log(`TopoJSON 파일 크기: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
        
        // 파일이 너무 크면 에러 반환
        if (stats.size > 5 * 1024 * 1024) { // 5MB 제한
            throw new Error(`파일이 너무 큽니다: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
        }
        
        const data = await fs.readFile(dataPath, 'utf8');
        const jsonData = JSON.parse(data);
        
        console.log('TopoJSON 데이터 로드 완료');
        
        return {
            statusCode: 200,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'Content-Encoding': 'identity'
            },
            body: JSON.stringify(jsonData)
        };
    } catch (error) {
        console.error('TopoJSON 데이터 오류:', error);
        
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: 'TopoJSON 데이터를 불러올 수 없습니다.',
                details: error.message,
                fileSize: error.message.includes('크기') ? error.message : undefined
            })
        };
    }
};