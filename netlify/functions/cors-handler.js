// Shared CORS handling utility - No external dependencies

// Basic CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
};

// Handle CORS preflight
function handleCors() {
    return {
        statusCode: 200,
        headers: corsHeaders,
        body: ''
    };
}

// Add CORS headers to response
function addCorsHeaders(response) {
    return {
        ...response,
        headers: {
            ...corsHeaders,
            ...(response.headers || {})
        }
    };
}

module.exports = {
    corsHeaders,
    handleCors,
    addCorsHeaders
};