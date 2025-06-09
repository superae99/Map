# 🚀 외부 서버 배포 가이드

## 📋 배포 옵션

### 1. **Vercel 배포 (추천 - 무료)**

#### 사전 준비
1. [Vercel 계정 생성](https://vercel.com)
2. [GitHub 계정](https://github.com) 필요

#### 배포 단계

**1단계: GitHub에 코드 업로드**
```bash
# Git 초기화
git init
git add .
git commit -m "Initial commit"

# GitHub 저장소 생성 후
git remote add origin https://github.com/your-username/sales-territory-map.git
git push -u origin main
```

**2단계: Vercel 배포**
```bash
# Vercel CLI 설치
npm i -g vercel

# 배포 (프로젝트 디렉토리에서)
vercel

# 환경 변수 설정
vercel env add NODE_ENV production
```

**3단계: app.js 수정**
```javascript
// app.js의 apiUrl을 실제 배포 URL로 변경
apiUrl = 'https://your-project.vercel.app/api/update-salesperson';
```

### 2. **Render.com 배포 (무료)**

**1단계: Render 계정 생성**
- [render.com](https://render.com) 가입

**2단계: 새 Web Service 생성**
1. Dashboard → New → Web Service
2. GitHub 저장소 연결
3. 설정:
   - Name: sales-territory-api
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `node server.prod.js`

**3단계: 환경 변수 설정**
- NODE_ENV = production
- PORT = 3000

### 3. **Railway 배포 (무료 크레딧)**

```bash
# Railway CLI 설치
npm i -g @railway/cli

# 로그인
railway login

# 프로젝트 생성 및 배포
railway init
railway up

# 환경 변수 설정
railway variables set NODE_ENV=production
```

### 4. **VPS 서버 직접 설정**

#### Ubuntu/Debian 서버

**1단계: 서버 접속 및 Node.js 설치**
```bash
# SSH 접속
ssh user@your-server-ip

# Node.js 18.x 설치
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Git 설치
sudo apt-get install git
```

**2단계: 프로젝트 설정**
```bash
# 프로젝트 클론
cd /var/www
sudo git clone https://github.com/your-username/sales-territory-map.git
cd sales-territory-map

# 의존성 설치
npm install

# 권한 설정
sudo chown -R www-data:www-data /var/www/sales-territory-map
```

**3단계: PM2로 프로세스 관리**
```bash
# PM2 설치
sudo npm install -g pm2

# 앱 시작
pm2 start server.prod.js --name sales-api

# 시스템 재부팅 시 자동 시작
pm2 startup systemd
pm2 save
```

**4단계: Nginx 리버스 프록시 설정**
```bash
# Nginx 설치
sudo apt-get install nginx

# 설정 파일 생성
sudo nano /etc/nginx/sites-available/sales-api
```

Nginx 설정:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# 설정 활성화
sudo ln -s /etc/nginx/sites-available/sales-api /etc/nginx/sites-enabled
sudo nginx -t
sudo systemctl restart nginx
```

**5단계: SSL 인증서 (HTTPS)**
```bash
# Certbot 설치
sudo apt-get install certbot python3-certbot-nginx

# SSL 인증서 발급
sudo certbot --nginx -d your-domain.com
```

## 🔧 배포 후 설정

### 1. **환경 변수 (.env 파일)**
```env
NODE_ENV=production
PORT=3000
DATA_DIR=./data
BACKUP_DIR=./backups
```

### 2. **프론트엔드 API URL 수정**

`app.js`에서 실제 배포된 API URL로 변경:
```javascript
// 예시: Vercel 배포
apiUrl = 'https://sales-territory-api.vercel.app/api/update-salesperson';

// 예시: 자체 도메인
apiUrl = 'https://api.yourdomain.com/api/update-salesperson';
```

### 3. **데이터 파일 백업**
```bash
# 로컬 백업
scp -r user@server:/var/www/sales-territory-map/data ./backup/

# 자동 백업 스크립트
#!/bin/bash
tar -czf backup-$(date +%Y%m%d).tar.gz data/
```

## 📊 모니터링

### PM2 모니터링
```bash
# 상태 확인
pm2 status

# 로그 확인
pm2 logs sales-api

# 메모리/CPU 사용량
pm2 monit
```

### 서버 상태 확인
```bash
# API 상태
curl https://your-api.com/api/health

# 로그 확인
tail -f /var/log/nginx/access.log
```

## 🛡️ 보안 설정

### 1. **CORS 설정**
`server.prod.js`에서 허용 도메인 설정:
```javascript
app.use(cors({
    origin: ['https://test1sup.dothome.co.kr'],
    credentials: true
}));
```

### 2. **API 인증 (선택사항)**
```javascript
// 간단한 API 키 인증
const API_KEY = process.env.API_KEY;

app.use('/api/*', (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
});
```

### 3. **Rate Limiting**
```bash
npm install express-rate-limit
```

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15분
    max: 100 // 최대 100개 요청
});

app.use('/api/', limiter);
```

## 🔄 업데이트 방법

### Vercel/Render (자동)
- GitHub push 시 자동 배포

### VPS 서버 (수동)
```bash
# 서버 접속
ssh user@server

# 코드 업데이트
cd /var/www/sales-territory-map
git pull origin main
npm install

# 서버 재시작
pm2 restart sales-api
```

## ❓ 문제 해결

### 1. **CORS 오류**
- 서버의 CORS 설정에서 클라이언트 도메인 추가
- 프론트엔드와 백엔드 도메인 확인

### 2. **404 오류**
- API 경로 확인
- Nginx 프록시 설정 확인

### 3. **권한 오류**
```bash
# 파일 권한 수정
sudo chown -R www-data:www-data ./data
sudo chmod -R 755 ./data
```

## 📞 지원

배포 중 문제가 발생하면:
1. 서버 로그 확인
2. 브라우저 콘솔 확인
3. API health 엔드포인트 테스트

---

**💡 팁**: 처음에는 Vercel이나 Render 같은 무료 서비스로 시작하고, 트래픽이 늘어나면 VPS로 이전하는 것을 추천합니다!