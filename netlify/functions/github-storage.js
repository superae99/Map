// GitHub-based storage solution for large data files
const { Octokit } = require('@octokit/rest');

class GitHubStorage {
    constructor() {
        this.octokit = new Octokit({
            auth: process.env.GITHUB_TOKEN
        });
        this.owner = process.env.GITHUB_OWNER || 'your-username';
        this.repo = process.env.GITHUB_REPO || 'Map';
        this.dataPath = 'data/output_address.json';
    }

    async getData() {
        try {
            console.log('GitHub에서 데이터 로드 중...');
            const { data: fileData } = await this.octokit.repos.getContent({
                owner: this.owner,
                repo: this.repo,
                path: this.dataPath
            });

            const content = Buffer.from(fileData.content, 'base64').toString('utf8');
            const jsonData = JSON.parse(content);
            console.log(`GitHub에서 ${jsonData.length}개 데이터 로드 완료`);
            return { data: jsonData, sha: fileData.sha };
        } catch (error) {
            console.error('GitHub 데이터 로드 실패:', error.message);
            throw new Error('데이터를 불러올 수 없습니다.');
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