# 🚀 Map 프로젝트 GitHub 설정 가이드

## 현재 상황
- 기존 remote가 airbnb-clone-frontend를 가리키고 있었음
- Map 프로젝트용 새 저장소 필요

## 🔧 해결 단계

### 1단계: GitHub에서 새 저장소 생성
1. https://github.com/superae99 접속
2. **New repository** 클릭
3. Repository name: `Map`
4. Description: `Korean Sales Territory Management System`
5. Public 또는 Private 선택
6. **Create repository** 클릭

### 2단계: Personal Access Token 생성 (아직 안했다면)
1. GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. **Generate new token (classic)**
3. Note: `Map Project Token`
4. Scopes: `repo` 체크
5. **Generate token** → 토큰 복사

### 3단계: 로컬에서 설정
```bash
cd /Users/rae/Documents/augment-projects/Map

# 현재 remote 확인 (이미 Map으로 변경됨)
git remote -v

# Personal Access Token으로 인증 설정
git config --global credential.helper store

# 데이터 파일 추가
git add .
git commit -m "Initial commit: Sales territory management system"

# 첫 푸시 (username과 token 입력 요구됨)
git push -u origin master
```

### 4단계: 인증 정보 입력
푸시할 때 다음과 같이 입력:
- **Username**: `superae99`
- **Password**: `생성한 Personal Access Token` (패스워드가 아님!)

### 5단계: Vercel 환경 변수 설정
```bash
vercel env add GITHUB_TOKEN
# → Personal Access Token 입력

vercel env add GITHUB_OWNER  
# → superae99

vercel env add GITHUB_REPO
# → Map
```

### 6단계: 재배포
```bash
vercel --prod
```

## ⚠️ 중요 사항
- GitHub 패스워드 인증은 2021년 8월부터 지원 중단
- 반드시 Personal Access Token 사용해야 함
- Token은 절대 공개하지 말 것
- 첫 푸시 후에는 자동으로 인증 정보가 저장됨

## 🎯 최종 확인
1. GitHub 저장소에 파일들이 업로드되었는지 확인
2. Vercel 환경 변수가 설정되었는지 확인
3. API 테스트: `curl https://your-app.vercel.app/api/data`