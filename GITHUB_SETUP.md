# 🚀 GitHub Storage 설정 가이드

JSONBin 413 오류를 해결하기 위해 GitHub를 데이터 저장소로 사용합니다.

## 📋 설정 단계

### 1단계: GitHub Personal Access Token 생성

1. **GitHub 계정으로 로그인**
2. **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
3. **Generate new token (classic)** 클릭
4. **Token 설정**:
   - Note: `Map Project API Token`
   - Expiration: `No expiration` (또는 원하는 기간)
   - Scopes: `repo` 체크 (전체 저장소 접근 권한)
5. **Generate token** 클릭
6. **토큰 복사** (한 번만 표시되므로 안전한 곳에 저장)

### 2단계: Vercel 환경 변수 설정

```bash
# Vercel CLI 사용
vercel env add GITHUB_TOKEN
# 복사한 GitHub token 입력

vercel env add GITHUB_OWNER
# GitHub 사용자명 입력 (예: your-username)

vercel env add GITHUB_REPO
# 저장소 이름 입력 (예: Map)
```

또는 **Vercel 대시보드**에서 설정:
1. [Vercel Dashboard](https://vercel.com/dashboard)
2. 프로젝트 선택
3. **Settings** → **Environment Variables**
4. 다음 변수들 추가:
   - `GITHUB_TOKEN`: GitHub Personal Access Token
   - `GITHUB_OWNER`: GitHub 사용자명
   - `GITHUB_REPO`: 저장소 이름 (Map)

### 3단계: GitHub 인증 설정 및 데이터 업로드

#### 방법 1: Git Credential Manager 사용 (권장)
```bash
# GitHub Personal Access Token으로 인증
git config --global credential.helper store

# 첫 번째 push 시 username과 token 입력 요구됨
# Username: your-github-username
# Password: your-personal-access-token (위에서 생성한 토큰)
```

#### 방법 2: SSH 키 사용 (선택사항)
```bash
# SSH 키 생성 (이미 있다면 생략)
ssh-keygen -t ed25519 -C "your-email@example.com"

# SSH 키를 GitHub에 추가
cat ~/.ssh/id_ed25519.pub
# 출력된 키를 GitHub Settings → SSH and GPG keys에 추가

# 원격 저장소 URL을 SSH로 변경
git remote set-url origin git@github.com:your-username/Map.git
```

#### 데이터 파일 업로드
```bash
# 현재 디렉토리가 Map 프로젝트인지 확인
pwd
# /Users/rae/Documents/augment-projects/Map 이어야 함

# Git 저장소 초기화 (필요한 경우)
git init
git remote add origin https://github.com/your-username/Map.git

# 데이터 파일 추가
git add data/output_address.json
git commit -m "Add initial store data"

# 메인 브랜치 설정 및 푸시
git branch -M main
git push -u origin main
```

### 4단계: 재배포

```bash
# 변경사항 배포
git add .
git commit -m "Implement GitHub storage for data persistence"
git push origin master

# Vercel 자동 배포 확인
vercel --prod
```

## ✅ 테스트 방법

1. **데이터 로드 테스트**:
   ```bash
   curl https://your-vercel-app.vercel.app/api/data
   ```

2. **담당자 수정 테스트**:
   ```bash
   curl -X PUT https://your-vercel-app.vercel.app/api/update-salesperson \
     -H "Content-Type: application/json" \
     -d '{
       "storeId": "STORE_123",
       "newSalesNumber": "999",
       "newSalesperson": "테스트 담당자"
     }'
   ```

3. **GitHub 저장소에서 커밋 확인**:
   - GitHub 저장소 → **Commits** 탭에서 자동 커밋 확인

## 🔧 장점

- **대용량 파일 지원**: 37MB 데이터 파일도 문제없음
- **버전 관리**: 모든 변경사항이 Git 히스토리에 기록
- **무료**: GitHub의 무료 계정으로 충분
- **신뢰성**: GitHub의 안정적인 인프라 사용
- **투명성**: 모든 데이터 변경사항을 추적 가능

## 🚨 주의사항

- GitHub token은 절대 공개하지 말 것
- token에는 `repo` 권한만 부여
- 프로덕션 환경에서만 GitHub 사용 (로컬은 파일 시스템)

## 📈 모니터링

- **Vercel 함수 로그**: [Vercel Dashboard](https://vercel.com/dashboard) → Functions
- **GitHub 커밋**: 저장소의 Commits 탭
- **API 응답**: `storage: "github"` 확인