// Shared data loading utility
const fs = require('fs').promises;
const path = require('path');
const GitHubStorage = require('./github-storage');

class DataLoader {
    static async loadData() {
        const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
        
        if (GITHUB_TOKEN) {
            try {
                const storage = new GitHubStorage();
                const result = await storage.getData();
                return { data: result.data, storage };
            } catch (error) {
                console.log('GitHub 로드 실패, 로컬 파일로 폴백:', error.message);
                // GitHub 실패시 로컬 파일로 폴백
            }
        }
        
        // 로컬 파일 로드 (Netlify Functions 환경 고려)
        console.log('로컬 파일에서 데이터 로드 중...');
        try {
            // Netlify Functions에서는 상대 경로 사용
            const dataPath = path.join(__dirname, '../../data/output_address.json');
            console.log('데이터 파일 경로:', dataPath);
            const data = await fs.readFile(dataPath, 'utf8');
            const jsonData = JSON.parse(data);
            console.log(`로컬 파일에서 ${jsonData.length}개 데이터 로드 완료`);
            return { data: jsonData, storage: null };
        } catch (error) {
            console.error('로컬 파일 로드 실패:', error.message);
            throw new Error('데이터 파일을 찾을 수 없습니다.');
        }
    }

    static async saveData(jsonData, commitMessage = 'Update store data') {
        const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
        
        if (GITHUB_TOKEN) {
            try {
                const storage = new GitHubStorage();
                await storage.updateData(jsonData, commitMessage);
                return 'github';
            } catch (error) {
                console.log('GitHub 저장 실패:', error.message);
                throw new Error('데이터 저장에 실패했습니다.');
            }
        } else {
            // Netlify Functions에서는 파일 쓰기가 제한됨
            console.log('GitHub 환경변수가 설정되지 않음 - 읽기 전용 모드');
            throw new Error('데이터 수정을 위해서는 GitHub 연동이 필요합니다.');
        }
    }
}

module.exports = DataLoader;