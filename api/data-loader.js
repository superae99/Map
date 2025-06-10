// Shared data loading utility
const fs = require('fs').promises;
const path = require('path');
const GitHubStorage = require('./github-storage');

class DataLoader {
    static cache = null;
    static cacheTime = null;
    static CACHE_DURATION = 5 * 60 * 1000; // 5분 캐시

    static async loadData() {
        // 캐시 확인
        if (this.cache && this.cacheTime && 
            Date.now() - this.cacheTime < this.CACHE_DURATION) {
            console.log('캐시에서 데이터 로드');
            return this.cache;
        }

        // 원본에서 로드
        console.log('원본에서 데이터 로드 중...');
        const result = await this.loadFromSource();
        
        // 캐시 저장
        this.cache = result;
        this.cacheTime = Date.now();
        console.log('데이터 로드 및 캐시 저장 완료');
        
        return result;
    }

    static async loadFromSource() {
        const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
        
        // 1순위: GitHub API 시도 (환경변수가 있을 때)
        if (GITHUB_TOKEN) {
            try {
                console.log('GitHub API 시도 중...');
                const storage = new GitHubStorage();
                const result = await storage.getData();
                console.log('GitHub API 성공');
                return { data: result.data, storage };
            } catch (error) {
                console.warn('GitHub API 실패, 로컬 파일로 fallback:', error.message);
            }
        }
        
        // 2순위: 로컬/배포된 파일 사용
        try {
            console.log('로컬 파일에서 데이터 로드 중...');
            const dataPath = path.join(process.cwd(), 'data', 'output_address.json');
            const data = await fs.readFile(dataPath, 'utf8');
            const jsonData = JSON.parse(data);
            console.log(`로컬 파일에서 ${jsonData.length}개 데이터 로드 완료`);
            return { data: jsonData, storage: null };
        } catch (error) {
            console.error('로컬 파일 로드도 실패:', error.message);
            throw new Error('데이터를 로드할 수 없습니다. GitHub API와 로컬 파일 모두 실패했습니다.');
        }
    }

    static async saveData(jsonData, commitMessage = 'Update store data') {
        const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
        
        console.log('데이터 저장 시작 (Write-Through 캐싱)');
        
        // 1. 원본 저장
        let storageType;
        if (GITHUB_TOKEN) {
            const storage = new GitHubStorage();
            await storage.updateData(jsonData, commitMessage);
            storageType = 'github';
        } else {
            console.log('로컬 파일에 데이터 저장 중...');
            const dataPath = path.join(process.cwd(), 'data', 'output_address.json');
            await fs.writeFile(dataPath, JSON.stringify(jsonData, null, 2), 'utf8');
            storageType = 'local';
        }
        
        // 2. 캐시도 즉시 업데이트 (Write-Through)
        this.cache = { 
            data: jsonData, 
            storage: storageType === 'github' ? {} : null 
        };
        this.cacheTime = Date.now();
        
        console.log(`원본 저장(${storageType}) 및 캐시 업데이트 완료`);
        return storageType;
    }

    // 캐시 무효화 메서드 (필요시 사용)
    static invalidateCache() {
        this.cache = null;
        this.cacheTime = null;
        console.log('캐시 무효화됨');
    }
}

module.exports = DataLoader;