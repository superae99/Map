# 🗄️ 데이터 영속성 해결 방법

Vercel은 서버리스 환경이라 파일 시스템이 읽기 전용입니다. 데이터를 영구 저장하려면 외부 저장소가 필요합니다.

## 📋 옵션별 비교

| 옵션 | 난이도 | 비용 | 특징 |
|------|--------|------|------|
| **JSONBin** | ⭐ 쉬움 | 무료 (10,000 요청/월) | REST API로 JSON 저장 |
| **Supabase** | ⭐⭐ 보통 | 무료 (500MB) | PostgreSQL 데이터베이스 |
| **MongoDB Atlas** | ⭐⭐ 보통 | 무료 (512MB) | NoSQL 데이터베이스 |
| **Firebase** | ⭐⭐ 보통 | 무료 (1GB) | 실시간 데이터베이스 |
| **GitHub API** | ⭐ 쉬움 | 무료 | Git 저장소에 직접 커밋 |

## 🚀 방법 1: JSONBin (가장 쉬움)

### 1단계: JSONBin 계정 생성
1. [jsonbin.io](https://jsonbin.io) 접속
2. 무료 계정 생성
3. API Key 발급

### 2단계: 초기 데이터 업로드
```bash
# 데이터 업로드
curl -X POST https://api.jsonbin.io/v3/b \
  -H "Content-Type: application/json" \
  -H "X-Master-Key: YOUR_API_KEY" \
  -d @data/output_address.json

# 응답에서 BIN_ID 복사
```

### 3단계: API 수정

`api/update-salesperson.js` 수정:
```javascript
// JSONBin 설정
const BIN_ID = process.env.JSONBIN_BIN_ID;
const API_KEY = process.env.JSONBIN_API_KEY;

// 데이터 읽기
const response = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
    headers: { 'X-Master-Key': API_KEY }
});
const { record: jsonData } = await response.json();

// ... 데이터 수정 로직 ...

// 데이터 저장
await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
    method: 'PUT',
    headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': API_KEY
    },
    body: JSON.stringify(jsonData)
});
```

### 4단계: Vercel 환경 변수 설정
```bash
vercel env add JSONBIN_BIN_ID
vercel env add JSONBIN_API_KEY
```

## 🚀 방법 2: Supabase (더 확장 가능)

### 1단계: Supabase 프로젝트 생성
1. [supabase.com](https://supabase.com) 접속
2. 새 프로젝트 생성
3. 테이블 생성:

```sql
CREATE TABLE stores (
    id TEXT PRIMARY KEY,
    부문 TEXT,
    지사 TEXT,
    "지점/팀" TEXT,
    "담당 사번" INTEGER,
    "담당 영업사원" TEXT,
    거래처명 TEXT,
    "RTM 채널" TEXT,
    채널 TEXT,
    사업자번호 TEXT,
    "대표자성명(점주 성명)" TEXT,
    "우편번호(사업자기준)" TEXT,
    "기본주소(사업자기준)" TEXT,
    "상세주소(사업자기준)" TEXT,
    위도 FLOAT,
    경도 FLOAT,
    최종수정일시 TIMESTAMP DEFAULT NOW()
);
```

### 2단계: 데이터 마이그레이션
```javascript
// migrate-to-supabase.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// JSON 데이터 읽기
const data = JSON.parse(fs.readFileSync('./data/output_address.json'));

// Supabase에 삽입
for (const item of data) {
    const storeId = generateStoreId(item);
    await supabase.from('stores').upsert({
        id: storeId,
        ...item
    });
}
```

### 3단계: API 수정
```javascript
// api/update-salesperson.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

// 데이터 수정
const { error } = await supabase
    .from('stores')
    .update({
        '담당 사번': newSalesNumber,
        '담당 영업사원': newSalesperson,
        최종수정일시: new Date()
    })
    .eq('id', storeId);
```

## 🚀 방법 3: GitHub 저장소 사용 (무료 & 버전 관리)

### 1단계: GitHub Personal Access Token 생성
1. GitHub Settings → Developer settings → Personal access tokens
2. Generate new token (repo 권한 필요)

### 2단계: API 수정
```javascript
// api/update-salesperson.js
const { Octokit } = require('@octokit/rest');

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
});

// 현재 파일 가져오기
const { data: fileData } = await octokit.repos.getContent({
    owner: 'your-username',
    repo: 'your-repo',
    path: 'data/output_address.json'
});

// 데이터 수정
const content = Buffer.from(fileData.content, 'base64').toString();
const jsonData = JSON.parse(content);

// ... 수정 로직 ...

// 파일 업데이트 (자동 커밋)
await octokit.repos.createOrUpdateFileContents({
    owner: 'your-username',
    repo: 'your-repo',
    path: 'data/output_address.json',
    message: `Update salesperson: ${storeName}`,
    content: Buffer.from(JSON.stringify(jsonData, null, 2)).toString('base64'),
    sha: fileData.sha
});
```

## 🎯 추천 순서

1. **단기 해결**: JSONBin (5분 만에 설정 가능)
2. **중기 해결**: Supabase (더 많은 기능, 무료 티어 충분)
3. **장기 해결**: 자체 데이터베이스 서버

## 📝 JSONBin 즉시 적용 가이드

1. **JSONBin 계정 생성 후 BIN 생성**
2. **Vercel 환경 변수 추가**
   ```
   JSONBIN_BIN_ID=your-bin-id
   JSONBIN_API_KEY=your-api-key
   ```
3. **API 코드 수정** (다음 메시지에서 제공)
4. **재배포**

어떤 방법을 선택하시겠습니까?