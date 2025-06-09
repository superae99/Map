# 영업 담당 상권 조회 시스템

실시간으로 담당자 정보를 수정하고 서버에 영구 저장할 수 있는 영업 상권 관리 시스템입니다.

## 🚀 새로운 기능: 백엔드 API 연동

이제 담당자 수정 시 **실제 JSON 파일이 서버에 저장**됩니다!

### ✅ 개선된 기능
- **영구 데이터 저장**: 페이지 새로고침 후에도 수정사항 유지
- **자동 백업**: 수정 시마다 자동으로 백업 파일 생성
- **수정 기록**: 모든 변경사항이 서버에 기록
- **실시간 동기화**: 프론트엔드와 백엔드 데이터 동기화

## 📋 시스템 구성

```
프론트엔드 (브라우저)  ←→  백엔드 API (Node.js)  ←→  JSON 파일 (데이터 저장)
      ↓                        ↓                      ↓
  - 지도 표시               - API 엔드포인트           - output_address.json (원본)
  - 필터링                 - 데이터 처리              - edit_history.json (수정기록)
  - 담당자 수정             - 백업 관리                - backups/ (자동백업)
```

## 🛠️ 설치 및 실행

### 1. 사전 요구사항
- Node.js (18.x 이상)
- npm

### 2. 설치
```bash
# 의존성 설치 (이미 완료됨)
npm install

# 백업 디렉토리 확인
ls -la backups/
```

### 3. 서버 실행
```bash
# 방법 1: 직접 실행
node server.js

# 방법 2: npm 스크립트 사용
npm start

# 방법 3: 개발 모드
npm run dev
```

### 4. 웹 애플리케이션 접속
브라우저에서 `http://localhost:3001` 접속

## 📡 API 엔드포인트

| 메서드 | 엔드포인트 | 설명 |
|--------|------------|------|
| GET | `/api/health` | 서버 상태 확인 |
| GET | `/api/data` | 거래처 데이터 조회 |
| GET | `/api/sales-data` | 영업사원 데이터 조회 |
| PUT | `/api/update-salesperson` | 담당자 정보 수정 |
| GET | `/api/edit-history` | 수정 기록 조회 |
| GET | `/api/backups` | 백업 파일 목록 |

### API 사용 예시

#### 담당자 수정
```bash
curl -X PUT http://localhost:3001/api/update-salesperson \
  -H "Content-Type: application/json" \
  -d '{
    "storeId": "STORE_12345",
    "newSalesNumber": "20240001",
    "newSalesperson": "홍길동",
    "editReason": "담당자 변경",
    "editNote": "부서 이동으로 인한 담당자 변경"
  }'
```

#### 수정 기록 조회
```bash
curl http://localhost:3001/api/edit-history?limit=10
```

## 📁 파일 구조

```
Map/
├── server.js                 # 백엔드 API 서버
├── package.json              # Node.js 의존성
├── app.js                    # 프론트엔드 메인 로직
├── index.html                # 웹 페이지
├── styles.css                # 스타일시트
├── data/
│   ├── output_address.json   # 거래처 데이터 (수정됨)
│   ├── juso_output_file.json # 영업사원 참조 데이터
│   └── edit_history.json     # 수정 기록 (새로 생성됨)
├── backups/                  # 자동 백업 파일들
│   ├── data_backup_2025-06-09T10-45-30-123Z.json
│   └── ...
└── README.md                 # 이 파일
```

## 🔄 데이터 플로우

### 수정 프로세스
1. **사용자 액션**: 웹에서 담당자 수정
2. **백업 생성**: 서버가 자동으로 원본 파일 백업
3. **데이터 수정**: JSON 파일의 실제 데이터 변경
4. **기록 저장**: 수정 기록을 별도 파일에 저장
5. **UI 동기화**: 프론트엔드에 변경사항 즉시 반영

### 백업 시스템
- **자동 백업**: 모든 수정 전 자동으로 백업 생성
- **타임스탬프**: 백업 파일명에 정확한 시간 기록
- **무제한 보관**: 모든 백업 파일 영구 보관

## 🛡️ 보안 및 안정성

### 데이터 안전성
- ✅ 자동 백업으로 데이터 손실 방지
- ✅ 수정 기록으로 모든 변경사항 추적
- ✅ 원자적 파일 쓰기로 데이터 무결성 보장
- ✅ 에러 발생 시 자동 롤백

### 로깅
- 모든 API 요청/응답 로깅
- 에러 발생 시 상세 로그 기록
- 수정 기록에 IP 주소 및 타임스탬프 포함

## 🔧 설정

### 환경 변수
```bash
PORT=3001                    # 서버 포트 (기본값: 3000)
NODE_ENV=development         # 환경 설정
```

### 파일 경로 설정
`server.js`에서 데이터 파일 경로 수정 가능:
```javascript
const DATA_FILE = './data/output_address.json';
const SALES_DATA_FILE = './data/juso_output_file.json';
const EDIT_HISTORY_FILE = './data/edit_history.json';
```

## 📊 모니터링

### 서버 상태 확인
```bash
curl http://localhost:3001/api/health
```

### 로그 확인
서버 콘솔에서 실시간 로그 확인:
- ✅ 수정 완료 로그
- 📝 백업 생성 로그  
- ❌ 에러 로그

## 🚨 문제 해결

### 일반적인 문제

1. **포트 충돌**
   ```bash
   # 다른 포트로 실행
   PORT=3002 node server.js
   ```

2. **파일 권한 오류**
   ```bash
   # 권한 확인
   ls -la data/
   chmod 644 data/*.json
   ```

3. **백엔드 연결 실패**
   - 서버가 실행 중인지 확인
   - 포트 번호가 올바른지 확인
   - 방화벽 설정 확인

### 데이터 복구

백업에서 데이터 복구:
```bash
# 백업 파일 목록 확인
ls -la backups/

# 특정 백업으로 복구
cp backups/data_backup_2025-06-09T10-45-30-123Z.json data/output_address.json
```

## 📈 향후 개선 계획

- [ ] 사용자 인증 시스템
- [ ] 권한 기반 접근 제어
- [ ] 실시간 알림 시스템
- [ ] 데이터베이스 연동
- [ ] 웹소켓 기반 실시간 동기화
- [ ] RESTful API 완성

---

**🎉 이제 담당자 수정이 실제 파일에 저장됩니다!**

페이지를 새로고침해도 수정사항이 유지되며, 모든 변경사항이 안전하게 백업됩니다.