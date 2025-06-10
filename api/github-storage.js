// GitHub-based storage solution for large data files
const { Octokit } = require('@octokit/rest');

class GitHubStorage {
    constructor() {
        // 환경변수 확인 및 로깅
        const token = process.env.GITHUB_TOKEN;
        const owner = process.env.GITHUB_OWNER || 'superae99';
        const repo = process.env.GITHUB_REPO || 'Map';
        
        console.log('GitHub Storage 초기화:', {
            hasToken: !!token,
            owner: owner,
            repo: repo,
            tokenPrefix: token ? `${token.substring(0, 7)}...` : 'missing'
        });
        
        if (!token) {
            throw new Error('GITHUB_TOKEN 환경변수가 설정되지 않았습니다.');
        }
        
        this.octokit = new Octokit({
            auth: token
        });
        this.owner = owner;
        this.repo = repo;
        this.dataPath = 'data/output_address.json';
    }

    async getData() {
        try {
            console.log(`GitHub에서 데이터 로드 중... (${this.owner}/${this.repo}/${this.dataPath})`);
            
            const { data: fileData } = await this.octokit.repos.getContent({
                owner: this.owner,
                repo: this.repo,
                path: this.dataPath
            });

            console.log('GitHub API 응답 타입:', typeof fileData, Array.isArray(fileData));
            
            // 파일인지 확인
            if (Array.isArray(fileData)) {
                throw new Error(`${this.dataPath}는 디렉토리입니다. 파일을 지정해주세요.`);
            }
            
            if (fileData.type !== 'file') {
                throw new Error(`${this.dataPath}는 파일이 아닙니다. (타입: ${fileData.type})`);
            }

            const content = Buffer.from(fileData.content, 'base64').toString('utf8');
            const jsonData = JSON.parse(content);
            console.log(`GitHub에서 ${jsonData.length}개 데이터 로드 완료`);
            return { data: jsonData, sha: fileData.sha };
        } catch (error) {
            console.error('GitHub 데이터 로드 실패:', {
                message: error.message,
                status: error.status,
                name: error.name,
                owner: this.owner,
                repo: this.repo,
                path: this.dataPath
            });
            throw new Error(`GitHub 데이터 로드 실패: ${error.message}`);
        }
    }

    async updateData(jsonData, commitMessage = 'Update store data') {
        try {
            console.log('GitHub에 데이터 저장 중...');
            
            // 현재 파일의 SHA 가져오기
            const { data: currentFile } = await this.octokit.repos.getContent({
                owner: this.owner,
                repo: this.repo,
                path: this.dataPath
            });

            // 데이터 업데이트
            const content = Buffer.from(JSON.stringify(jsonData, null, 2)).toString('base64');
            
            await this.octokit.repos.createOrUpdateFileContents({
                owner: this.owner,
                repo: this.repo,
                path: this.dataPath,
                message: commitMessage,
                content: content,
                sha: currentFile.sha
            });

            console.log('GitHub 저장 완료');
            return true;
        } catch (error) {
            console.error('GitHub 데이터 저장 실패:', error.message);
            throw new Error('데이터 저장에 실패했습니다.');
        }
    }
}

module.exports = GitHubStorage;