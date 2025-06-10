// TopoJSON data endpoint
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
        // 기본 TopoJSON 데이터 (서울시 구경계 샘플)
        const topoJsonData = {
            "type": "Topology",
            "objects": {
                "seoul_districts": {
                    "type": "GeometryCollection",
                    "geometries": [
                        {
                            "type": "Polygon",
                            "properties": {
                                "name": "강남구",
                                "code": "11680"
                            },
                            "arcs": [[[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]]]
                        },
                        {
                            "type": "Polygon",
                            "properties": {
                                "name": "강동구",
                                "code": "11740"
                            },
                            "arcs": [[[16, 17, 18, 19, 20, 21, 22, 23, 24, 25]]]
                        }
                    ]
                }
            },
            "arcs": [
                // 강남구 경계 좌표 (간단한 사각형)
                [[127.0495, 37.5172], [127.0495, 37.4979], [127.0641, 37.4979], [127.0641, 37.5172], [127.0495, 37.5172]],
                // 강동구 경계 좌표 (간단한 사각형)
                [[127.1236, 37.5301], [127.1236, 37.5134], [127.1469, 37.5134], [127.1469, 37.5301], [127.1236, 37.5301]]
            ]
        };
        
        console.log('기본 TopoJSON 데이터 반환');
        
        return {
            statusCode: 200,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(topoJsonData)
        };
    } catch (error) {
        console.error('TopoJSON 데이터 오류:', error);
        
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: 'TopoJSON 데이터를 불러올 수 없습니다.',
                details: error.message
            })
        };
    }
};