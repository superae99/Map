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
        res.status(200).json(jsonData);
    } catch (error) {
        console.error('Error reading data:', error);
        res.status(500).json({ 
            success: false, 
            error: '데이터를 불러올 수 없습니다.',
            details: error.message
        });
    }
};