// Get store data endpoint with GitHub storage
const DataLoader = require('./data-loader');
const { setBasicCors } = require('./cors-handler');

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
        const { data: jsonData } = await DataLoader.loadData();
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify(jsonData)
        };
    } catch (error) {
        console.error('Error reading data:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                success: false,
                error: '데이터를 불러올 수 없습니다.',
                details: error.message
            })
        };
    }
};