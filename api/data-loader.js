// Shared data loading utility
const fs = require('fs').promises;
const path = require('path');
const GitHubStorage = require('./github-storage');

class DataLoader {
    static async loadData() {
        const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
        
        if (GITHUB_TOKEN) {
            const storage = new GitHubStorage();
            const result = await storage.getData();
            return { data: result.data, storage };
        } else {
            console.log('로컬 파일에서 데이터 로드 중...');
            const dataPath = path.join(process.cwd(), 'data', 'output_address.json');
            const data = await fs.readFile(dataPath, 'utf8');
            const jsonData = JSON.parse(data);
            console.log(`로컬 파일에서 ${jsonData.length}개 데이터 로드 완료`);
            return { data: jsonData, storage: null };
        }
    }

    static async saveData(jsonData, commitMessage = 'Update store data') {
        const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
        
        if (GITHUB_TOKEN) {
            const storage = new GitHubStorage();
            await storage.updateData(jsonData, commitMessage);
            return 'github';
        } else {
            console.log('로컬 파일에 데이터 저장 중...');
            const dataPath = path.join(process.cwd(), 'data', 'output_address.json');
            await fs.writeFile(dataPath, JSON.stringify(jsonData, null, 2), 'utf8');
            console.log('로컬 파일 저장 완료');
            return 'local';
        }
    }
}

module.exports = DataLoader;