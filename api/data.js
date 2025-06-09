// Get store data endpoint with GitHub storage
const fs = require('fs').promises;
const path = require('path');
const GitHubStorage = require('./github-storage');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        // GitHub 설정 (환경 변수 사용)
        const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
        
        let jsonData;
        
        // GitHub 사용 여부 확인 (프로덕션 환경)
        if (GITHUB_TOKEN) {
            const storage = new GitHubStorage();
            const result = await storage.getData();
            jsonData = result.data;
        } else {
            // 로컬 파일에서 데이터 읽기 (개발 환경)
            console.log('로컬 파일에서 데이터 로드 중...');
            const dataPath = path.join(process.cwd(), 'data', 'output_address.json');
            const data = await fs.readFile(dataPath, 'utf8');
            jsonData = JSON.parse(data);
            console.log(`로컬 파일에서 ${jsonData.length}개 데이터 로드 완료`);
        }
        
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