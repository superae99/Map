// Simple test endpoint
exports.handler = async (event, context) => {
    // CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: ''
        };
    }
    
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
    
    try {
        // 테스트용 더미 데이터 반환
        const testData = [
            {
                "거래처명": "테스트 거래처",
                "담당 영업사원": "테스트 담당자",
                "담당 사번": 12345,
                "기본주소(사업자기준)": "서울특별시 강남구",
                "RTM채널": "업소",
                "위도": 37.5665,
                "경도": 126.9780
            }
        ];
        
        return {
            statusCode: 200,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testData)
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: 'Server error',
                details: error.message
            })
        };
    }
};