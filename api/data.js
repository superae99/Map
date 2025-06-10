// Get store data endpoint with GitHub storage
const DataLoader = require('./data-loader');
const { setBasicCors } = require('./cors-handler');

module.exports = async (req, res) => {
    setBasicCors(res);
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { data: jsonData } = await DataLoader.loadData();
        const { type } = req.query;
        
        // 쿼리 매개변수에 따라 다른 데이터 형식 반환
        switch (type) {
            case 'sales':
                // 영업사원 데이터만 반환 (SALES_DATA 용도)
                res.status(200).json(jsonData);
                break;
                
            case 'topo':
                // 지역 경계 데이터 생성 (TOPO_DATA 용도)
                const topoData = generateTopoData(jsonData);
                res.status(200).json(topoData);
                break;
                
            case 'address':
            default:
                // 기본: 주소 데이터 반환 (ADDRESS_DATA 용도)
                res.status(200).json(jsonData);
                break;
        }
    } catch (error) {
        console.error('Error reading data:', error);
        res.status(500).json({ 
            success: false, 
            error: '데이터를 불러올 수 없습니다.',
            details: error.message
        });
    }
};

// TopoJSON 형태의 지역 경계 데이터 생성
function generateTopoData(salesData) {
    // 지역별로 그룹화
    const regions = {};
    
    salesData.forEach(item => {
        const region = item['시도명'] || item['지역'] || 'unknown';
        if (!regions[region]) {
            regions[region] = [];
        }
        regions[region].push(item);
    });
    
    // 간단한 TopoJSON 구조 생성
    return {
        type: "Topology",
        objects: {
            regions: {
                type: "GeometryCollection",
                geometries: Object.keys(regions).map(region => ({
                    type: "Feature",
                    properties: {
                        name: region,
                        count: regions[region].length
                    },
                    geometry: {
                        type: "Point",
                        coordinates: [126.9780, 37.5665] // 기본 좌표
                    }
                }))
            }
        }
    };
}