// 데이터 로딩 테스트 스크립트
console.log('🧪 데이터 로딩 테스트 시작...');

// 1. 현재 환경 확인
console.group('📍 환경 정보');
console.log('현재 URL:', window.location.href);
console.log('호스트명:', window.location.hostname);
console.log('프로토콜:', window.location.protocol);
console.log('경로:', window.location.pathname);
console.groupEnd();

// 2. APP_CONFIG 확인
console.group('⚙️ APP_CONFIG 설정');
console.log('SALES_DATA 경로:', APP_CONFIG.DATA_PATHS.SALES_DATA);
console.log('TOPO_DATA 경로:', APP_CONFIG.DATA_PATHS.TOPO_DATA);
console.log('ADDRESS_DATA 경로:', APP_CONFIG.DATA_PATHS.ADDRESS_DATA);
console.groupEnd();

// 3. 각 데이터 경로 테스트
async function testDataLoading() {
    console.group('🔍 데이터 로딩 테스트');
    
    // Sales Data 테스트
    console.log('\n1️⃣ Sales Data 테스트...');
    try {
        const salesResponse = await fetch(APP_CONFIG.DATA_PATHS.SALES_DATA);
        console.log('Sales Data 상태:', salesResponse.status, salesResponse.statusText);
        if (salesResponse.ok) {
            const salesData = await salesResponse.json();
            console.log('✅ Sales Data 로드 성공');
            console.log('데이터 타입:', typeof salesData);
            console.log('데이터 구조:', {
                isArray: Array.isArray(salesData),
                hasData: salesData.data ? true : false,
                directLength: Array.isArray(salesData) ? salesData.length : 'N/A',
                dataLength: salesData.data ? salesData.data.length : 'N/A'
            });
            console.log('샘플 데이터:', salesData.data ? salesData.data[0] : salesData[0]);
        } else {
            console.error('❌ Sales Data 로드 실패:', salesResponse.status);
        }
    } catch (error) {
        console.error('❌ Sales Data 로드 오류:', error.message);
    }
    
    // Topo Data 테스트
    console.log('\n2️⃣ Topo Data 테스트...');
    try {
        const topoResponse = await fetch(APP_CONFIG.DATA_PATHS.TOPO_DATA);
        console.log('Topo Data 상태:', topoResponse.status, topoResponse.statusText);
        if (topoResponse.ok) {
            const topoData = await topoResponse.json();
            console.log('✅ Topo Data 로드 성공');
            console.log('TopoJSON 타입:', topoData.type);
            console.log('Objects:', Object.keys(topoData.objects || {}));
        } else {
            console.error('❌ Topo Data 로드 실패:', topoResponse.status);
        }
    } catch (error) {
        console.error('❌ Topo Data 로드 오류:', error.message);
    }
    
    // Address Data 테스트
    console.log('\n3️⃣ Address Data 테스트...');
    try {
        const addressResponse = await fetch(APP_CONFIG.DATA_PATHS.ADDRESS_DATA);
        console.log('Address Data 상태:', addressResponse.status, addressResponse.statusText);
        if (addressResponse.ok) {
            const addressData = await addressResponse.json();
            console.log('✅ Address Data 로드 성공');
            console.log('데이터 개수:', Array.isArray(addressData) ? addressData.length : 'N/A');
            console.log('샘플 데이터:', addressData[0]);
        } else {
            console.error('❌ Address Data 로드 실패:', addressResponse.status);
        }
    } catch (error) {
        console.error('❌ Address Data 로드 오류:', error.message);
    }
    
    console.groupEnd();
}

// 4. 대체 경로 테스트
async function testAlternativePaths() {
    console.group('🔄 대체 경로 테스트');
    
    const alternativePaths = [
        '/data/juso_output_file.json',
        'data/juso_output_file.json',
        '/public/data/juso_output_file.json',
        'public/data/juso_output_file.json',
        '/api/data',
        '/.netlify/functions/data'
    ];
    
    for (const path of alternativePaths) {
        try {
            console.log(`\n테스트: ${path}`);
            const response = await fetch(path);
            console.log(`상태: ${response.status} ${response.statusText}`);
            if (response.ok) {
                const contentType = response.headers.get('content-type');
                console.log(`✅ 성공! Content-Type: ${contentType}`);
                if (contentType && contentType.includes('application/json')) {
                    const data = await response.json();
                    console.log('데이터 구조:', {
                        type: typeof data,
                        isArray: Array.isArray(data),
                        length: Array.isArray(data) ? data.length : 'N/A',
                        hasData: data.data ? true : false
                    });
                }
            } else {
                console.log(`❌ 실패`);
            }
        } catch (error) {
            console.log(`❌ 오류: ${error.message}`);
        }
    }
    
    console.groupEnd();
}

// 5. 네트워크 요청 모니터링
console.group('📡 네트워크 모니터링');
console.log('개발자 도구의 Network 탭을 확인하여 실제 요청을 모니터링하세요.');
console.log('특히 다음을 확인하세요:');
console.log('- 요청 URL이 올바른지');
console.log('- 응답 상태 코드');
console.log('- 응답 헤더의 Content-Type');
console.log('- 응답 본문의 내용');
console.groupEnd();

// 테스트 실행
(async () => {
    await testDataLoading();
    await testAlternativePaths();
    
    console.log('\n🏁 테스트 완료!');
    console.log('문제가 발견되면 위의 로그를 참고하여 수정하세요.');
})();