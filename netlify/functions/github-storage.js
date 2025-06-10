// GitHub 저장소 연동 모듈
const { Octokit } = require('@octokit/rest');

class GitHubStorage {
    constructor() {
        this.octokit = new Octokit({
            auth: process.env.GITHUB_TOKEN
        });
        
        // 저장소 정보 (환경변수에서 가져오거나 기본값 사용)
        this.owner = process.env.GITHUB_OWNER || 'superae99';
        this.repo = process.env.GITHUB_REPO || 'Map';
        this.branch = process.env.GITHUB_BRANCH || 'main';
        this.dataPath = 'public/data.json';
    }

    // 현재 파일의 SHA 값 가져오기
    async getFileSha() {
        try {
            const response = await this.octokit.rest.repos.getContent({
                owner: this.owner,
                repo: this.repo,
                path: this.dataPath,
                ref: this.branch
            });
            return response.data.sha;
        } catch (error) {
            console.error('파일 SHA 조회 실패:', error.message);
            throw new Error('GitHub에서 파일 정보를 가져올 수 없습니다.');
        }
    }

    // 데이터 읽기
    async getData() {
        try {
            const response = await this.octokit.rest.repos.getContent({
                owner: this.owner,
                repo: this.repo,
                path: this.dataPath,
                ref: this.branch
            });

            const content = Buffer.from(response.data.content, 'base64').toString('utf8');
            const data = JSON.parse(content);
            
            console.log(`GitHub에서 ${data.length}개 데이터 로드 완료`);
            return {
                data,
                sha: response.data.sha
            };
        } catch (error) {
            console.error('GitHub 데이터 로드 실패:', error.message);
            throw new Error('GitHub에서 데이터를 읽을 수 없습니다.');
        }
    }

    // 데이터 저장
    async updateData(jsonData, commitMessage = 'Update data via Netlify Function') {
        try {
            // 현재 파일의 SHA 값 가져오기
            const currentSha = await this.getFileSha();
            
            // JSON 데이터를 문자열로 변환
            const content = JSON.stringify(jsonData, null, 2);
            
            // Base64 인코딩
            const encodedContent = Buffer.from(content, 'utf8').toString('base64');
            
            // GitHub에 커밋
            const response = await this.octokit.rest.repos.createOrUpdateFileContents({
                owner: this.owner,
                repo: this.repo,
                path: this.dataPath,
                message: commitMessage,
                content: encodedContent,
                sha: currentSha,
                branch: this.branch
            });
            
            console.log('GitHub 저장 완료:', response.data.commit.sha);
            return {
                success: true,
                commit: response.data.commit.sha,
                message: commitMessage
            };
            
        } catch (error) {
            console.error('GitHub 저장 실패:', error.message);
            throw new Error(`GitHub 저장 실패: ${error.message}`);
        }
    }

    // 연결 테스트
    async testConnection() {
        try {
            const response = await this.octokit.rest.repos.get({
                owner: this.owner,
                repo: this.repo
            });
            
            return {
                connected: true,
                repo: response.data.full_name,
                private: response.data.private
            };
        } catch (error) {
            console.error('GitHub 연결 테스트 실패:', error.message);
            return {
                connected: false,
                error: error.message
            };
        }
    }
}

module.exports = GitHubStorage;