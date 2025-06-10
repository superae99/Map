# Cloudways 배포 가이드

## 📦 배포 준비된 파일들

### 필수 파일들:
- `server.js` - Express 서버
- `package.json` - 의존성 및 스크립트
- `routes/` - API 라우터
- `api/` - API 핸들러들
- `public/` - 정적 파일들 (HTML, CSS, JS)
- `data/` - 데이터 파일들

## 🚀 Cloudways 배포 단계

### 1. Cloudways 서버 생성
- DigitalOcean/AWS/Google Cloud 선택
- Node.js 앱 생성
- 최소 1GB RAM 권장

### 2. 파일 업로드
```bash
# 전체 프로젝트 폴더를 Cloudways에 업로드
# FTP, Git, 또는 Cloudways 파일 매니저 사용
```

### 3. 의존성 설치
```bash
npm install
```

### 4. 환경변수 설정 (선택사항)
- GitHub API 사용 시 GITHUB_TOKEN 설정

### 5. 앱 시작
```bash
npm start
```

## 🌐 접속 확인
- `http://your-domain.com` - 메인 페이지
- `http://your-domain.com/api/health` - API 상태 확인

## 🔧 문제 해결
- 로그: `/logs` 폴더 확인
- 포트: 기본 3000 포트 사용
- 데이터: `/data` 폴더의 권한 확인