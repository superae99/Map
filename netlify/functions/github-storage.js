// GitHub 저장소 연동 모듈
const { Octokit } = require('@octokit/rest');

class GitHubStorage {
    constructor() {
        // 토큰 검증
        const token = process.env.GITHUB_TOKEN;
        if (!token) {
            throw new Error('GITHUB_TOKEN 환경변수가 설정되지 않았습니다.');
        }
        
        if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
            console.warn('토큰 형식이 올바르지 않을 수 있습니다. GitHub Personal Access Token을 확인하세요.');
        }
        
        this.octokit = new Octokit({
            auth: token,
            request: {
                timeout: 30000, // 30초 타임아웃
                retries: 0 // 자체 재시도 로직 사용
            }
        });
        
        // 저장소 정보 (환경변수에서 가져오거나 기본값 사용)
        this.owner = process.env.GITHUB_OWNER || 'superae99';
        this.repo = process.env.GITHUB_REPO || 'Map';
        this.branch = process.env.GITHUB_BRANCH || 'main';
        this.dataPath = 'public/data.json';
        
        console.log('GitHub Storage 초기화:', {
            owner: this.owner,
            repo: this.repo,
            branch: this.branch,
            dataPath: this.dataPath,
            tokenLength: token.length,
            tokenPrefix: token.substring(0, 8) + '...'
        });
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

    // 재시도 로직이 포함된 데이터 읽기
    async getData(retries = 3) {
        let lastError;
        
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                console.log(`GitHub 데이터 로드 시도 ${attempt}/${retries}`);
                
                const response = await Promise.race([
                    this.octokit.rest.repos.getContent({
                        owner: this.owner,
                        repo: this.repo,
                        path: this.dataPath,
                        ref: this.branch
                    }),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Request timeout')), 30000)
                    )
                ]);

                const content = Buffer.from(response.data.content, 'base64').toString('utf8');
                const data = JSON.parse(content);
                
                console.log(`GitHub에서 ${data.length}개 데이터 로드 완료 (시도 ${attempt})`);
                return {
                    data,
                    sha: response.data.sha
                };
            } catch (error) {
                lastError = error;
                console.error(`GitHub 데이터 로드 실패 (시도 ${attempt}/${retries}):`, {
                    message: error.message,
                    status: error.status,
                    code: error.code,
                    name: error.name
                });
                
                // 권한 문제나 404는 재시도하지 않음
                if (error.status === 403 || error.status === 404 || error.status === 401) {
                    console.error('권한 또는 리소스 문제로 재시도 중단');
                    break;
                }
                
                // 마지막 시도가 아니면 잠시 대기
                if (attempt < retries) {
                    const delay = Math.pow(2, attempt - 1) * 1000; // 지수 백오프
                    console.log(`${delay}ms 후 재시도...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        // 자세한 에러 정보 제공
        const errorInfo = {
            message: lastError.message,
            status: lastError.status,
            code: lastError.code,
            name: lastError.name,
            documentation_url: lastError.documentation_url
        };
        
        console.error('GitHub 데이터 로드 최종 실패:', errorInfo);
        throw new Error(`GitHub 데이터 로드 실패: ${JSON.stringify(errorInfo)}`);
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