// ===================================
// 완전한 영업 담당 상권 조회 시스템
// 기본 기능 + 담당자 수정 기능 통합
// ===================================

// 앱 설정 (config.js가 없을 경우 기본값)
const APP_CONFIG = {
    DATA_PATHS: {
        SALES_DATA: './data/juso_output_file.json',
        TOPO_DATA: './data/HangJeongDong_ver20250401.json',
        ADDRESS_DATA: './data/output_address.json'
    },
    MAP_CONFIG: {
        CENTER_LAT: 37.5665,
        CENTER_LNG: 126.9780,
        INITIAL_LEVEL: 8
    },
    COLOR_GENERATION: {
        HUE_STEPS: 72,
        SATURATION_LEVELS: [60, 70, 80, 90],
        LIGHTNESS_LEVELS: [40, 50, 60, 70],
    },
    TOPOJSON_CONFIG: {
        LAYER_KEY: null
    },
    RTM_MARKER_CONFIG: {
        '업소': {
            shape: 'square',
            size: new kakao.maps.Size(24, 24),
            offset: new kakao.maps.Point(12, 24)
        },
        '매장': {
            shape: 'circle', 
            size: new kakao.maps.Size(24, 24),
            offset: new kakao.maps.Point(12, 24)
        },
        'default': {
            shape: 'diamond',
            size: new kakao.maps.Size(26, 26),
            offset: new kakao.maps.Point(13, 26)
        }
    }
};

// ===============================
// 유틸리티 클래스들
// ===============================

// 에러 처리 강화 - 재시도 로직
async function loadDataWithRetry(url, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            lastError = error;
            console.warn(`데이터 로드 실패 (시도 ${attempt}/${maxRetries}):`, error.message);
            
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
            }
        }
    }
    
    throw lastError;
}

// 메모리 리크 방지를 위한 이벤트 리스너 관리
class EventManager {
    constructor() {
        this.listeners = [];
    }
    
    addEventListener(element, event, handler) {
        element.addEventListener(event, handler);
        this.listeners.push({ element, event, handler });
    }
    
    removeAllListeners() {
        this.listeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this.listeners = [];
    }
}

// 성능 모니터링 유틸리티
function withPerformanceTracking(functionName, fn) {
    return function(...args) {
        const startTime = performance.now();
        
        try {
            const result = fn.apply(this, args);
            
            if (result && typeof result.then === 'function') {
                return result.finally(() => {
                    const endTime = performance.now();
                    console.log(`⏱️ ${functionName}: ${(endTime - startTime).toFixed(2)}ms`);
                });
            }
            
            const endTime = performance.now();
            console.log(`⏱️ ${functionName}: ${(endTime - startTime).toFixed(2)}ms`);
            return result;
            
        } catch (error) {
            const endTime = performance.now();
            console.error(`❌ ${functionName} 실패 (${(endTime - startTime).toFixed(2)}ms):`, error);
            throw error;
        }
    };
}

// 사용자 설정 관리
class UserPreferences {
    constructor() {
        this.storageKey = 'salesMapPreferences';
    }
    
    save(preferences) {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(preferences));
        } catch (error) {
            console.warn('사용자 설정 저장 실패:', error);
        }
    }
    
    load() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            return saved ? JSON.parse(saved) : {};
        } catch (error) {
            console.warn('사용자 설정 로드 실패:', error);
            return {};
        }
    }
    
    clear() {
        try {
            localStorage.removeItem(this.storageKey);
        } catch (error) {
            console.warn('사용자 설정 삭제 실패:', error);
        }
    }
}

// 알림 시스템
class NotificationManager {
    constructor() {
        this.notifications = [];
        this.container = this.createContainer();
    }

    createContainer() {
        const container = document.createElement('div');
        container.className = 'notification-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(container);
        return container;
    }

    show(message, type = 'info', duration = 5000) {
        const notification = this.createNotification(message, type);
        this.container.appendChild(notification);
        this.notifications.push(notification);

        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
            notification.style.opacity = '1';
        }, 10);

        if (duration > 0) {
            setTimeout(() => {
                this.remove(notification);
            }, duration);
        }

        return notification;
    }

    createNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        const colors = {
            success: '#27ae60',
            error: '#e74c3c',
            warning: '#f39c12',
            info: '#3498db'
        };

        notification.style.cssText = `
            background: ${colors[type] || colors.info};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            transform: translateX(100%);
            opacity: 0;
            transition: all 0.3s ease;
            max-width: 350px;
            word-wrap: break-word;
            cursor: pointer;
        `;

        const icon = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        notification.innerHTML = `
            <div style="display: flex; align-items: flex-start; gap: 10px;">
                <span style="font-size: 16px;">${icon[type] || icon.info}</span>
                <div style="flex: 1;">
                    <div style="font-weight: 600; margin-bottom: 5px;">${type.toUpperCase()}</div>
                    <div style="font-size: 14px; line-height: 1.4;">${message}</div>
                </div>
                <button style="
                    background: none; 
                    border: none; 
                    color: white; 
                    font-size: 18px; 
                    cursor: pointer; 
                    padding: 0; 
                    width: 20px; 
                    height: 20px;
                    opacity: 0.7;
                " onclick="this.parentElement.parentElement.click()">×</button>
            </div>
        `;

        notification.addEventListener('click', () => {
            this.remove(notification);
        });

        return notification;
    }

    remove(notification) {
        notification.style.transform = 'translateX(100%)';
        notification.style.opacity = '0';
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.parentElement.removeChild(notification);
            }
            this.notifications = this.notifications.filter(n => n !== notification);
        }, 300);
    }

    success(message, duration = 5000) {
        return this.show(message, 'success', duration);
    }

    error(message, duration = 7000) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration = 6000) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration = 5000) {
        return this.show(message, 'info', duration);
    }
}

// 데이터 검증 및 정규화 함수들
function normalizeValue(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function validateData(data, schema) {
    const errors = [];
    
    if (!Array.isArray(data)) {
        errors.push('데이터가 배열 형태가 아닙니다.');
        return { isValid: false, errors };
    }
    
    data.forEach((item, index) => {
        Object.keys(schema).forEach(field => {
            const rule = schema[field];
            const value = item[field];
            
            if (rule.required && (value === undefined || value === null || value === '')) {
                errors.push(`항목 ${index + 1}: ${field} 필드가 필수입니다.`);
            }
            
            if (value !== undefined && value !== null && value !== '' && rule.type) {
                const actualType = typeof value;
                if (actualType !== rule.type) {
                    errors.push(`항목 ${index + 1}: ${field} 필드 타입이 올바르지 않습니다. (기대값: ${rule.type}, 실제값: ${actualType})`);
                }
            }
            
            if (value && rule.pattern && !rule.pattern.test(value)) {
                errors.push(`항목 ${index + 1}: ${field} 필드 형식이 올바르지 않습니다.`);
            }
        });
    });
    
    if (errors.length > 10) {
        const truncatedErrors = errors.slice(0, 10);
        truncatedErrors.push(`... 외 ${errors.length - 10}개의 추가 오류`);
        return {
            isValid: false,
            errors: truncatedErrors,
            totalErrors: errors.length
        };
    }
    
    return {
        isValid: errors.length === 0,
        errors,
        totalErrors: errors.length
    };
}

// 색상 관련 함수들
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

function getRelativeLuminance(color) {
    const rgb = color.startsWith('#') ? hexToRgb(color) : color.match(/\d+/g);
    if (!rgb) return 0;
    
    const [r, g, b] = Array.isArray(rgb) ? rgb.map(Number) : [rgb.r, rgb.g, rgb.b];
    
    const [rs, gs, bs] = [r, g, b].map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function calculateContrastRatio(color1, color2) {
    const luminance1 = getRelativeLuminance(color1);
    const luminance2 = getRelativeLuminance(color2);
    
    const lighter = Math.max(luminance1, luminance2);
    const darker = Math.min(luminance1, luminance2);
    
    return (lighter + 0.05) / (darker + 0.05);
}

// 마커 생성 함수들
function createMarkerSVG(shape, color, size = 24) {
    const strokeColor = '#ffffff';
    const strokeWidth = 2;
    
    let svgContent = '';
    
    switch(shape) {
        case 'square':
            svgContent = `
                <rect x="2" y="2" width="${size-4}" height="${size-4}" 
                      fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}" rx="2"/>
            `;
            break;
        case 'circle':
            svgContent = `
                <circle cx="${size/2}" cy="${size/2}" r="${(size-4)/2}" 
                        fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
            `;
            break;
        case 'diamond':
        default:
            svgContent = `
                <path d="M${size/2} 2 L${size-2} ${size/2} L${size/2} ${size-2} L2 ${size/2} Z" 
                      fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
            `;
            break;
    }
    
    const svg = `
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" 
             xmlns="http://www.w3.org/2000/svg">
            ${svgContent}
        </svg>
    `;
    
    return 'data:image/svg+xml;base64,' + btoa(svg);
}

function createMarkerImage(rtmChannel, salesperson) {
    const config = APP_CONFIG.RTM_MARKER_CONFIG[rtmChannel] || APP_CONFIG.RTM_MARKER_CONFIG.default;
    const color = getAccessibleSalespersonColor(salesperson);
    
    const svgSrc = createMarkerSVG(config.shape, color, config.size.width);
    
    return new kakao.maps.MarkerImage(
        svgSrc,
        config.size,
        { offset: config.offset }
    );
}

// ===============================
// 담당자 수정 기능 클래스
// ===============================

class SalespersonEditManager {
    constructor() {
        this.isEditMode = false;
        this.currentEditingItem = null;
        this.editHistory = [];
        this.maxHistoryLength = 50;
        this.validSalespeople = new Set();
        this.validSalesNumbers = new Set();
        this.isUpdating = false; // 순환 호출 방지 플래그
        
        this.initializeValidData();
        this.setupEditModal();
    }

    initializeValidData() {
        if (appData.salesData && appData.salesData.length > 0) {
            appData.salesData.forEach(sales => {
                if (sales['담당 영업사원'] && sales['담당 사번']) {
                    this.validSalespeople.add(sales['담당 영업사원']);
                    this.validSalesNumbers.add(String(sales['담당 사번']));
                }
            });
        }
        console.log(`유효한 담당자: ${this.validSalespeople.size}명, 사번: ${this.validSalesNumbers.size}개`);
    }

    setupEditModal() {
        const modal = document.createElement('div');
        modal.id = 'salespersonEditModal';
        modal.className = 'modal salesperson-edit-modal';
        modal.style.display = 'none';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-labelledby', 'editModalTitle');
        modal.setAttribute('aria-hidden', 'true');

        modal.innerHTML = `
            <div class="modal-content edit-modal-content">
                <div class="modal-header">
                    <h3 id="editModalTitle">✏️ 담당자 정보 수정</h3>
                    <button class="btn-close" onclick="salespersonEditManager.closeEditModal()" aria-label="모달 닫기">&times;</button>
                </div>
                
                <div class="modal-body">
                    <div class="edit-section">
                        <h4>🏪 거래처 정보</h4>
                        <div class="info-display">
                            <div class="info-item">
                                <label>거래처코드:</label>
                                <span id="editStoreCode" class="info-value" style="font-family: monospace; font-size: 12px; color: #667eea;"></span>
                            </div>
                            <div class="info-item">
                                <label>거래처명:</label>
                                <span id="editStoreName" class="info-value"></span>
                            </div>
                            <div class="info-item">
                                <label>사업자번호:</label>
                                <span id="editBusinessNumber" class="info-value"></span>
                            </div>
                            <div class="info-item">
                                <label>주소:</label>
                                <span id="editStoreAddress" class="info-value"></span>
                            </div>
                            <div class="info-item">
                                <label>RTM 채널:</label>
                                <span id="editRtmChannel" class="info-value"></span>
                            </div>
                        </div>
                    </div>

                    <div class="edit-section">
                        <h4>👤 현재 담당자 정보</h4>
                        <div class="current-info">
                            <div class="current-item">
                                <label>현재 담당 사번:</label>
                                <span id="currentSalesNumber" class="current-value"></span>
                            </div>
                            <div class="current-item">
                                <label>현재 담당 영업사원:</label>
                                <span id="currentSalesperson" class="current-value"></span>
                            </div>
                            <div class="current-item">
                                <label>현재 지사/지점:</label>
                                <span id="currentBranchInfo" class="current-value"></span>
                            </div>
                        </div>
                    </div>

                    <div class="edit-section">
                        <h4>✏️ 새로운 담당자 정보</h4>
                        <div class="edit-form">
                            <div class="form-group">
                                <label for="newSalesNumber">담당 사번 <span class="required">*</span></label>
                                <div class="input-with-validation">
                                    <input 
                                        type="text" 
                                        id="newSalesNumber" 
                                        class="form-input" 
                                        placeholder="담당 사번 입력"
                                        autocomplete="off"
                                    >
                                    <div class="validation-feedback" id="salesNumberFeedback"></div>
                                </div>
                                <div class="input-suggestions" id="salesNumberSuggestions"></div>
                            </div>

                            <div class="form-group">
                                <label for="newSalespersonDropdown">담당 영업사원 <span class="required">*</span></label>
                                <div class="input-with-validation">
                                    <div class="custom-dropdown" id="newSalespersonDropdown">
                                        <button type="button" class="dropdown-button" aria-expanded="false" aria-haspopup="true">
                                            <span>- 담당자 선택 -</span>
                                            <span class="dropdown-arrow">▼</span>
                                        </button>
                                        <div class="dropdown-content" role="listbox" aria-label="담당자 선택">
                                            <!-- 라디오 버튼 항목들이 JavaScript로 동적 생성됩니다 -->
                                        </div>
                                    </div>
                                    <div class="validation-feedback" id="salespersonFeedback"></div>
                                </div>
                            </div>

                            <div class="auto-match-info" id="autoMatchInfo" style="display: none;">
                                <h5>🔍 자동 매칭된 정보</h5>
                                <div class="match-details" id="matchDetails"></div>
                            </div>

                            <div class="form-group">
                                <label for="editReason">수정 사유</label>
                                <select id="editReason" class="form-select">
                                    <option value="">선택하세요</option>
                                    <option value="담당자 변경">담당자 변경</option>
                                    <option value="조직 개편">조직 개편</option>
                                    <option value="데이터 오류 수정">데이터 오류 수정</option>
                                    <option value="신규 담당자 배정">신규 담당자 배정</option>
                                    <option value="기타">기타</option>
                                </select>
                            </div>

                            <div class="form-group">
                                <label for="editNote">상세 메모 (선택)</label>
                                <textarea 
                                    id="editNote" 
                                    class="form-textarea" 
                                    rows="3" 
                                    placeholder="수정 관련 추가 정보를 입력하세요"
                                ></textarea>
                            </div>
                        </div>
                    </div>

                    <div class="edit-section preview-section" id="previewSection" style="display: none;">
                        <h4>👀 변경 사항 미리보기</h4>
                        <div class="preview-comparison">
                            <div class="before-after">
                                <div class="before">
                                    <h5>변경 전</h5>
                                    <div id="beforePreview"></div>
                                </div>
                                <div class="arrow">→</div>
                                <div class="after">
                                    <h5>변경 후</h5>
                                    <div id="afterPreview"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="salespersonEditManager.closeEditModal()">
                        취소
                    </button>
                    <button type="button" class="btn btn-outline" onclick="salespersonEditManager.resetForm()">
                        초기화
                    </button>
                    <button type="button" class="btn btn-primary" id="saveEditBtn" onclick="salespersonEditManager.saveEdit()" disabled>
                        💾 저장
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.setupEditEventListeners();
    }

    setupEditEventListeners() {
        const salesNumberInput = document.getElementById('newSalesNumber');
        const salespersonDropdown = document.getElementById('newSalespersonDropdown');

        salesNumberInput.addEventListener('input', () => {
            this.validateSalesNumber();
            this.showSalesNumberSuggestions();
            this.updatePreview();
        });

        // 드롭다운 클릭 이벤트
        if (salespersonDropdown) {
            const dropdownButton = salespersonDropdown.querySelector('.dropdown-button');
            dropdownButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleSalespersonDropdown();
            });

            // 외부 클릭시 드롭다운 닫기
            document.addEventListener('click', (e) => {
                if (!salespersonDropdown.contains(e.target)) {
                    salespersonDropdown.classList.remove('active');
                }
            });
        }

        // 드롭다운 초기화
        this.initializeSalespersonDropdown();

        salesNumberInput.addEventListener('blur', () => {
            setTimeout(() => this.hideSuggestions('salesNumber'), 200);
        });

        const formInputs = ['newSalesNumber', 'editReason', 'editNote'];
        formInputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.addEventListener('change', () => this.validateForm());
                input.addEventListener('input', () => this.validateForm());
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isEditMode) {
                this.closeEditModal();
            }
        });
    }

    openEditModal(item) {
        this.currentEditingItem = item;
        this.isEditMode = true;

        const modal = document.getElementById('salespersonEditModal');
        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');

        this.displayCurrentInfo(item);
        this.resetForm();

        setTimeout(() => {
            document.getElementById('newSalesNumber').focus();
        }, 100);

        console.log('담당자 수정 모달 열림:', item.거래처명);
    }

    displayCurrentInfo(item) {
        // 거래처 고유 코드 표시
        const storeCode = this.generateStoreId(item);
        document.getElementById('editStoreCode').textContent = storeCode;
        
        document.getElementById('editStoreName').textContent = item.거래처명 || '정보없음';
        document.getElementById('editBusinessNumber').textContent = item.사업자번호 || 'NULL';
        document.getElementById('editStoreAddress').textContent = item['기본주소(사업자기준)'] || '주소정보없음';
        document.getElementById('editRtmChannel').textContent = item['RTM 채널'] || '정보없음';

        document.getElementById('currentSalesNumber').textContent = item['담당 사번'] || 'NULL';
        document.getElementById('currentSalesperson').textContent = item['담당 영업사원'] || 'NULL (미배정)';
        
        const branchInfo = item.salesInfo ? 
            `${item.salesInfo.지사} > ${item.salesInfo.지점}` : 
            'NULL (미배정)';
        document.getElementById('currentBranchInfo').textContent = branchInfo;
    }

    validateSalesNumber() {
        const input = document.getElementById('newSalesNumber');
        const feedback = document.getElementById('salesNumberFeedback');
        const value = input.value.trim();

        if (!value) {
            this.setValidationState(input, feedback, '', 'neutral');
            return false;
        }

        if (!/^\d+$/.test(value)) {
            this.setValidationState(input, feedback, '사번은 숫자만 입력 가능합니다.', 'error');
            return false;
        }

        if (value === String(this.currentEditingItem['담당 사번'])) {
            this.setValidationState(input, feedback, '현재와 동일한 사번입니다.', 'warning');
            return false;
        }

        if (this.validSalesNumbers.has(value)) {
            this.setValidationState(input, feedback, '유효한 사번입니다.', 'success');
            this.autoFillSalesperson(value);
            return true;
        } else {
            this.setValidationState(input, feedback, '등록되지 않은 사번입니다. 새로운 사번인지 확인해주세요.', 'warning');
            return true;
        }
    }

    validateSalesperson() {
        const dropdown = document.getElementById('newSalespersonDropdown');
        const feedback = document.getElementById('salespersonFeedback');
        const value = this.getSelectedSalesperson();

        if (!value) {
            this.setValidationState(dropdown, feedback, '', 'neutral');
            return false;
        }

        if (value === this.currentEditingItem['담당 영업사원']) {
            this.setValidationState(dropdown, feedback, '현재와 동일한 담당자입니다.', 'warning');
            return false;
        }

        if (this.validSalespeople.has(value)) {
            this.setValidationState(dropdown, feedback, '등록된 담당자입니다.', 'success');
            this.autoFillSalesNumber(value);
            return true;
        } else {
            this.setValidationState(dropdown, feedback, '새로운 담당자입니다.', 'info');
            return true;
        }
    }

    setValidationState(element, feedback, message, type) {
        feedback.textContent = message;
        feedback.className = `validation-feedback ${type}`;
        
        // 요소가 input인지 dropdown인지 확인해서 적절한 클래스 적용
        if (element.classList.contains('form-input')) {
            // 일반 input 요소
            element.className = `form-input ${type === 'error' ? 'error' : type === 'success' ? 'success' : ''}`;
        } else if (element.classList.contains('custom-dropdown')) {
            // 커스텀 드롭다운 요소
            const button = element.querySelector('.dropdown-button');
            if (button) {
                // 기본 버튼 스타일 유지하면서 validation 상태 표시
                button.style.borderColor = type === 'error' ? '#e74c3c' : type === 'success' ? '#27ae60' : '#e0e6ed';
            }
        }
    }

    autoFillSalesperson(salesNumber) {
        // 순환 호출 방지
        if (this.isUpdating) {
            console.log('순환 호출 방지: autoFillSalesperson 건너뜀');
            return;
        }
        
        const matchingSales = appData.salesData.find(sales => 
            String(sales['담당 사번']) === salesNumber
        );

        if (matchingSales) {
            // 드롭다운에서 해당 담당자 선택 (검증 없이)
            this.selectSalespersonWithoutValidation(
                matchingSales['담당 영업사원'],
                matchingSales['담당 사번'],
                matchingSales['지점'] || '정보없음'
            );
            this.showAutoMatchInfo(matchingSales);
        }
    }

    // 검증 없이 담당자 정보만 업데이트 (순환 호출 방지용)
    selectSalespersonWithoutValidation(salesperson, salesNumber, branch) {
        try {
            console.log(`담당자 UI 업데이트 (검증 없음): ${salesperson}, 사번: ${salesNumber}, 지점: ${branch}`);
            
            // 드롭다운 버튼 텍스트 업데이트
            const dropdown = document.getElementById('newSalespersonDropdown');
            if (dropdown) {
                const button = dropdown.querySelector('.dropdown-button span');
                if (button) {
                    const displayText = branch ? `${salesperson} (${branch})` : salesperson;
                    button.textContent = displayText;
                }
                dropdown.classList.remove('active');
                
                // 해당 라디오 버튼 선택 상태로 설정
                const radios = dropdown.querySelectorAll('input[type="radio"]');
                radios.forEach(radio => {
                    if (radio.dataset.salesperson === salesperson && 
                        radio.dataset.salesNumber === salesNumber) {
                        radio.checked = true;
                    } else {
                        radio.checked = false;
                    }
                });
            }
        } catch (error) {
            console.error('selectSalespersonWithoutValidation 오류:', error);
        }
    }

    // 필터 변경 시 드롭다운 새로고침
    refreshDropdownForFilterChange() {
        // 편집 모드일 때만 드롭다운 새로고침
        if (this.isEditMode) {
            console.log('필터 변경으로 인한 담당자 드롭다운 새로고침');
            this.initializeSalespersonDropdown();
        }
    }

    autoFillSalesNumber(salesperson) {
        // 순환 호출 방지
        if (this.isUpdating) {
            console.log('순환 호출 방지: autoFillSalesNumber 건너뜀');
            return;
        }
        
        const matchingSales = appData.salesData.find(sales => 
            sales['담당 영업사원'] === salesperson
        );

        if (matchingSales) {
            const salesNumberInput = document.getElementById('newSalesNumber');
            salesNumberInput.value = matchingSales['담당 사번'];
            // validateSalesNumber() 호출하지 않음 (순환 호출 방지)
            this.showAutoMatchInfo(matchingSales);
        }
    }

    showAutoMatchInfo(salesInfo) {
        const autoMatchInfo = document.getElementById('autoMatchInfo');
        const matchDetails = document.getElementById('matchDetails');

        matchDetails.innerHTML = `
            <div class="match-item">
                <span class="match-label">담당 사번:</span>
                <span class="match-value">${salesInfo['담당 사번']}</span>
            </div>
            <div class="match-item">
                <span class="match-label">담당 영업사원:</span>
                <span class="match-value">${salesInfo['담당 영업사원']}</span>
            </div>
            <div class="match-item">
                <span class="match-label">지사:</span>
                <span class="match-value">${salesInfo.지사}</span>
            </div>
            <div class="match-item">
                <span class="match-label">지점:</span>
                <span class="match-value">${salesInfo.지점}</span>
            </div>
        `;

        autoMatchInfo.style.display = 'block';
    }

    showSalesNumberSuggestions() {
        const input = document.getElementById('newSalesNumber');
        const suggestions = document.getElementById('salesNumberSuggestions');
        const value = input.value.trim().toLowerCase();

        if (!value) {
            suggestions.style.display = 'none';
            return;
        }

        const matches = Array.from(this.validSalesNumbers)
            .filter(number => number.includes(value))
            .slice(0, 5);

        if (matches.length > 0) {
            suggestions.innerHTML = matches.map(number => {
                const sales = appData.salesData.find(s => String(s['담당 사번']) === number);
                return `
                    <div class="suggestion-item" onclick="salespersonEditManager.selectSalesNumber('${number}')">
                        <span class="suggestion-number">${number}</span>
                        <span class="suggestion-name">${sales ? sales['담당 영업사원'] : ''}</span>
                        <span class="suggestion-branch">${sales ? `${sales.지사} > ${sales.지점}` : ''}</span>
                    </div>
                `;
            }).join('');
            suggestions.style.display = 'block';
        } else {
            suggestions.style.display = 'none';
        }
    }

    showSalespersonSuggestions() {
        // 이 메서드는 더이상 사용되지 않음 (드롭다운으로 대체됨)
        console.warn('showSalespersonSuggestions is deprecated - using dropdown instead');
        return;
    }

    selectSalesNumber(number) {
        document.getElementById('newSalesNumber').value = number;
        
        // 사번에 해당하는 담당자 자동 설정
        const salesInfo = appData.salesData.find(sales => 
            String(sales['담당 사번']) === String(number)
        );
        
        if (salesInfo && salesInfo['담당 영업사원']) {
            const dropdown = document.getElementById('newSalespersonDropdown');
            if (dropdown) {
                // 드롭다운 버튼 텍스트 업데이트
                const button = dropdown.querySelector('.dropdown-button span');
                if (button) {
                    button.textContent = salesInfo['담당 영업사원'];
                }
                
                // 해당 라디오 버튼 선택
                const radio = dropdown.querySelector(`input[value="${salesInfo['담당 영업사원']}"]`);
                if (radio) {
                    radio.checked = true;
                }
                
                console.log(`사번 "${number}" 선택 → 담당자 "${salesInfo['담당 영업사원']}" 자동 설정`);
            }
        }
        
        this.hideSuggestions('salesNumber');
        this.validateSalesNumber();
        this.validateSalesperson();
        this.updatePreview();
        this.validateForm();
    }

    selectSalespersonFromSuggestion(name) {
        this.selectSalesperson(name);
        this.hideSuggestions('salesperson');
        this.validateSalesperson();
        this.validateForm();
    }

    hideSuggestions(type) {
        if (type === 'salesNumber') {
            const suggestions = document.getElementById('salesNumberSuggestions');
            if (suggestions) {
                suggestions.style.display = 'none';
            }
        }
        // salesperson suggestions는 더이상 사용되지 않음 (드롭다운으로 대체)
    }

    updatePreview() {
        const newSalesNumber = document.getElementById('newSalesNumber').value.trim();
        const newSalesperson = this.getSelectedSalesperson();
        const previewSection = document.getElementById('previewSection');
        const beforePreview = document.getElementById('beforePreview');
        const afterPreview = document.getElementById('afterPreview');

        if (!newSalesNumber && !newSalesperson) {
            previewSection.style.display = 'none';
            return;
        }

        beforePreview.innerHTML = `
            <div class="preview-item">
                <span class="preview-label">담당 사번:</span>
                <span class="preview-value">${this.currentEditingItem['담당 사번'] || '미배정'}</span>
            </div>
            <div class="preview-item">
                <span class="preview-label">담당 영업사원:</span>
                <span class="preview-value">${this.currentEditingItem['담당 영업사원'] || '미배정'}</span>
            </div>
        `;

        afterPreview.innerHTML = `
            <div class="preview-item">
                <span class="preview-label">담당 사번:</span>
                <span class="preview-value ${newSalesNumber !== this.currentEditingItem['담당 사번'] ? 'changed' : ''}">${newSalesNumber || '미배정'}</span>
            </div>
            <div class="preview-item">
                <span class="preview-label">담당 영업사원:</span>
                <span class="preview-value ${newSalesperson !== this.currentEditingItem['담당 영업사원'] ? 'changed' : ''}">${newSalesperson || '미배정'}</span>
            </div>
        `;

        previewSection.style.display = 'block';
    }

    validateForm() {
        const newSalesNumber = document.getElementById('newSalesNumber').value.trim();
        const newSalesperson = this.getSelectedSalesperson();
        const saveBtn = document.getElementById('saveEditBtn');

        const hasChanges = newSalesNumber || newSalesperson;
        
        const isDifferent = 
            newSalesNumber !== String(this.currentEditingItem['담당 사번'] || '') ||
            newSalesperson !== (this.currentEditingItem['담당 영업사원'] || '');

        const isValid = hasChanges && isDifferent;
        
        saveBtn.disabled = !isValid;
        
        if (isValid) {
            saveBtn.classList.add('btn-ready');
        } else {
            saveBtn.classList.remove('btn-ready');
        }
    }

    async saveEdit() {
        try {
            const newSalesNumber = document.getElementById('newSalesNumber').value.trim();
            const newSalesperson = this.getSelectedSalesperson();
            const editReason = document.getElementById('editReason').value;
            const editNote = document.getElementById('editNote').value.trim();
            
            console.log('수정 요청 데이터:', {
                newSalesNumber,
                newSalesperson,
                editReason,
                editNote
            });
            
            // 선택된 담당자 정보 상세 로그
            console.log('현재 편집 중인 아이템:', this.currentEditingItem);
            console.log('기존 담당자 정보:', {
                기존사번: this.currentEditingItem['담당 사번'],
                기존담당자: this.currentEditingItem['담당 영업사원']
            });

            if (!newSalesNumber && !newSalesperson) {
                notificationManager.warning('수정할 정보를 입력해주세요.');
                return;
            }

            const confirmMessage = `
거래처: ${this.currentEditingItem.거래처명}
${newSalesNumber ? `담당 사번: ${this.currentEditingItem['담당 사번']} → ${newSalesNumber}\n` : ''}${newSalesperson ? `담당 영업사원: ${this.currentEditingItem['담당 영업사원']} → ${newSalesperson}\n` : ''}
이 변경사항을 저장하시겠습니까?
            `.trim();

            if (!confirm(confirmMessage)) {
                return;
            }

            const storeCode = this.generateStoreId(this.currentEditingItem);
            
            const editRecord = {
                timestamp: new Date().toISOString(),
                storeId: storeCode,
                storeCode: storeCode,
                storeName: this.currentEditingItem.거래처명,
                businessNumber: this.currentEditingItem.사업자번호,
                changes: {
                    담당사번: {
                        before: this.currentEditingItem['담당 사번'],
                        after: newSalesNumber || this.currentEditingItem['담당 사번']
                    },
                    담당영업사원: {
                        before: this.currentEditingItem['담당 영업사원'],
                        after: newSalesperson || this.currentEditingItem['담당 영업사원']
                    }
                },
                reason: editReason,
                note: editNote,
                user: 'current_user'
            };

            // API 요청 데이터 준비 - 빈 문자열도 전달
            const requestData = {
                storeId: storeCode,
                newSalesNumber: newSalesNumber !== '' ? newSalesNumber : null,
                newSalesperson: newSalesperson !== '' ? newSalesperson : null,
                editReason: editReason,
                editNote: editNote
            };
            
            console.log('API 요청 데이터:', requestData);
            
            // API 호출하여 서버에 저장
            const response = await fetch('/api/update-salesperson', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });

            const result = await response.json();

            if (result.success) {
                // 로컬 상태 업데이트
                this.updateItemData(newSalesNumber, newSalesperson);
                this.addToEditHistory(editRecord);
                
                // 전역 데이터 업데이트 - API 응답에서 updatedItem 사용
                if (result.updatedItem) {
                    // appData.addressData에서 해당 항목 업데이트
                    const storeId = this.generateStoreId(this.currentEditingItem);
                    const addressIndex = appData.addressData.findIndex(item => 
                        this.generateStoreId(item) === storeId
                    );
                    if (addressIndex !== -1) {
                        appData.addressData[addressIndex] = result.updatedItem;
                    }
                    
                    // joinDataBySalesNumber 다시 수행하여 모든 데이터 동기화
                    joinDataBySalesNumber();
                }
                
                // UI 새로고침
                this.refreshMapAndUI();

                notificationManager.success(`${this.currentEditingItem.거래처명}의 담당자 정보가 수정되었습니다.`);
                this.closeEditModal();
            } else {
                throw new Error(result.message || '업데이트 실패');
            }

            console.log('담당자 정보 수정 완료:', editRecord);

        } catch (error) {
            console.error('담당자 정보 수정 실패:', error);
            notificationManager.error('담당자 정보 수정 중 오류가 발생했습니다.');
        }
    }

    generateStoreId(item) {
        // 거래처 고유 ID 생성 (사업자번호 우선, 없으면 거래처명+주소 조합)
        if (item.사업자번호 && item.사업자번호 !== 'null' && item.사업자번호 !== '' && item.사업자번호 !== null) {
            return `BIZ_${item.사업자번호}`;
        }
        // 거래처명과 주소를 조합하여 고유 ID 생성
        const storeName = normalizeValue(item.거래처명);
        const address = normalizeValue(item['기본주소(사업자기준)']);
        const combined = `${storeName}_${address}`;
        // 간단한 해시 생성
        let hash = 0;
        for (let i = 0; i < combined.length; i++) {
            hash = ((hash << 5) - hash) + combined.charCodeAt(i);
            hash = hash & hash;
        }
        return `STORE_${Math.abs(hash)}`;
    }

    updateItemData(newSalesNumber, newSalesperson) {
        // 새로운 값이 있을 때만 업데이트, 없으면 기존 값 유지
        if (newSalesNumber !== undefined && newSalesNumber !== null && newSalesNumber !== '') {
            this.currentEditingItem['담당 사번'] = newSalesNumber;
        }
        if (newSalesperson !== undefined && newSalesperson !== null && newSalesperson !== '') {
            this.currentEditingItem['담당 영업사원'] = newSalesperson;
        }

        const matchingSales = appData.salesData.find(sales => 
            String(sales['담당 사번']) === this.currentEditingItem['담당 사번'] &&
            sales['담당 영업사원'] === this.currentEditingItem['담당 영업사원']
        );

        if (matchingSales) {
            this.currentEditingItem.salesInfo = matchingSales;
        } else {
            // 기존 salesInfo가 있으면 지사/지점 정보를 유지하고 담당자만 업데이트
            if (this.currentEditingItem.salesInfo) {
                this.currentEditingItem.salesInfo = {
                    ...this.currentEditingItem.salesInfo,
                    '담당 사번': this.currentEditingItem['담당 사번'],
                    '담당 영업사원': this.currentEditingItem['담당 영업사원']
                };
            } else {
                // salesInfo가 없으면 null로 설정
                this.currentEditingItem.salesInfo = null;
            }
        }

        // 거래처 고유 ID를 사용하여 데이터 업데이트
        const storeId = this.generateStoreId(this.currentEditingItem);
        
        const dataIndex = appData.joinedData.findIndex(item => 
            this.generateStoreId(item) === storeId
        );

        if (dataIndex !== -1) {
            appData.joinedData[dataIndex] = { ...this.currentEditingItem };
        }

        const filteredIndex = appData.filteredData.findIndex(item => 
            this.generateStoreId(item) === storeId
        );

        if (filteredIndex !== -1) {
            appData.filteredData[filteredIndex] = { ...this.currentEditingItem };
        }
    }

    addToEditHistory(record) {
        this.editHistory.unshift(record);
        
        if (this.editHistory.length > this.maxHistoryLength) {
            this.editHistory = this.editHistory.slice(0, this.maxHistoryLength);
        }

        try {
            localStorage.setItem('salespersonEditHistory', JSON.stringify(this.editHistory));
        } catch (error) {
            console.warn('수정 기록 저장 실패:', error);
        }
    }

    refreshMapAndUI() {
        // 현재 필터 상태 저장
        const currentBranch = document.getElementById('branchFilter')?.value;
        const currentOffice = document.getElementById('officeFilter')?.value;
        const currentSelectedSalespeople = [...selectedSalespeople]; // 배열 복사
        
        // 필터를 다시 적용하여 편집된 데이터가 반영되도록 함
        applyFilters();
        updateSalespeopleOptions();
        updateColorLegend();
        
        // 필터 상태 복원
        if (currentBranch) document.getElementById('branchFilter').value = currentBranch;
        if (currentOffice) document.getElementById('officeFilter').value = currentOffice;
        
        // 담당자 멀티셀렉트 상태 복원
        if (currentSelectedSalespeople.length > 0) {
            selectedSalespeople.length = 0;
            selectedSalespeople.push(...currentSelectedSalespeople);
            
            // DOM 업데이트 후 체크박스 상태 복원
            setTimeout(() => {
                const checkboxes = document.querySelectorAll('#salesPersonDropdown input[type="checkbox"]');
                checkboxes.forEach(checkbox => {
                    if (selectedSalespeople.includes(checkbox.value)) {
                        checkbox.checked = true;
                    }
                });
                updateSalesPersonDropdownText();
                applyFilters(); // 필터 다시 적용
            }, 100);
        }
    }

    resetForm() {
        document.getElementById('newSalesNumber').value = '';
        
        // 드롭다운 데이터 다시 로드 및 초기화
        this.initializeSalespersonDropdown();
        
        // 드롭다운 표시 상태 초기화
        const dropdown = document.getElementById('newSalespersonDropdown');
        if (dropdown) {
            const button = dropdown.querySelector('.dropdown-button span');
            if (button) {
                button.textContent = '- 담당자 선택 -';
            }
            dropdown.classList.remove('active');
        }
        
        document.getElementById('editReason').value = '';
        document.getElementById('editNote').value = '';

        document.getElementById('salesNumberFeedback').textContent = '';
        document.getElementById('salespersonFeedback').textContent = '';

        document.getElementById('salesNumberSuggestions').style.display = 'none';
        // salespersonSuggestions는 드롭다운으로 변경되어 더이상 존재하지 않음

        document.getElementById('autoMatchInfo').style.display = 'none';
        document.getElementById('previewSection').style.display = 'none';

        document.getElementById('saveEditBtn').disabled = true;
        document.getElementById('saveEditBtn').classList.remove('btn-ready');

        const inputs = document.querySelectorAll('#salespersonEditModal .form-input');
        inputs.forEach(input => {
            input.className = 'form-input';
        });
    }

    closeEditModal() {
        const modal = document.getElementById('salespersonEditModal');
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');

        this.isEditMode = false;
        this.currentEditingItem = null;

        this.resetForm();
    }

    getEditHistory() {
        return [...this.editHistory];
    }

    getStoreEditHistory(storeCode) {
        return this.editHistory.filter(record => record.storeCode === storeCode || record.storeId === storeCode);
    }

    exportEditHistory() {
        if (this.editHistory.length === 0) {
            notificationManager.info('내보낼 수정 기록이 없습니다.');
            return;
        }

        const csvHeader = [
            '수정일시', '거래처코드', '거래처명', '사업자번호', '수정전_담당사번', '수정후_담당사번', 
            '수정전_담당영업사원', '수정후_담당영업사원', '수정사유', '메모', '수정자'
        ];

        const csvData = this.editHistory.map(record => [
            record.timestamp,
            record.storeCode || record.storeId || '',
            record.storeName,
            record.businessNumber || '',
            record.changes.담당사번.before || '',
            record.changes.담당사번.after || '',
            record.changes.담당영업사원.before || '',
            record.changes.담당영업사원.after || '',
            record.reason || '',
            record.note || '',
            record.user || ''
        ]);

        const csvContent = [
            csvHeader.join(','),
            ...csvData.map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `담당자수정기록_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

        notificationManager.success('수정 기록이 내보내기 되었습니다.');
    }

    // 새로운 담당자 드롭다운 초기화
    initializeSalespersonDropdown() {
        const dropdown = document.getElementById('newSalespersonDropdown');
        if (!dropdown) return;

        const dropdownContent = dropdown.querySelector('.dropdown-content');
        if (!dropdownContent) return;

        try {
            dropdownContent.innerHTML = '';

            // 디버깅: 데이터 상태 확인
            console.log('담당자 드롭다운 초기화:', {
                joinedDataLength: appData.joinedData ? appData.joinedData.length : 0,
                salesDataLength: appData.salesData ? appData.salesData.length : 0,
                currentEditingItem: this.currentEditingItem
            });

            // 필터 옵션과 동일한 로직으로 담당자 목록 가져오기
            const selectedBranch = elements.branchOfficeSelect?.value || '';
            const selectedOffice = elements.branchSelect?.value || '';
            
            console.log('필터 기준:', { selectedBranch, selectedOffice });
            
            // 필터 조건에 맞는 담당자 목록 추출 (필터 옵션과 동일한 로직)
            let filteredData = [];
            
            if (appData.joinedData && appData.joinedData.length > 0) {
                filteredData = appData.joinedData.filter(item => {
                    // 담당 영업사원이 있어야 함
                    if (!item['담당 영업사원'] || normalizeValue(item['담당 영업사원']) === '') {
                        return false;
                    }
                    
                    // 지사 필터 적용
                    if (selectedBranch && (!item.salesInfo || normalizeValue(item.salesInfo.지사) !== selectedBranch)) {
                        return false;
                    }
                    
                    // 지점 필터 적용
                    if (selectedOffice && (!item.salesInfo || normalizeValue(item.salesInfo.지점) !== selectedOffice)) {
                        return false;
                    }
                    
                    return true;
                });
            }
            
            // salesData에서 직접 필터링 (fallback)
            if (filteredData.length === 0 && appData.salesData && appData.salesData.length > 0) {
                const salesDataFiltered = appData.salesData.filter(item => {
                    // 담당 영업사원이 있어야 함
                    if (!item['담당 영업사원'] || normalizeValue(item['담당 영업사원']) === '') {
                        return false;
                    }
                    
                    // 지사 필터 적용
                    if (selectedBranch && normalizeValue(item['지사']) !== selectedBranch) {
                        return false;
                    }
                    
                    // 지점 필터 적용
                    if (selectedOffice && normalizeValue(item['지점']) !== selectedOffice) {
                        return false;
                    }
                    
                    return true;
                });
                
                // salesData 결과를 joinedData 형식으로 변환
                filteredData = salesDataFiltered.map(item => ({
                    '담당 영업사원': item['담당 영업사원'],
                    salesInfo: item
                }));
                console.log('salesData에서 필터링된 담당자 목록 로드:', filteredData.length);
            }
            
            const allSalespeople = [...new Set(
                filteredData
                    .map(item => normalizeValue(item['담당 영업사원']))
                    .filter(name => name !== '')
            )].sort();

            console.log(`필터링된 담당자 목록 (지사:${selectedBranch||'전체'}, 지점:${selectedOffice||'전체'}):`, allSalespeople.length, allSalespeople.slice(0, 5));

            if (allSalespeople.length === 0) {
                console.warn('선택된 필터 조건에 맞는 담당자가 없음');
                dropdownContent.innerHTML = `
                    <div class="radio-item">
                        <span style="color: #e74c3c; font-style: italic;">
                            선택된 필터 조건에 맞는 담당자가 없습니다.<br>
                            <small>지사: ${selectedBranch || '전체'}, 지점: ${selectedOffice || '전체'}</small>
                        </span>
                    </div>
                `;
                return;
            }

            // 담당자 목록을 이름순으로 정렬 (이미 지점별로 필터링됨)
            const salespeople = allSalespeople.sort((a, b) => a.localeCompare(b));

            salespeople.forEach(salesperson => {
                // 필터링된 데이터에서 해당 담당자의 정보 찾기
                const filteredItem = filteredData.find(item => 
                    normalizeValue(item['담당 영업사원']) === normalizeValue(salesperson)
                );
                const salesInfo = filteredItem?.salesInfo;
                const salesNumber = salesInfo ? salesInfo['담당 사번'] : '';

                const selectableItem = document.createElement('div');
                selectableItem.className = 'selectable-item';
                selectableItem.style.cssText = 'padding: 8px 12px; cursor: pointer; border-radius: 4px; transition: background-color 0.2s; border: 1px solid transparent;';
                selectableItem.dataset.salesperson = salesperson;
                selectableItem.dataset.salesNumber = salesNumber;
                selectableItem.dataset.branch = salesInfo?.['지점'] || '';

                // 클릭 이벤트 추가
                selectableItem.addEventListener('click', () => {
                    console.log('클릭 이벤트 시작:', salesperson);
                    
                    // 기존 선택 해제
                    const previousSelected = dropdownContent.querySelector('.selectable-item.selected');
                    if (previousSelected) {
                        previousSelected.classList.remove('selected');
                        previousSelected.style.backgroundColor = '';
                        previousSelected.style.borderColor = 'transparent';
                    }
                    
                    // 현재 항목 선택
                    selectableItem.classList.add('selected');
                    selectableItem.style.backgroundColor = '#e3f2fd';
                    selectableItem.style.borderColor = '#667eea';
                    
                    console.log('담당자 선택됨:', salesperson, salesNumber);
                    console.log('선택 후 클래스:', selectableItem.className);
                    console.log('선택 후 dataset:', selectableItem.dataset);
                    
                    // 드롭다운 버튼 텍스트 업데이트
                    const dropdownButton = document.querySelector('#newSalespersonDropdown .dropdown-button span');
                    if (dropdownButton) {
                        dropdownButton.textContent = salesperson;
                    }
                    
                    // 드롭다운 닫기 (선택 상태 유지)
                    const dropdown = document.getElementById('newSalespersonDropdown');
                    if (dropdown) {
                        dropdown.classList.remove('active');
                    }
                    
                    // 담당 사번 자동 입력
                    if (salesNumber) {
                        const salesNumberInput = document.getElementById('newSalesNumber');
                        if (salesNumberInput && !salesNumberInput.value.trim()) {
                            salesNumberInput.value = salesNumber;
                            console.log('담당 사번 자동 입력:', salesNumber);
                        }
                    }
                });

                // 호버 효과
                selectableItem.addEventListener('mouseenter', () => {
                    if (!selectableItem.classList.contains('selected')) {
                        selectableItem.style.backgroundColor = '#f5f5f5';
                    }
                });
                
                selectableItem.addEventListener('mouseleave', () => {
                    if (!selectableItem.classList.contains('selected')) {
                        selectableItem.style.backgroundColor = '';
                    }
                });

                const contentDiv = document.createElement('div');
                contentDiv.style.cssText = 'display: flex; flex-direction: column; gap: 2px;';

                const topDiv = document.createElement('div');
                topDiv.style.cssText = 'display: flex; align-items: center; gap: 8px;';

                const nameSpan = document.createElement('span');
                nameSpan.style.cssText = 'font-size: 13px; color: #555; font-weight: 600;';
                nameSpan.textContent = salesperson;

                const numberSpan = document.createElement('span');
                numberSpan.style.cssText = 'font-size: 11px; color: #888; font-family: monospace;';
                numberSpan.textContent = salesNumber ? `(${salesNumber})` : '';

                topDiv.appendChild(nameSpan);
                if (salesNumber) {
                    topDiv.appendChild(numberSpan);
                }

                const branchSpan = document.createElement('span');
                branchSpan.style.cssText = 'font-size: 11px; color: #999; font-style: italic;';
                const branchInfo = salesInfo ? `${salesInfo['지사'] || ''} > ${salesInfo['지점'] || ''}` : '';
                branchSpan.textContent = branchInfo;

                contentDiv.appendChild(topDiv);
                if (branchInfo) {
                    contentDiv.appendChild(branchSpan);
                }

                selectableItem.appendChild(contentDiv);
                dropdownContent.appendChild(selectableItem);
            });

            console.log(`담당자 드롭다운 초기화 완료: ${salespeople.length}명`);

        } catch (error) {
            console.error('담당자 드롭다운 초기화 오류:', error);
            dropdownContent.innerHTML = '<div class="radio-item"><span style="color: #e74c3c;">드롭다운 초기화 중 오류가 발생했습니다.</span></div>';
        }
    }

    // 드롭다운 토글
    toggleSalespersonDropdown() {
        const dropdown = document.getElementById('newSalespersonDropdown');
        if (dropdown) {
            dropdown.classList.toggle('active');
        }
    }

    // 담당자 선택
    selectSalesperson(name) {
        const dropdown = document.getElementById('newSalespersonDropdown');
        if (dropdown) {
            const button = dropdown.querySelector('.dropdown-button span');
            if (button) {
                button.textContent = name;
            }
            dropdown.classList.remove('active');
        }

        // 담당자 이름에 해당하는 사번 자동 설정 (지점 정보 우선 고려)
        let salesInfo = null;
        
        // 현재 편집 중인 아이템의 지점 정보 확인
        const currentBranch = this.currentEditingItem?.salesInfo?.지점 || this.currentEditingItem?.['지점/팀'];
        
        if (currentBranch) {
            // 1순위: 같은 지점의 동명 담당자 찾기
            salesInfo = appData.salesData.find(sales => 
                normalizeValue(sales['담당 영업사원']) === normalizeValue(name) &&
                normalizeValue(sales['지점']) === normalizeValue(currentBranch)
            );
            
            if (salesInfo) {
                console.log(`담당자 "${name}" 매칭: 같은 지점(${currentBranch}) 우선 선택`);
            }
        }
        
        // 2순위: 지점 관계없이 첫 번째 매칭되는 담당자
        if (!salesInfo) {
            salesInfo = appData.salesData.find(sales => 
                normalizeValue(sales['담당 영업사원']) === normalizeValue(name)
            );
            
            if (salesInfo) {
                const selectedBranch = salesInfo['지점'] || '정보없음';
                console.log(`담당자 "${name}" 매칭: 다른 지점(${selectedBranch}) 선택 - 동명이인 주의!`);
            }
        }
        
        if (salesInfo && salesInfo['담당 사번']) {
            const salesNumberInput = document.getElementById('newSalesNumber');
            if (salesNumberInput) {
                salesNumberInput.value = salesInfo['담당 사번'];
                console.log(`담당자 "${name}" 선택 → 사번 "${salesInfo['담당 사번']}" 자동 설정`);
            }
        }

        // 검증 및 미리보기 업데이트
        this.validateSalesNumber();
        this.validateSalesperson();
        this.updatePreview();
    }

    // 지점 정보를 고려한 담당자 선택 (동명이인 처리)
    selectSalespersonWithContext(salesperson, salesNumber, branch) {
        try {
            console.log(`담당자 선택 with context: ${salesperson}, 사번: ${salesNumber}, 지점: ${branch}`);
            
            // 순환 호출 방지
            if (this.isUpdating) {
                console.log('순환 호출 방지: selectSalespersonWithContext 건너뜀');
                return;
            }
            
            this.isUpdating = true;
            
            // 입력값 검증
            if (!salesperson) {
                console.warn('담당자 이름이 비어있습니다.');
                this.isUpdating = false;
                return;
            }
            
            // 드롭다운 버튼 텍스트 업데이트
            const dropdown = document.getElementById('newSalespersonDropdown');
            if (dropdown) {
                const button = dropdown.querySelector('.dropdown-button span');
                if (button) {
                    const displayText = branch ? `${salesperson} (${branch})` : salesperson;
                    button.textContent = displayText;
                }
                dropdown.classList.remove('active');
            }

            // 사번 자동 설정
            const salesNumberInput = document.getElementById('newSalesNumber');
            if (salesNumberInput && salesNumber) {
                salesNumberInput.value = salesNumber;
                console.log(`사번 자동 설정: ${salesNumber}`);
            }

            // 검증 및 미리보기 업데이트 (순환 호출 방지)
            this.updatePreview();
            this.validateForm();
            
        } catch (error) {
            console.error('selectSalespersonWithContext 오류:', error);
            notificationManager.error('담당자 정보 설정 중 오류가 발생했습니다.');
        } finally {
            this.isUpdating = false;
            // 업데이트 완료 후 검증 실행
            setTimeout(() => {
                if (!this.isUpdating) {
                    this.validateSalesNumber();
                    this.validateSalesperson();
                }
            }, 0);
        }
    }

    // 선택된 담당자 가져오기 (새로운 composite 값 형식 지원)
    getSelectedSalesperson() {
        const dropdown = document.getElementById('newSalespersonDropdown');
        if (!dropdown) {
            console.warn('newSalespersonDropdown 요소를 찾을 수 없습니다');
            return '';
        }

        console.log('드롭다운 요소 찾음:', dropdown);
        
        // 모든 selectable-item 확인
        const allItems = dropdown.querySelectorAll('.selectable-item');
        console.log('전체 selectable-item 개수:', allItems.length);
        
        allItems.forEach((item, index) => {
            console.log(`Item ${index}:`, {
                className: item.className,
                hasSelected: item.classList.contains('selected'),
                dataset: item.dataset
            });
        });

        const selectedItem = dropdown.querySelector('.selectable-item.selected');
        if (!selectedItem) {
            console.warn('선택된 담당자가 없습니다');
            console.log('선택된 항목을 찾기 위한 쿼리:', '.selectable-item.selected');
            return '';
        }

        const salesperson = selectedItem.dataset.salesperson;
        console.log('선택된 담당자:', salesperson);
        console.log('선택된 항목:', selectedItem);
        return salesperson || '';
    }
}

// ===============================
// 전역 변수 및 인스턴스
// ===============================

let map;
let currentData = [];
let geoJsonData = null;
let boundaryOverlays = [];
let markers = [];
let isLayerVisible = false;
let selectedSalespeople = [];

const colorCache = new Map();
const eventManager = new EventManager();
const userPreferences = new UserPreferences();
let notificationManager;
let salespersonEditManager;

const appData = {
    salesData: [],
    addressData: [],
    joinedData: [],
    geoData: null,
    filteredData: [],
    selectedRegion: null
};

const elements = {
    branchOfficeSelect: null,
    branchSelect: null,
    salesPersonSelect: null,
    salesPersonDropdown: null,
    applyFilterBtn: null,
    resetFilterBtn: null,
    restoreFilterBtn: null,
    fitBoundsBtn: null,
    toggleLayerBtn: null,
    closeDetailBtn: null,
    detailPanel: null,
    detailContent: null,
    loadingOverlay: null,
    totalRegions: null,
    totalSalespeople: null,
    totalBranches: null
};

let currentSelectedOverlay = null;
let showAllLegendItems = false;

// ===============================
// 초기화 함수들
// ===============================

document.addEventListener('DOMContentLoaded', function() {
    if (typeof kakao === 'undefined') {
        showError('카카오맵 API를 불러올 수 없습니다. 인터넷 연결을 확인해주세요.');
        return;
    }
    
    if (typeof topojson === 'undefined') {
        showError('TopoJSON 라이브러리를 불러올 수 없습니다. 인터넷 연결을 확인해주세요.');
        return;
    }
    
    initializeElements();
    initializeEventListeners();
    initializeMap();
    
    // 알림 관리자 초기화
    notificationManager = new NotificationManager();
    
    // 초기 로드시에는 사용자 설정을 로드하지 않음 (깨끗한 상태로 시작)
    // loadUserPreferences();
    
    const trackedLoadData = withPerformanceTracking('loadData', loadData);
    trackedLoadData();
    
    // 최종 필터 초기화 (모든 로딩이 완료된 후)
    setTimeout(() => {
        forceResetAllFilters();
    }, 2000);
    
    // 페이지 완전 로드 후 한 번 더 강제 초기화
    window.addEventListener('load', () => {
        setTimeout(() => {
            forceResetAllFilters();
        }, 3000);
    });
});

function loadUserPreferences(forceLoad = false) {
    // 강제 로드가 아닌 경우 초기 로드시에는 스킵
    if (!forceLoad) {
        console.log('초기 로드: 사용자 설정을 로드하지 않고 깨끗한 상태로 시작');
        return;
    }
    
    const savedPrefs = userPreferences.load();
    
    if (Object.keys(savedPrefs).length > 0) {
        setTimeout(() => {
            if (savedPrefs.selectedBranch && elements.branchOfficeSelect) {
                elements.branchOfficeSelect.value = savedPrefs.selectedBranch;
                onBranchOfficeChange();
            }
            if (savedPrefs.selectedOffice && elements.branchSelect) {
                elements.branchSelect.value = savedPrefs.selectedOffice;
                onBranchChange();
            }
            if (savedPrefs.selectedSalespeople && Array.isArray(savedPrefs.selectedSalespeople)) {
                selectedSalespeople = savedPrefs.selectedSalespeople;
                // 체크박스 상태도 복원
                restoreSalesPersonSelections();
                updateSalesPersonDropdownText();
            }
            
            console.log('사용자 설정 복원 완료:', savedPrefs);
        }, 100);
    }
}

function saveUserPreferences() {
    userPreferences.save({
        selectedBranch: elements.branchOfficeSelect?.value || '',
        selectedOffice: elements.branchSelect?.value || '',
        selectedSalespeople: selectedSalespeople
    });
}

function initializeElements() {
    elements.branchOfficeSelect = document.getElementById('branchOfficeSelect');
    elements.branchSelect = document.getElementById('branchSelect');
    elements.salesPersonSelect = document.getElementById('salesPersonSelect');
    elements.salesPersonDropdown = document.getElementById('salesPersonDropdown');
    elements.applyFilterBtn = document.getElementById('applyFilterBtn');
    elements.resetFilterBtn = document.getElementById('resetFilterBtn');
    elements.restoreFilterBtn = document.getElementById('restoreFilterBtn');
    elements.fitBoundsBtn = document.getElementById('fitBoundsBtn');
    elements.toggleLayerBtn = document.getElementById('toggleLayerBtn');
    elements.closeDetailBtn = document.getElementById('closeDetailBtn');
    elements.detailPanel = document.getElementById('detailPanel');
    elements.detailContent = document.getElementById('detailContent');
    elements.loadingOverlay = document.getElementById('loadingOverlay');
    elements.totalRegions = document.getElementById('totalRegions');
    elements.totalSalespeople = document.getElementById('totalSalespeople');
    elements.totalBranches = document.getElementById('totalBranches');
    
    // 구역표시 버튼 초기 텍스트 설정
    if (elements.toggleLayerBtn) {
        elements.toggleLayerBtn.textContent = isLayerVisible ? '👁️ 구역표시 OFF' : '👁️ 구역표시 ON';
    }
}

function initializeEventListeners() {
    eventManager.addEventListener(elements.applyFilterBtn, 'click', () => {
        const trackedApplyFilters = withPerformanceTracking('applyFilters', applyFilters);
        trackedApplyFilters();
        saveUserPreferences();
    });
    
    eventManager.addEventListener(elements.resetFilterBtn, 'click', () => {
        resetFilters();
        userPreferences.clear();
        console.log('사용자 설정 초기화됨');
    });
    
    eventManager.addEventListener(elements.restoreFilterBtn, 'click', () => {
        const savedPrefs = userPreferences.load();
        if (Object.keys(savedPrefs).length > 0) {
            loadUserPreferences(true);  // 강제 로드
            notificationManager.success('이전 설정이 복원되었습니다.');
        } else {
            notificationManager.info('저장된 설정이 없습니다.');
        }
    });
    
    eventManager.addEventListener(elements.fitBoundsBtn, 'click', fitMapBounds);
    eventManager.addEventListener(elements.toggleLayerBtn, 'click', toggleBoundaryLayer);
    eventManager.addEventListener(elements.closeDetailBtn, 'click', closeDetailPanel);
    
    eventManager.addEventListener(elements.branchOfficeSelect, 'change', onBranchOfficeChange);
    eventManager.addEventListener(elements.branchSelect, 'change', onBranchChange);
    
    if (elements.salesPersonDropdown) {
        eventManager.addEventListener(elements.salesPersonDropdown, 'click', toggleSalesPersonDropdown);
        eventManager.addEventListener(document, 'click', closeSalesPersonDropdown);
    }
    
    eventManager.addEventListener(window, 'beforeunload', () => {
        eventManager.removeAllListeners();
        clearMapOverlays();
        clearMarkers();
        if (currentSelectedOverlay) {
            currentSelectedOverlay.setMap(null);
            currentSelectedOverlay = null;
        }
    });
}

function initializeMap() {
    const mapContainer = document.getElementById('map');
    const mapOption = {
        center: new kakao.maps.LatLng(APP_CONFIG.MAP_CONFIG.CENTER_LAT, APP_CONFIG.MAP_CONFIG.CENTER_LNG),
        level: APP_CONFIG.MAP_CONFIG.INITIAL_LEVEL
    };
    
    map = new kakao.maps.Map(mapContainer, mapOption);
    
    const mapTypeControl = new kakao.maps.MapTypeControl();
    map.addControl(mapTypeControl, kakao.maps.ControlPosition.TOPRIGHT);
    
    const zoomControl = new kakao.maps.ZoomControl();
    map.addControl(zoomControl, kakao.maps.ControlPosition.RIGHT);
}

function initializeSalespersonEdit() {
    try {
        salespersonEditManager = new SalespersonEditManager();
        console.log('✅ 담당자 수정 기능이 초기화되었습니다.');
        notificationManager.success('담당자 수정 기능이 활성화되었습니다.');
    } catch (error) {
        console.error('담당자 수정 기능 초기화 실패:', error);
        notificationManager.error('담당자 수정 기능 초기화 중 오류가 발생했습니다.');
    }
}

// ===============================
// 데이터 로딩 함수들
// ===============================

async function loadData() {
    showLoading(true);
    
    try {
        await Promise.all([
            loadSalesData(),
            loadAddressData(),
            loadTopoJsonData()
        ]);
        
        joinDataBySalesNumber();
        validateAndNormalizeData();
        
        initializeFilters();
        
        // 담당자 수정 기능 초기화 (데이터 로드 완료 후)
        initializeSalespersonEdit();
        addEditHistoryButton();
        loadEditHistory();
        
        // 초기에는 필터된 데이터를 빈 배열로 설정 (마커 표시 안함)
        appData.filteredData = [];
        updateMapDisplay();  // 지도 초기화 (마커 없음)
        updateStatistics();
        
        // 필터가 모두 생성된 후 강제 초기화
        setTimeout(() => {
            initializeDetailPanel();
        }, 100);
        
    } catch (error) {
        console.error('데이터 로드 실패:', error);
        showError(`데이터를 불러오는데 실패했습니다: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

async function loadSalesData() {
    try {
        appData.salesData = await loadDataWithRetry(APP_CONFIG.DATA_PATHS.SALES_DATA);
        
        const schema = {
            '담당 사번': { required: true },
            '지사': { required: true, type: 'string' },
            '지점': { required: true, type: 'string' },
            '담당 영업사원': { required: true, type: 'string' }
        };
        
        const validation = validateData(appData.salesData, schema);
        if (!validation.isValid) {
            console.warn(`영업 데이터 검증 결과: ${validation.totalErrors}개 오류 발견`);
            if (validation.errors.length <= 10) {
                console.warn('상세 오류:', validation.errors);
            } else {
                console.warn('일부 오류:', validation.errors);
            }
        } else {
            console.log('영업 데이터 검증 통과');
        }
        
        console.log(`영업 데이터 로드 완료: ${appData.salesData.length}개 항목`);
        
    } catch (error) {
        console.error('영업 데이터 로드 오류:', error);
        throw error;
    }
}

async function loadAddressData() {
    try {
        // 먼저 API 엔드포인트에서 최신 데이터를 가져오려고 시도
        try {
            const response = await fetch('/api/data');
            if (response.ok) {
                appData.addressData = await response.json();
                console.log('API에서 최신 데이터 로드 성공:', appData.addressData.length, '개 항목');
            } else {
                throw new Error(`API 응답 오류: ${response.status}`);
            }
        } catch (apiError) {
            console.warn('API에서 데이터 로드 실패, 정적 파일로 대체:', apiError.message);
            // API 실패 시 정적 파일에서 로드
            appData.addressData = await loadDataWithRetry(APP_CONFIG.DATA_PATHS.ADDRESS_DATA);
        }
        
        const schema = {
            '담당 사번': { required: true },
            '거래처명': { required: true, type: 'string' },
            '위도': { required: true },
            '경도': { required: true }
        };
        
        const validation = validateData(appData.addressData, schema);
        if (!validation.isValid) {
            console.warn(`거래처 주소 데이터 검증 결과: ${validation.totalErrors}개 오류 발견`);
            if (validation.errors.length <= 10) {
                console.warn('상세 오류:', validation.errors);
            } else {
                console.warn('일부 오류:', validation.errors);
            }
        } else {
            console.log('거래처 주소 데이터 검증 통과');
        }
        
        console.log(`거래처 주소 데이터 로드 완료: ${appData.addressData.length}개 항목`);
        
    } catch (error) {
        console.error('거래처 주소 데이터 로드 오류:', error);
        throw error;
    }
}

async function loadTopoJsonData() {
    try {
        const topoData = await loadDataWithRetry(APP_CONFIG.DATA_PATHS.TOPO_DATA);
        
        if (!topoData || !topoData.objects || typeof topoData.objects !== 'object') {
            throw new Error('유효하지 않은 TopoJSON 형식입니다.');
        }
        
        let layerKey = APP_CONFIG.TOPOJSON_CONFIG.LAYER_KEY;
        if (!layerKey) {
            const objectKeys = Object.keys(topoData.objects);
            if (objectKeys.length === 0) {
                throw new Error('TopoJSON 파일에 객체가 없습니다.');
            }
            layerKey = objectKeys[0];
            console.log(`TopoJSON 레이어 자동 선택: ${layerKey}`);
        }
        
        if (!topoData.objects[layerKey]) {
            throw new Error(`TopoJSON 파일에서 '${layerKey}' 객체를 찾을 수 없습니다. 사용 가능한 객체: ${Object.keys(topoData.objects).join(', ')}`);
        }
        
        appData.geoData = topojson.feature(topoData, topoData.objects[layerKey]);
        
        if (!appData.geoData || !appData.geoData.features || !Array.isArray(appData.geoData.features)) {
            throw new Error('TopoJSON에서 GeoJSON으로 변환 중 오류가 발생했습니다.');
        }
        
        console.log(`TopoJSON 데이터 로드 및 변환 완료: ${appData.geoData.features.length}개 지역`);
        console.log(`사용된 TopoJSON 레이어: ${layerKey}`);
        
    } catch (error) {
        console.error('TopoJSON 데이터 로드 오류:', error);
        throw error;
    }
}

function joinDataBySalesNumber() {
    try {
        appData.joinedData = [];
        
        console.log(`조인 시작: 거래처 ${appData.addressData.length}개, 영업 ${appData.salesData.length}개`);
        
        appData.addressData.forEach((addressItem, index) => {
            const addressSalesNo = normalizeValue(addressItem['담당 사번']);
            
            if (addressSalesNo !== '') {
                const salesItem = appData.salesData.find(sales => {
                    const salesNo = normalizeValue(sales['담당 사번']);
                    return salesNo !== '' && salesNo === addressSalesNo;
                });
                
                if (salesItem) {
                    appData.joinedData.push({
                        ...addressItem,
                        salesInfo: salesItem
                    });
                } else {
                    appData.joinedData.push({
                        ...addressItem,
                        salesInfo: null
                    });
                    
                    if (index < 5) {
                        console.warn(`담당 사번 "${addressSalesNo}"에 해당하는 영업 데이터 없음: ${addressItem.거래처명 || '이름없음'}`);
                    }
                }
            } else {
                appData.joinedData.push({
                    ...addressItem,
                    salesInfo: null
                });
                
                if (index < 5) {
                    console.warn(`담당 사번 없음: ${addressItem.거래처명 || '이름없음'}`);
                }
            }
        });
        
        console.log(`데이터 조인 완료: ${appData.joinedData.length}개 항목`);
        
        const withSalesInfo = appData.joinedData.filter(item => item.salesInfo).length;
        const withoutSalesInfo = appData.joinedData.length - withSalesInfo;
        console.log(`영업 정보 매칭: ${withSalesInfo}개 (${(withSalesInfo/appData.joinedData.length*100).toFixed(1)}%), 미매칭: ${withoutSalesInfo}개 (${(withoutSalesInfo/appData.joinedData.length*100).toFixed(1)}%)`);
        
        if (withSalesInfo / appData.joinedData.length < 0.5) {
            console.warn('⚠️ 영업 정보 매칭률이 50% 미만입니다. 데이터를 확인해주세요.');
        }
        
    } catch (error) {
        console.error('데이터 조인 오류:', error);
        throw error;
    }
}

function validateAndNormalizeData() {
    appData.salesData = appData.salesData.map(item => ({
        ...item,
        ADM_CD: item.ADM_CD ? String(item.ADM_CD).padStart(8, '0') : '00000000'
    }));
    
    if (appData.geoData && appData.geoData.features) {
        appData.geoData.features = appData.geoData.features.map(feature => ({
            ...feature,
            properties: {
                ...feature.properties,
                adm_cd: feature.properties.adm_cd ? String(feature.properties.adm_cd).padStart(8, '0') : '00000000'
            }
        }));
    }
    
    appData.joinedData = appData.joinedData.filter(item => {
        const lat = item.위도;
        const lng = item.경도;
        
        return lat !== undefined && lat !== null && lat !== '' &&
               lng !== undefined && lng !== null && lng !== '' &&
               !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng)) &&
               isFinite(parseFloat(lat)) && isFinite(parseFloat(lng));
    });
    
    console.log(`위도/경도가 유효한 거래처: ${appData.joinedData.length}개`);
}

// ===============================
// 필터링 함수들
// ===============================

function extractFilterOptions() {
    try {
        const validData = appData.joinedData.filter(item => {
            return item && (
                item.salesInfo || 
                (item['담당 영업사원'] && normalizeValue(item['담당 영업사원']) !== '')
            );
        });
        
        console.log(`필터 옵션 추출: 유효 데이터 ${validData.length}개`);
        
        const branches = [...new Set(
            validData
                .filter(item => item.salesInfo?.지사 && normalizeValue(item.salesInfo.지사) !== '')
                .map(item => normalizeValue(item.salesInfo.지사))
        )].filter(Boolean).sort();
        
        const offices = [...new Set(
            validData
                .filter(item => item.salesInfo?.지점 && normalizeValue(item.salesInfo.지점) !== '')
                .map(item => normalizeValue(item.salesInfo.지점))
        )].filter(Boolean).sort();
        
        const salespeople = [...new Set(
            validData
                .filter(item => normalizeValue(item['담당 영업사원']) !== '')
                .map(item => normalizeValue(item['담당 영업사원']))
        )].filter(Boolean).sort();
        
        console.log(`필터 옵션: 지사 ${branches.length}개, 지점 ${offices.length}개, 담당자 ${salespeople.length}명`);
        
        return { branches, offices, salespeople };
        
    } catch (error) {
        console.error('필터 옵션 추출 오류:', error);
        return { branches: [], offices: [], salespeople: [] };
    }
}

function initializeFilters() {
    try {
        console.log('필터 초기화 시작');
        
        const { branches, offices, salespeople } = extractFilterOptions();
        
        if (branches.length === 0 && offices.length === 0 && salespeople.length === 0) {
            console.warn('⚠️ 모든 필터 옵션이 비어있습니다. 데이터를 확인해주세요.');
        }
        
        populateSelect(elements.branchOfficeSelect, branches, '- 지사 선택 -');
        populateSelect(elements.branchSelect, offices, '- 지점 선택 -');
        
        initializeSalesPersonDropdown(salespeople);
        
        console.log('필터 초기화 완료');
        
    } catch (error) {
        console.error('필터 초기화 오류:', error);
        if (elements.branchOfficeSelect) {
            elements.branchOfficeSelect.innerHTML = '<option value="">- 지사 선택 -</option>';
        }
        if (elements.branchSelect) {
            elements.branchSelect.innerHTML = '<option value="">- 지점 선택 -</option>';
        }
    }
}

function populateSelect(selectElement, options, placeholder) {
    if (!selectElement) {
        console.warn('셀렉트 요소가 존재하지 않습니다.');
        return;
    }
    
    try {
        selectElement.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>`;
        
        options.forEach(option => {
            if (option && normalizeValue(option) !== '') {
                const optionElement = document.createElement('option');
                optionElement.value = option;
                optionElement.textContent = option;
                selectElement.appendChild(optionElement);
            }
        });
        
        console.log(`${placeholder} 옵션 ${options.length}개 추가 완료`);
        
    } catch (error) {
        console.error(`셀렉트 박스 채우기 오류 (${placeholder}):`, error);
    }
}

function initializeSalesPersonDropdown(salespeople, preserveSelection = false) {
    if (!elements.salesPersonDropdown) {
        console.warn('담당자 드롭다운 요소를 찾을 수 없습니다.');
        return;
    }
    
    const dropdownContent = elements.salesPersonDropdown.querySelector('.dropdown-content');
    if (!dropdownContent) {
        console.warn('드롭다운 콘텐츠 요소를 찾을 수 없습니다.');
        return;
    }
    
    try {
        // 현재 선택 상태 저장
        const currentSelection = preserveSelection ? [...selectedSalespeople] : [];
        
        dropdownContent.innerHTML = '';
        
        // preserveSelection이 false일 때만 초기화
        if (!preserveSelection) {
            selectedSalespeople.length = 0;
            console.log('initializeSalesPersonDropdown: selectedSalespeople 배열 초기화됨');
        }
        
        const validSalespeople = salespeople.filter(sp => normalizeValue(sp) !== '');
        
        if (validSalespeople.length === 0) {
            dropdownContent.innerHTML = '<div class="checkbox-item"><span style="color: #999; font-style: italic;">담당자 정보가 없습니다.</span></div>';
            updateSalesPersonDropdownText();
            return;
        }
        
        validSalespeople.forEach(salesperson => {
            const checkboxItem = document.createElement('div');
            checkboxItem.className = 'checkbox-item';
            
            const label = document.createElement('label');
            label.style.cssText = 'display: flex; align-items: center; gap: 8px; cursor: pointer; margin: 0; font-weight: normal;';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = salesperson;
            checkbox.checked = preserveSelection ? currentSelection.includes(salesperson) : false;
            checkbox.autocomplete = 'off';  // 브라우저 자동완성 방지
            checkbox.setAttribute('autocomplete', 'off');
            if (!preserveSelection) {
                checkbox.removeAttribute('checked');  // HTML 속성도 제거
            }
            checkbox.style.cssText = 'margin: 0; accent-color: #667eea;';
            
            const span = document.createElement('span');
            span.style.cssText = 'font-size: 13px; color: #555;';
            span.textContent = salesperson;
            
            checkbox.addEventListener('change', onSalesPersonCheckboxChange);
            
            label.appendChild(checkbox);
            label.appendChild(span);
            checkboxItem.appendChild(label);
            dropdownContent.appendChild(checkboxItem);
        });
        
        console.log(`담당자 드롭다운 초기화 완료: ${validSalespeople.length}명`);
        
        // 초기화 시에는 복원하지 않고 드롭다운 텍스트만 업데이트
        updateSalesPersonDropdownText();
        
    } catch (error) {
        console.error('담당자 드롭다운 초기화 오류:', error);
        dropdownContent.innerHTML = '<div class="checkbox-item"><span style="color: #e74c3c;">드롭다운 초기화 중 오류가 발생했습니다.</span></div>';
    }
}

function restoreSalesPersonSelections() {
    if (!elements.salesPersonDropdown || selectedSalespeople.length === 0) return;
    
    try {
        const checkboxes = elements.salesPersonDropdown.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            if (selectedSalespeople.includes(checkbox.value)) {
                checkbox.checked = true;
            }
        });
    } catch (error) {
        console.error('담당자 선택 상태 복원 오류:', error);
    }
}

function onSalesPersonCheckboxChange() {
    try {
        if (!elements.salesPersonDropdown) return;
        
        const checkboxes = elements.salesPersonDropdown.querySelectorAll('input[type="checkbox"]');
        
        selectedSalespeople = Array.from(checkboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value)
            .filter(value => normalizeValue(value) !== '');
        
        console.log(`선택된 담당자: ${selectedSalespeople.length}명 - ${selectedSalespeople.join(', ')}`);
        
        updateSalesPersonDropdownText();
        
    } catch (error) {
        console.error('담당자 체크박스 변경 처리 오류:', error);
    }
}

function updateSalesPersonDropdownText() {
    const button = elements.salesPersonDropdown.querySelector('.dropdown-button');
    if (!button) return;
    
    if (selectedSalespeople.length === 0) {
        button.innerHTML = '<span>- 선택 -</span> <span class="dropdown-arrow">▼</span>';
    } else if (selectedSalespeople.length === 1) {
        button.innerHTML = `<span>${selectedSalespeople[0]}</span> <span class="dropdown-arrow">▼</span>`;
    } else {
        button.innerHTML = `<span>${selectedSalespeople[0]} 외 ${selectedSalespeople.length - 1}명</span> <span class="dropdown-arrow">▼</span>`;
    }
}

function toggleSalesPersonDropdown(event) {
    event.stopPropagation();
    const dropdown = elements.salesPersonDropdown;
    dropdown.classList.toggle('active');
}

function closeSalesPersonDropdown(event) {
    if (!elements.salesPersonDropdown) return;
    
    if (!elements.salesPersonDropdown.contains(event.target)) {
        elements.salesPersonDropdown.classList.remove('active');
    }
}

function onBranchOfficeChange() {
    try {
        const selectedBranch = elements.branchOfficeSelect?.value || '';
        console.log(`지사 선택 변경: "${selectedBranch}"`);
        
        let filteredOffices;
        
        if (selectedBranch) {
            filteredOffices = [...new Set(
                appData.joinedData
                    .filter(item => 
                        item.salesInfo && 
                        normalizeValue(item.salesInfo.지사) === selectedBranch
                    )
                    .map(item => item.salesInfo.지점)
                    .filter(office => normalizeValue(office) !== '')
            )].sort();
        } else {
            filteredOffices = [...new Set(
                appData.joinedData
                    .filter(item => item.salesInfo?.지점)
                    .map(item => item.salesInfo.지점)
                    .filter(office => normalizeValue(office) !== '')
            )].sort();
        }
        
        console.log(`필터링된 지점: ${filteredOffices.length}개`);
        
        populateSelect(elements.branchSelect, filteredOffices, '- 지점 선택 -');
        updateSalespeopleOptions();
        
    } catch (error) {
        console.error('지사 변경 처리 오류:', error);
    }
}

function onBranchChange() {
    try {
        const selectedOffice = elements.branchSelect?.value || '';
        console.log(`지점 선택 변경: "${selectedOffice}"`);
        
        updateSalespeopleOptions();
        
    } catch (error) {
        console.error('지점 변경 처리 오류:', error);
    }
}

function updateSalespeopleOptions() {
    try {
        const selectedBranch = elements.branchOfficeSelect?.value || '';
        const selectedOffice = elements.branchSelect?.value || '';
        
        console.log(`담당자 옵션 업데이트: 지사="${selectedBranch}", 지점="${selectedOffice}"`);
        
        let filteredData = appData.joinedData.filter(item => {
            if (!item['담당 영업사원'] || normalizeValue(item['담당 영업사원']) === '') {
                return false;
            }
            
            if (selectedBranch && (!item.salesInfo || normalizeValue(item.salesInfo.지사) !== selectedBranch)) {
                return false;
            }
            
            if (selectedOffice && (!item.salesInfo || normalizeValue(item.salesInfo.지점) !== selectedOffice)) {
                return false;
            }
            
            return true;
        });
        
        const salespeople = [...new Set(
            filteredData
                .map(item => normalizeValue(item['담당 영업사원']))
                .filter(name => name !== '')
        )].sort();
        
        console.log(`업데이트된 담당자 옵션: ${salespeople.length}명`);
        
        selectedSalespeople = selectedSalespeople.filter(sp => salespeople.includes(sp));
        
        if (selectedSalespeople.length > 0) {
            console.log(`유지된 선택 담당자: ${selectedSalespeople.length}명`);
        }
        
        initializeSalesPersonDropdown(salespeople, true); // preserveSelection = true
        
        // 담당자 수정 모달이 열려있다면 드롭다운도 함께 업데이트
        if (salespersonEditManager) {
            salespersonEditManager.refreshDropdownForFilterChange();
        }
        
    } catch (error) {
        console.error('담당자 옵션 업데이트 오류:', error);
    }
}

function applyFilters() {
    try {
        console.log('필터 적용 시작');
        
        const selectedBranch = elements.branchOfficeSelect?.value || '';
        const selectedOffice = elements.branchSelect?.value || '';
        
        console.log(`필터 조건: 지사="${selectedBranch}", 지점="${selectedOffice}", 담당자=${selectedSalespeople.length}명`);
        
        appData.filteredData = appData.joinedData.filter(item => {
            let match = true;
            
            if (selectedBranch && (!item.salesInfo || item.salesInfo.지사 !== selectedBranch)) {
                match = false;
            }
            
            if (selectedOffice && (!item.salesInfo || item.salesInfo.지점 !== selectedOffice)) {
                match = false;
            }
            
            if (selectedSalespeople.length > 0 && !selectedSalespeople.includes(item['담당 영업사원'])) {
                match = false;
            }
            
            return match;
        });
        
        console.log(`필터 적용 결과: ${appData.filteredData.length}개 거래처`);
        
        updateMapDisplay();
        updateStatistics();
        
        if (appData.filteredData.length > 0) {
            fitMapToFilteredData();
        }
        
        console.log('필터 적용 완료');
        
    } catch (error) {
        console.error('필터 적용 오류:', error);
        showError('필터 적용 중 오류가 발생했습니다.');
    }
}

function resetFilters() {
    try {
        console.log('필터 초기화 실행');
        
        // 모든 필터 값 초기화
        if (elements.branchOfficeSelect) elements.branchOfficeSelect.value = '';
        if (elements.branchSelect) elements.branchSelect.value = '';
        
        // 선택된 담당자 배열 초기화
        selectedSalespeople = [];
        
        // 담당자 드롭다운 체크박스 모두 해제
        if (elements.salesPersonDropdown) {
            const checkboxes = elements.salesPersonDropdown.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(checkbox => {
                checkbox.checked = false;
            });
            // 드롭다운 텍스트 초기화
            updateSalesPersonDropdownText();
        }
        
        // 필터 옵션 재초기화
        initializeFilters();
        
        // 필터된 데이터를 빈 배열로 초기화
        appData.filteredData = [];
        
        // 지도 클리어 (마커 표시 안함)
        clearMapOverlays();
        clearMarkers();
        updateMapDisplay();  // 마커 없는 깨끗한 상태
        
        // 구역 표시도 초기화 (OFF 상태로)
        isLayerVisible = false;
        if (elements.toggleLayerBtn) {
            elements.toggleLayerBtn.textContent = '👁️ 구역표시 ON';
        }
        
        // 통계 업데이트
        updateStatistics();
        
        // 지도 중심 및 레벨 초기화
        map.setCenter(new kakao.maps.LatLng(APP_CONFIG.MAP_CONFIG.CENTER_LAT, APP_CONFIG.MAP_CONFIG.CENTER_LNG));
        map.setLevel(APP_CONFIG.MAP_CONFIG.INITIAL_LEVEL);
        
        console.log('필터 초기화 완료');
        
    } catch (error) {
        console.error('필터 초기화 오류:', error);
        showError('필터 초기화 중 오류가 발생했습니다.');
    }
}

// ===============================
// 지도 표시 함수들
// ===============================

function updateMapDisplay() {
    clearMapOverlays();
    clearMarkers();
    
    // 필터가 적용된 경우에만 마커 표시
    if (selectedSalespeople.length > 0) {
        displayMarkers();
    }
    // 초기 상태에서는 마커를 표시하지 않음
    
    if (isLayerVisible) {
        displayBoundaries();
    }
}

function displayMarkers() {
    appData.filteredData.forEach(item => {
        if (item.위도 && item.경도) {
            const lat = parseFloat(item.위도);
            const lng = parseFloat(item.경도);
            
            if (!isNaN(lat) && !isNaN(lng)) {
                const position = new kakao.maps.LatLng(lat, lng);
                
                const rtmChannel = item['RTM 채널'] || 'default';
                const salesperson = item['담당 영업사원'];
                
                const markerImage = createMarkerImage(rtmChannel, salesperson);
                
                const marker = new kakao.maps.Marker({
                    position: position,
                    image: markerImage
                });
                
                marker.setMap(map);
                markers.push(marker);
                
                // 담당자 수정 기능이 포함된 마커 클릭 이벤트
                kakao.maps.event.addListener(marker, 'click', function() {
                    showMarkerDetailWithEdit(item, position);
                });
            }
        }
    });
    
    console.log(`마커 표시 완료: ${markers.length}개`);
}

function displayAllMarkers() {
    appData.joinedData.forEach(item => {
        if (item.위도 && item.경도) {
            const lat = parseFloat(item.위도);
            const lng = parseFloat(item.경도);
            
            if (!isNaN(lat) && !isNaN(lng)) {
                const position = new kakao.maps.LatLng(lat, lng);
                
                const rtmChannel = item['RTM 채널'] || 'default';
                const salesperson = item['담당 영업사원'] || 'unassigned';
                
                // NULL이나 미배정 담당자를 위한 기본 색상
                const markerImage = createMarkerImage(rtmChannel, salesperson);
                
                const marker = new kakao.maps.Marker({
                    position: position,
                    image: markerImage
                });
                
                marker.setMap(map);
                markers.push(marker);
                
                // 담당자 수정 기능이 포함된 마커 클릭 이벤트
                kakao.maps.event.addListener(marker, 'click', function() {
                    showMarkerDetailWithEdit(item, position);
                });
            }
        }
    });
    
    console.log(`전체 마커 표시 완료: ${markers.length}개 (NULL 값 포함)`);
}

function showMarkerDetailWithEdit(item, position) {
    if (currentSelectedOverlay) {
        currentSelectedOverlay.setMap(null);
    }
    
    // 거래처 코드 생성
    const storeCode = salespersonEditManager ? salespersonEditManager.generateStoreId(item) : '';
    
    const content = `
        <div style="
            background: white; 
            padding: 15px; 
            border-radius: 10px; 
            box-shadow: 0 4px 20px rgba(0,0,0,0.3); 
            border: 2px solid #667eea;
            min-width: 250px;
            max-width: 300px;
            position: relative;
        ">
            <button onclick="closeMarkerOverlay()" 
                    style="
                        position: absolute;
                        top: 8px;
                        right: 8px;
                        background: none;
                        border: none;
                        color: #999;
                        font-size: 18px;
                        cursor: pointer;
                        width: 24px;
                        height: 24px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border-radius: 50%;
                        transition: all 0.2s ease;
                    "
                    onmouseover="this.style.background='#f0f0f0'; this.style.color='#333';"
                    onmouseout="this.style.background='none'; this.style.color='#999';"
                    title="닫기">
                &times;
            </button>
            <div style="font-weight: bold; color: #2c3e50; margin-bottom: 8px; font-size: 14px; padding-right: 20px;">
                🏢 ${item['지점/팀'] || '정보없음'}
            </div>
            <div style="color: #555; margin-bottom: 6px; font-size: 13px;">
                🏪 ${item.거래처명 || '정보없음'}
            </div>
            <div style="font-family: monospace; font-size: 11px; color: #667eea; margin-bottom: 6px;">
                📌 ${storeCode}
            </div>
            <div style="color: #666; margin-bottom: 6px; font-size: 12px;">
                📍 ${item['기본주소(사업자기준)'] || '주소정보없음'}
            </div>
            <div style="color: #667eea; margin-bottom: 4px; font-size: 12px;">
                📊 RTM: ${item['RTM 채널'] || '정보없음'}
            </div>
            <div style="color: #667eea; margin-bottom: 8px; font-size: 12px;">
                🏬 채널: ${item.채널 || '정보없음'}
            </div>
            <div style="border-top: 1px solid #eee; padding-top: 8px; margin-top: 8px;">
                <button onclick="salespersonEditManager.openEditModal(${JSON.stringify(item).replace(/"/g, '&quot;')})" 
                        style="
                            background: #667eea; 
                            color: white; 
                            border: none; 
                            padding: 6px 12px; 
                            border-radius: 4px; 
                            font-size: 12px; 
                            cursor: pointer;
                            width: 100%;
                        ">
                    ✏️ 담당자 수정
                </button>
            </div>
            <div style="position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); 
                        width: 0; height: 0; border-left: 8px solid transparent; 
                        border-right: 8px solid transparent; border-top: 8px solid #667eea;">
            </div>
        </div>
    `;
    
    currentSelectedOverlay = new kakao.maps.CustomOverlay({
        content: content,
        position: position,
        yAnchor: 1.3
    });
    
    currentSelectedOverlay.setMap(map);
    
    // 마커 클릭 시 상세 정보 패널을 열지 않음 (오버레이만 표시)
}

function showDetailPanelWithEdit(item) {
    // 거래처 코드 생성
    const storeCode = salespersonEditManager ? salespersonEditManager.generateStoreId(item) : '';
    
    const content = `
        <div class="detail-item">
            <strong>📌 거래처코드</strong>
            <span style="font-family: monospace; color: #667eea;">${storeCode}</span>
        </div>
        <div class="detail-item">
            <strong>🏢 지점/팀</strong>
            <span>${item['지점/팀'] || '정보없음'}</span>
        </div>
        <div class="detail-item">
            <strong>🏪 거래처명</strong>
            <span>${item.거래처명 || '정보없음'}</span>
        </div>
        <div class="detail-item">
            <strong>🏭 사업자번호</strong>
            <span>${item.사업자번호 || '정보없음'}</span>
        </div>
        <div class="detail-item">
            <strong>📍 주소</strong>
            <span>${item['기본주소(사업자기준)'] || '주소정보없음'}</span>
        </div>
        <div class="detail-item">
            <strong>📊 RTM 채널</strong>
            <span>${item['RTM 채널'] || '정보없음'}</span>
        </div>
        <div class="detail-item">
            <strong>🏬 채널</strong>
            <span>${item.채널 || '정보없음'}</span>
        </div>
        <div class="detail-item">
            <strong>👤 담당 영업사원</strong>
            <span>${item['담당 영업사원']} (${item['담당 사번']})</span>
        </div>
        ${item.salesInfo ? `
        <div class="detail-item">
            <strong>🏢 지사</strong>
            <span>${item.salesInfo.지사}</span>
        </div>
        <div class="detail-item">
            <strong>🏬 지점</strong>
            <span>${item.salesInfo.지점}</span>
        </div>
        ` : ''}
        
        <div class="detail-edit-section" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee;">
            <button 
                class="btn btn-primary" 
                style="width: 100%;" 
                onclick="salespersonEditManager.openEditModal(${JSON.stringify(item).replace(/"/g, '&quot;')})"
            >
                ✏️ 담당자 정보 수정
            </button>
        </div>
    `;
        
    elements.detailContent.innerHTML = content;
    elements.detailPanel.classList.add('show');
    elements.detailPanel.setAttribute('aria-hidden', 'false');
}

function displayBoundaries() {
    if (!appData.salesData || !appData.geoData) return;
    
    const salesRegions = appData.salesData.filter(item => {
        const selectedBranch = elements.branchOfficeSelect.value;
        const selectedOffice = elements.branchSelect.value;
        
        let match = true;
        if (selectedBranch && item.지사 !== selectedBranch) match = false;
        if (selectedOffice && item.지점 !== selectedOffice) match = false;
        if (selectedSalespeople.length > 0 && !selectedSalespeople.includes(item['담당 영업사원'])) match = false;
        
        return match;
    });
    
    const admCodes = salesRegions.map(item => item.ADM_CD);
    const filteredFeatures = appData.geoData.features.filter(feature => 
        admCodes.includes(feature.properties.adm_cd)
    );
    
    filteredFeatures.forEach(feature => {
        displayPolygonOnMap(feature);
    });
}

function displayPolygonOnMap(feature) {
    try {
        let coordinates;
        if (feature.geometry.type === 'MultiPolygon') {
            coordinates = feature.geometry.coordinates[0][0];
        } else if (feature.geometry.type === 'Polygon') {
            coordinates = feature.geometry.coordinates[0];
        } else {
            console.warn('지원하지 않는 geometry 타입:', feature.geometry.type);
            return;
        }
        
        const path = coordinates.map(coord => new kakao.maps.LatLng(coord[1], coord[0]));
        
        const salesInfo = appData.salesData.find(item => 
            item.ADM_CD === feature.properties.adm_cd
        );
        
        if (!salesInfo) return;
        
        const color = getAccessibleSalespersonColor(salesInfo['담당 영업사원']);
        
        const polygon = new kakao.maps.Polygon({
            path: path,
            strokeWeight: 2,
            strokeColor: color,
            strokeOpacity: 0.8,
            fillColor: color,
            fillOpacity: 0.3
        });
        
        polygon.setMap(map);
        boundaryOverlays.push(polygon);
        
        kakao.maps.event.addListener(polygon, 'click', function() {
            const center = getPolygonCenter(path);
            const regionName = feature.properties.adm_nm || 
                              `${salesInfo.행정구역_sido} ${salesInfo.행정구역_sgg} ${salesInfo.행정구역_umd}`;
            
            if (currentSelectedOverlay) {
                currentSelectedOverlay.setMap(null);
            }
            
            currentSelectedOverlay = new kakao.maps.CustomOverlay({
                content: `<div style="
                    background: white; 
                    padding: 8px 16px; 
                    border-radius: 20px; 
                    font-size: 14px; 
                    font-weight: bold; 
                    box-shadow: 0 4px 16px rgba(0,0,0,0.2); 
                    border: 2px solid ${color}; 
                    color: ${color};
                    white-space: nowrap;
                    max-width: 200px;
                    text-align: center;
                ">${regionName}</div>`,
                position: center,
                yAnchor: 1.3
            });
            
            currentSelectedOverlay.setMap(map);
            showRegionDetail(feature, salesInfo);
            zoomToRegion(path);
        });
        
        kakao.maps.event.addListener(polygon, 'mouseover', function() {
            polygon.setOptions({ strokeWeight: 3, fillOpacity: 0.5 });
        });
        
        kakao.maps.event.addListener(polygon, 'mouseout', function() {
            polygon.setOptions({ strokeWeight: 2, fillOpacity: 0.3 });
        });
        
    } catch (error) {
        console.error('폴리곤 표시 오류:', error, feature);
    }
}

function clearMarkers() {
    markers.forEach(marker => {
        if (marker.setMap) {
            marker.setMap(null);
        }
    });
    markers = [];
}

function clearMapOverlays() {
    boundaryOverlays.forEach(overlay => {
        if (overlay.setMap) {
            overlay.setMap(null);
        }
    });
    boundaryOverlays = [];
    
    if (currentSelectedOverlay) {
        currentSelectedOverlay.setMap(null);
        currentSelectedOverlay = null;
    }
}

function closeMarkerOverlay() {
    if (currentSelectedOverlay) {
        currentSelectedOverlay.setMap(null);
        currentSelectedOverlay = null;
    }
}

// ===============================
// 색상 관련 함수들
// ===============================

function getSalespersonColor(salesperson) {
    if (colorCache.has(salesperson)) {
        return colorCache.get(salesperson);
    }
    
    const config = APP_CONFIG.COLOR_GENERATION;
    
    const normalizedName = String(salesperson).trim().toLowerCase();
    
    let hash = 5381;
    for (let i = 0; i < normalizedName.length; i++) {
        hash = ((hash << 5) + hash) + normalizedName.charCodeAt(i);
        hash = hash & hash;
    }
    
    hash = Math.abs(hash);
    
    const hueIndex = hash % config.HUE_STEPS;
    const saturationIndex = (hash >> 8) % config.SATURATION_LEVELS.length;
    const lightnessIndex = (hash >> 16) % config.LIGHTNESS_LEVELS.length;
    
    const hue = (hueIndex * 360) / config.HUE_STEPS;
    const saturation = config.SATURATION_LEVELS[saturationIndex];
    const lightness = config.LIGHTNESS_LEVELS[lightnessIndex];
    
    const color = `hsl(${Math.round(hue)}, ${saturation}%, ${lightness}%)`;
    
    colorCache.set(salesperson, color);
    
    return color;
}

function getAccessibleSalespersonColor(salesperson) {
    const baseColor = getSalespersonColor(salesperson);
    
    const hexColor = hslToHex(
        parseInt(baseColor.match(/\d+/g)[0]),
        parseInt(baseColor.match(/\d+/g)[1]),
        parseInt(baseColor.match(/\d+/g)[2])
    );
    
    const contrastRatio = calculateContrastRatio(hexColor, '#ffffff');
    
    if (contrastRatio < 4.5) {
        const adjustedColor = baseColor.replace(/(\d+)%\)$/, (_, lightness) => {
            const newLightness = Math.max(30, parseInt(lightness) - 20);
            return `${newLightness}%)`;
        });
        
        colorCache.set(salesperson, adjustedColor);
        return adjustedColor;
    }
    
    return baseColor;
}

function getPolygonCenter(path) {
    let lat = 0;
    let lng = 0;
    
    path.forEach(point => {
        lat += point.getLat();
        lng += point.getLng();
    });
    
    return new kakao.maps.LatLng(lat / path.length, lng / path.length);
}

function showRegionDetail(feature, salesInfo) {
    const regionName = feature.properties.adm_nm || 
                      `${salesInfo.행정구역_sido} ${salesInfo.행정구역_sgg} ${salesInfo.행정구역_umd}`;
    
    const content = `
        <div class="detail-item">
            <strong>🏢 지사/지점</strong>
            <span>${salesInfo.지사} > ${salesInfo.지점}</span>
        </div>
        <div class="detail-item">
            <strong>👤 담당 영업사원</strong>
            <span>${salesInfo['담당 영업사원']} (${salesInfo['담당 사번']})</span>
        </div>
        <div class="detail-item">
            <strong>📍 행정구역</strong>
            <span>${regionName}</span>
        </div>
        <div class="detail-item">
            <strong>🆔 행정코드</strong>
            <span>${salesInfo.ADM_CD}</span>
        </div>
    `;
        
    elements.detailContent.innerHTML = content;
    elements.detailPanel.classList.add('show');
    elements.detailPanel.setAttribute('aria-hidden', 'false');
    appData.selectedRegion = feature;
}

function zoomToRegion(path) {
    const bounds = new kakao.maps.LatLngBounds();
    path.forEach(point => bounds.extend(point));
    map.setBounds(bounds);
}

function fitMapToFilteredData() {
    if (appData.filteredData.length === 0) return;
    
    const bounds = new kakao.maps.LatLngBounds();
    let hasValidBounds = false;
    
    appData.filteredData.forEach(item => {
        if (item.위도 && item.경도) {
            const lat = parseFloat(item.위도);
            const lng = parseFloat(item.경도);
            
            if (!isNaN(lat) && !isNaN(lng)) {
                bounds.extend(new kakao.maps.LatLng(lat, lng));
                hasValidBounds = true;
            }
        }
    });
    
    if (hasValidBounds) {
        map.setBounds(bounds);
    }
}

function fitMapBounds() {
    if (appData.filteredData.length > 0) {
        fitMapToFilteredData();
    } else {
        map.setCenter(new kakao.maps.LatLng(APP_CONFIG.MAP_CONFIG.CENTER_LAT, APP_CONFIG.MAP_CONFIG.CENTER_LNG));
        map.setLevel(APP_CONFIG.MAP_CONFIG.INITIAL_LEVEL);
    }
}

function toggleBoundaryLayer() {
    isLayerVisible = !isLayerVisible;
    elements.toggleLayerBtn.textContent = isLayerVisible ? '구역표시 OFF' : '구역표시 ON';
    
    if (isLayerVisible) {
        displayBoundaries();
    } else {
        clearMapOverlays();
    }
}

function closeDetailPanel() {
    elements.detailPanel.classList.remove('show');
    elements.detailPanel.setAttribute('aria-hidden', 'true');
    appData.selectedRegion = null;
    
    if (currentSelectedOverlay) {
        currentSelectedOverlay.setMap(null);
        currentSelectedOverlay = null;
    }
}

function initializeDetailPanel() {
    if (elements.detailPanel) {
        elements.detailPanel.classList.remove('show');
        elements.detailPanel.setAttribute('aria-hidden', 'true');
        elements.detailContent.innerHTML = '<p class="detail-placeholder">지도에서 마커나 지역을 클릭하세요.</p>';
        
        // 선택된 지역 정보도 초기화
        appData.selectedRegion = null;
        
        // 기존 오버레이가 있다면 제거
        if (currentSelectedOverlay) {
            currentSelectedOverlay.setMap(null);
            currentSelectedOverlay = null;
        }
    }
    
    // 필터도 함께 초기화 (담당 영업사원 드롭다운 포함)
    initializeAllFilters();
}

function initializeAllFilters() {
    try {
        console.log('필터 강제 초기화 시작...');
        
        // 모든 필터 값 초기화
        if (elements.branchOfficeSelect) {
            elements.branchOfficeSelect.value = '';
            elements.branchOfficeSelect.selectedIndex = 0;
        }
        if (elements.branchSelect) {
            elements.branchSelect.value = '';
            elements.branchSelect.selectedIndex = 0;
        }
        
        // 선택된 담당자 배열 강제 초기화
        selectedSalespeople.length = 0; // 배열 완전 비우기
        console.log('selectedSalespeople 배열 초기화됨:', selectedSalespeople);
        
        // 담당자 드롭다운 체크박스 모두 해제 (강제)
        if (elements.salesPersonDropdown) {
            const dropdownContent = elements.salesPersonDropdown.querySelector('.dropdown-content');
            if (dropdownContent) {
                const checkboxes = dropdownContent.querySelectorAll('input[type="checkbox"]');
                console.log(`체크박스 ${checkboxes.length}개 발견, 모두 해제 중...`);
                
                if (checkboxes.length > 0) {
                    checkboxes.forEach((checkbox, index) => {
                        if (checkbox.checked) {
                            console.log(`체크박스 ${index} 해제: ${checkbox.value}`);
                        }
                        checkbox.checked = false;
                        checkbox.removeAttribute('checked');
                        
                        // 이벤트 리스너를 통해 상태 업데이트
                        checkbox.dispatchEvent(new Event('change'));
                    });
                } else {
                    console.log('체크박스가 아직 생성되지 않음. 나중에 재시도...');
                    // 체크박스가 생성된 후 다시 시도
                    setTimeout(() => {
                        initializeAllFilters();
                    }, 500);
                    return;
                }
            }
            
            // 드롭다운 텍스트 강제 초기화
            const button = elements.salesPersonDropdown.querySelector('.dropdown-button');
            if (button) {
                button.innerHTML = '<span>- 선택 -</span> <span class="dropdown-arrow">▼</span>';
                console.log('드롭다운 버튼 텍스트 초기화됨');
            }
            
            // 드롭다운이 열려있으면 닫기
            elements.salesPersonDropdown.classList.remove('active');
        }
        
        console.log('모든 필터 강제 초기화 완료');
        
    } catch (error) {
        console.error('필터 초기화 오류:', error);
    }
}

function forceResetAllFilters() {
    try {
        console.log('🔥 강제 필터 리셋 시작...');
        
        // 로컬스토리지에서 사용자 설정 제거
        userPreferences.clear();
        
        // 모든 전역 변수 초기화
        selectedSalespeople.length = 0;
        
        // 모든 체크박스를 DOM에서 직접 찾아서 해제
        const allCheckboxes = document.querySelectorAll('#salesPersonDropdown input[type="checkbox"]');
        console.log(`전체 페이지에서 ${allCheckboxes.length}개 체크박스 발견`);
        
        allCheckboxes.forEach((checkbox, index) => {
            if (checkbox.checked) {
                console.log(`🔥 강제 해제 - 체크박스 ${index}: ${checkbox.value}`);
            }
            checkbox.checked = false;
            checkbox.removeAttribute('checked');
            checkbox.setAttribute('autocomplete', 'off');
        });
        
        // Select 요소들 초기화
        const selects = document.querySelectorAll('#branchOfficeSelect, #branchSelect');
        selects.forEach(select => {
            select.value = '';
            select.selectedIndex = 0;
        });
        
        // 드롭다운 버튼 텍스트 강제 초기화
        const dropdownButton = document.querySelector('#salesPersonDropdown .dropdown-button');
        if (dropdownButton) {
            dropdownButton.innerHTML = '<span>- 선택 -</span> <span class="dropdown-arrow">▼</span>';
            console.log('🔥 드롭다운 버튼 강제 초기화 완료');
        }
        
        // 드롭다운 닫기
        const dropdown = document.getElementById('salesPersonDropdown');
        if (dropdown) {
            dropdown.classList.remove('active');
        }
        
        // 구역 표시도 강제 초기화 (OFF 상태로)
        isLayerVisible = false;
        const toggleBtn = document.getElementById('toggleLayerBtn');
        if (toggleBtn) {
            toggleBtn.textContent = '👁️ 구역표시 ON';
        }
        
        console.log('🔥 강제 필터 리셋 완료!');
        
    } catch (error) {
        console.error('강제 필터 리셋 오류:', error);
    }
}

// ===============================
// 통계 및 범례 함수들
// ===============================

function updateStatistics() {
    try {
        console.log('통계 업데이트 시작');
        
        const statsData = appData.filteredData || [];
        
        const totalStores = statsData.length;
        
        // NULL 값을 포함한 담당자 수 계산
        const allSalespeople = statsData.map(item => item['담당 영업사원']);
        const uniqueSalespeople = new Set(
            allSalespeople.filter(name => name && name.trim() !== '' && name !== 'undefined' && name !== 'null')
        ).size;
        const nullSalespeople = allSalespeople.filter(name => !name || name.trim() === '' || name === 'null').length;
        
        const uniqueBranches = new Set();
        
        statsData.forEach(item => {
            let branchName = null;
            
            if (item.salesInfo && item.salesInfo.지점) {
                branchName = item.salesInfo.지점;
            } 
            else if (item['지점/팀']) {
                branchName = item['지점/팀'];
            }
            else if (item['지점']) {
                branchName = item['지점'];
            }
            
            if (branchName && branchName.trim() !== '' && branchName !== 'undefined' && branchName !== 'null') {
                uniqueBranches.add(branchName.trim());
            }
        });
        
        if (elements.totalRegions) {
            elements.totalRegions.textContent = totalStores.toLocaleString();
        }
        if (elements.totalSalespeople) {
            // NULL 값이 있으면 표시
            if (nullSalespeople > 0) {
                elements.totalSalespeople.textContent = `${uniqueSalespeople.toLocaleString()} (+${nullSalespeople} 미배정)`;
            } else {
                elements.totalSalespeople.textContent = uniqueSalespeople.toLocaleString();
            }
        }
        if (elements.totalBranches) {
            elements.totalBranches.textContent = uniqueBranches.size.toLocaleString();
        }
        
        updateColorLegend();
        updateFilterStatus();
        
        console.log(`📊 통계 업데이트 완료: 거래처 ${totalStores}개, 담당자 ${uniqueSalespeople}명 (미배정 ${nullSalespeople}개), 지점 ${uniqueBranches.size}개`);
        console.log(`📊 필터 상태: 지사(${elements.branchOfficeSelect?.value || '전체'}), 지점(${elements.branchSelect?.value || '전체'}), 담당자(${selectedSalespeople.length}명 선택)`);
        
    } catch (error) {
        console.error('통계 업데이트 오류:', error);
        if (elements.totalRegions) elements.totalRegions.textContent = '0';
        if (elements.totalSalespeople) elements.totalSalespeople.textContent = '0';
        if (elements.totalBranches) elements.totalBranches.textContent = '0';
    }
}

function updateFilterStatus() {
    const filterStatusElement = document.getElementById('filterStatus');
    if (!filterStatusElement) return;
    
    const selectedBranch = elements.branchOfficeSelect?.value;
    const selectedOffice = elements.branchSelect?.value;
    const selectedSalespeopleCount = selectedSalespeople.length;
    
    let statusText = '';
    const filters = [];
    
    if (selectedBranch) {
        filters.push(`지사: ${selectedBranch}`);
    }
    
    if (selectedOffice) {
        filters.push(`지점: ${selectedOffice}`);
    }
    
    if (selectedSalespeopleCount > 0) {
        if (selectedSalespeopleCount === 1) {
            filters.push(`담당자: ${selectedSalespeople[0]}`);
        } else {
            filters.push(`담당자: ${selectedSalespeopleCount}명 선택`);
        }
    }
    
    if (filters.length === 0) {
        statusText = '전체 데이터 (NULL 포함)';
    } else {
        statusText = filters.join(', ');
    }
    
    filterStatusElement.textContent = statusText;
}

function updateColorLegend() {
    const colorLegendContainer = document.getElementById('colorLegend');
    if (!colorLegendContainer) return;
    
    const uniqueSalespeople = [...new Set(appData.filteredData.map(item => item['담당 영업사원']))];
    
    if (uniqueSalespeople.length === 0) {
        colorLegendContainer.innerHTML = '<p class="legend-note">담당 영업사원을 선택하면 색상이 표시됩니다.</p>';
        return;
    }
    
    const maxDisplayItems = 20;
    const totalCount = uniqueSalespeople.length;
    const displayCount = showAllLegendItems ? totalCount : Math.min(maxDisplayItems, totalCount);
    
    let legendItems = '';
    
    uniqueSalespeople.slice(0, displayCount).forEach(salesperson => {
        const color = getAccessibleSalespersonColor(salesperson);
        legendItems += `
            <div class="legend-item">
                <div class="legend-color" style="background-color: ${color};"></div>
                <span>${salesperson}</span>
            </div>
        `;
    });
    
    let moreButton = '';
    if (totalCount > maxDisplayItems) {
        if (!showAllLegendItems) {
            moreButton = `
                <div class="legend-more-container">
                    <p class="legend-note">+${totalCount - maxDisplayItems}명 더 있음</p>
                    <p class="legend-more-link" onclick="toggleLegendDisplay()" style="cursor: pointer; color: #667eea; text-decoration: underline; margin: 10px 0; text-align: center;">
                        전체 보기
                    </p>
                </div>
            `;
        } else {
            moreButton = `
                <div class="legend-more-container">
                    <p class="legend-more-link" onclick="toggleLegendDisplay()" style="cursor: pointer; color: #667eea; text-decoration: underline; margin: 10px 0; text-align: center;">
                        접기
                    </p>
                </div>
            `;
        }
    }
    
    colorLegendContainer.innerHTML = `
        <div class="legend-scroll-container" style="max-height: ${showAllLegendItems ? '400px' : '300px'}; overflow-y: auto;">
            ${legendItems}
        </div>
        ${moreButton}
    `;
}

function toggleLegendDisplay() {
    showAllLegendItems = !showAllLegendItems;
    updateColorLegend();
}

// ===============================
// 수정 기록 관리 함수들
// ===============================

function addEditHistoryButton() {
    const mapControls = document.querySelector('.map-controls');
    if (mapControls && !document.getElementById('editHistoryBtn')) {
        const editHistoryBtn = document.createElement('button');
        editHistoryBtn.id = 'editHistoryBtn';
        editHistoryBtn.className = 'btn btn-outline';
        editHistoryBtn.innerHTML = '📋 수정기록';
        editHistoryBtn.title = '담당자 수정 기록 조회';
        
        editHistoryBtn.addEventListener('click', showEditHistoryModal);
        
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            mapControls.insertBefore(editHistoryBtn, exportBtn.nextSibling);
        } else {
            mapControls.appendChild(editHistoryBtn);
        }
    }
}

function showEditHistoryModal() {
    if (!salespersonEditManager) {
        notificationManager.warning('담당자 수정 기능이 초기화되지 않았습니다.');
        return;
    }

    const history = salespersonEditManager.getEditHistory();
    
    if (history.length === 0) {
        notificationManager.info('수정 기록이 없습니다.');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal edit-history-modal';
    modal.style.display = 'flex';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-labelledby', 'historyModalTitle');

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px; width: 90%; max-height: 80vh;">
            <div class="modal-header">
                <h3 id="historyModalTitle">📋 담당자 수정 기록</h3>
                <button class="btn-close" onclick="closeEditHistoryModal()">&times;</button>
            </div>
            <div class="modal-body" style="overflow-y: auto;">
                <div class="history-controls" style="margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #666; font-size: 14px;">총 ${history.length}건의 수정 기록</span>
                    <button class="btn btn-outline" onclick="exportEditHistory()" style="padding: 6px 12px; font-size: 12px;">
                        📥 내보내기
                    </button>
                </div>
                <div class="history-list">
                    ${history.map((record, index) => `
                        <div class="history-item" style="
                            border: 1px solid #e0e6ed; 
                            border-radius: 8px; 
                            padding: 15px; 
                            margin-bottom: 12px;
                            background: ${index % 2 === 0 ? '#f8f9fa' : 'white'};
                        ">
                            <div class="history-header" style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                                <div>
                                    <strong style="color: #2c3e50;">${record.storeName}</strong>
                                    <span style="font-family: monospace; font-size: 11px; color: #667eea; margin-left: 10px;">
                                        ${record.storeCode || record.storeId || ''}
                                    </span>
                                </div>
                                <span style="color: #7f8c8d; font-size: 12px;">
                                    ${new Date(record.timestamp).toLocaleString('ko-KR')}
                                </span>
                            </div>
                            ${record.businessNumber ? `
                                <div style="font-size: 12px; color: #95a5a6; margin-bottom: 8px;">
                                    사업자번호: ${record.businessNumber}
                                </div>
                            ` : ''}
                            <div class="history-changes" style="margin-bottom: 10px;">
                                ${record.changes.담당사번.before !== record.changes.담당사번.after ? `
                                    <div style="font-size: 13px; margin-bottom: 4px;">
                                        <span style="color: #666;">담당 사번:</span>
                                        <span style="color: #e74c3c; text-decoration: line-through;">${record.changes.담당사번.before || '미배정'}</span>
                                        →
                                        <span style="color: #27ae60; font-weight: 600;">${record.changes.담당사번.after || '미배정'}</span>
                                    </div>
                                ` : ''}
                                ${record.changes.담당영업사원.before !== record.changes.담당영업사원.after ? `
                                    <div style="font-size: 13px; margin-bottom: 4px;">
                                        <span style="color: #666;">담당 영업사원:</span>
                                        <span style="color: #e74c3c; text-decoration: line-through;">${record.changes.담당영업사원.before || '미배정'}</span>
                                        →
                                        <span style="color: #27ae60; font-weight: 600;">${record.changes.담당영업사원.after || '미배정'}</span>
                                    </div>
                                ` : ''}
                            </div>
                            ${record.reason ? `
                                <div style="font-size: 12px; color: #3498db; margin-bottom: 5px;">
                                    <strong>사유:</strong> ${record.reason}
                                </div>
                            ` : ''}
                            ${record.note ? `
                                <div style="font-size: 12px; color: #7f8c8d;">
                                    <strong>메모:</strong> ${record.note}
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeEditHistoryModal()">닫기</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    window.closeEditHistoryModal = function() {
        document.body.removeChild(modal);
        delete window.closeEditHistoryModal;
        delete window.exportEditHistory;
    };

    window.exportEditHistory = function() {
        salespersonEditManager.exportEditHistory();
    };
}

function loadEditHistory() {
    if (salespersonEditManager) {
        try {
            const savedHistory = localStorage.getItem('salespersonEditHistory');
            if (savedHistory) {
                const history = JSON.parse(savedHistory);
                salespersonEditManager.editHistory = history;
                console.log(`수정 기록 로드 완료: ${history.length}건`);
            }
        } catch (error) {
            console.warn('수정 기록 로드 실패:', error);
        }
    }
}

// ===============================
// 유틸리티 함수들
// ===============================

function showLoading(show) {
    if (elements.loadingOverlay) {
        if (show) {
            elements.loadingOverlay.classList.remove('hidden');
        } else {
            elements.loadingOverlay.classList.add('hidden');
        }
    }
}

function showError(message) {
    console.error('에러 발생:', message);
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-notification';
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #e74c3c;
        color: white;
        padding: 15px 20px;
        border-radius: 5px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        max-width: 400px;
        word-wrap: break-word;
    `;
    errorDiv.innerHTML = `
        <strong>⚠️ 오류 발생</strong><br>
        ${message}
        <button onclick="this.parentElement.remove()" style="
            background: none;
            border: none;
            color: white;
            float: right;
            cursor: pointer;
            font-size: 18px;
            margin-left: 10px;
        ">×</button>
    `;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        if (errorDiv.parentElement) {
            errorDiv.remove();
        }
    }, 5000);
}

// ===============================
// 전역 함수들 (HTML에서 호출용)
// ===============================

window.onSalesPersonCheckboxChange = onSalesPersonCheckboxChange;
window.toggleLegendDisplay = toggleLegendDisplay;
window.closeMarkerOverlay = closeMarkerOverlay;

// ===============================
// 전역 에러 핸들러
// ===============================

window.addEventListener('error', function(e) {
    console.error('JavaScript 에러:', e.error);
    showError(`애플리케이션에서 오류가 발생했습니다: ${e.message}`);
});

window.addEventListener('beforeunload', function() {
    eventManager.removeAllListeners();
    
    clearMapOverlays();
    clearMarkers();
    
    if (currentSelectedOverlay) {
        currentSelectedOverlay.setMap(null);
        currentSelectedOverlay = null;
    }
    
    colorCache.clear();
    
    console.log('리소스 정리 완료');
});

// ===============================
// 디버깅 유틸리티
// ===============================

window.checkStats = function() {
    console.group('📊 현재 통계 상태');
    
    const displayedStats = {
        거래처수: elements.totalRegions?.textContent || '0',
        담당자수: elements.totalSalespeople?.textContent || '0', 
        지점수: elements.totalBranches?.textContent || '0'
    };
    
    console.log('📈 화면에 표시된 통계:', displayedStats);
    
    const actualStats = calculateActualStats();
    console.log('🔢 실제 계산된 통계:', actualStats);
    
    const mismatches = [];
    if (displayedStats.거래처수 !== actualStats.거래처수.toString()) {
        mismatches.push(`거래처수: 표시(${displayedStats.거래처수}) vs 실제(${actualStats.거래처수})`);
    }
    if (displayedStats.담당자수 !== actualStats.담당자수.toString()) {
        mismatches.push(`담당자수: 표시(${displayedStats.담당자수}) vs 실제(${actualStats.담당자수})`);
    }
    if (displayedStats.지점수 !== actualStats.지점수.toString()) {
        mismatches.push(`지점수: 표시(${displayedStats.지점수}) vs 실제(${actualStats.지점수})`);
    }
    
    if (mismatches.length > 0) {
        console.warn('⚠️ 불일치 발견:', mismatches);
    } else {
        console.log('✅ 모든 통계가 일치합니다');
    }
    
    console.groupEnd();
};

function calculateActualStats() {
    const statsData = appData.filteredData || [];
    
    const 거래처수 = statsData.length;
    
    const 담당자수 = new Set(
        statsData
            .map(item => item['담당 영업사원'])
            .filter(name => name && name.trim() !== '')
    ).size;
    
    const uniqueBranches = new Set();
    statsData.forEach(item => {
        let branchName = null;
        if (item.salesInfo?.지점) branchName = item.salesInfo.지점;
        else if (item['지점/팀']) branchName = item['지점/팀'];
        else if (item['지점']) branchName = item['지점'];
        
        if (branchName && branchName.trim() !== '') {
            uniqueBranches.add(branchName.trim());
        }
    });
    
    const 지점수 = uniqueBranches.size;
    
    return { 거래처수, 담당자수, 지점수 };
}

window.checkDataQuality = function() {
    console.group('🔍 데이터 품질 체크');
    
    const total = appData.joinedData.length;
    const withSalesInfo = appData.joinedData.filter(item => item.salesInfo).length;
    const withoutSalesInfo = total - withSalesInfo;
    
    console.log(`📊 전체 거래처: ${total}개`);
    console.log(`✅ 영업정보 매칭: ${withSalesInfo}개 (${(withSalesInfo/total*100).toFixed(1)}%)`);
    console.log(`❌ 영업정보 미매칭: ${withoutSalesInfo}개 (${(withoutSalesInfo/total*100).toFixed(1)}%)`);
    
    const withCoords = appData.joinedData.filter(item => {
        const lat = parseFloat(item.위도);
        const lng = parseFloat(item.경도);
        return !isNaN(lat) && !isNaN(lng);
    }).length;
    
    console.log(`📍 좌표정보 유효: ${withCoords}개 (${(withCoords/total*100).toFixed(1)}%)`);
    
    const withSalesperson = appData.joinedData.filter(item => 
        item['담당 영업사원'] && item['담당 영업사원'].trim() !== ''
    ).length;
    
    console.log(`👤 담당자정보 유효: ${withSalesperson}개 (${(withSalesperson/total*100).toFixed(1)}%)`);
    
    if (withSalesInfo / total < 0.8) {
        console.warn('⚠️ 영업정보 매칭률이 80% 미만입니다. 데이터 조인 로직을 확인해주세요.');
    }
    
    if (withCoords / total < 0.9) {
        console.warn('⚠️ 좌표정보 유효률이 90% 미만입니다. 주소 데이터를 확인해주세요.');
    }
    
    console.groupEnd();
};

window.checkFilters = function() {
    console.group('🔧 필터 상태 체크');
    
    console.log('현재 필터 설정:');
    console.log(`- 지사: ${elements.branchOfficeSelect?.value || '전체'}`);
    console.log(`- 지점: ${elements.branchSelect?.value || '전체'}`);
    console.log(`- 담당자: ${selectedSalespeople.length > 0 ? selectedSalespeople.join(', ') : '전체'}`);
    
    console.log(`\n필터링된 데이터: ${appData.filteredData.length}개`);
    console.log(`전체 데이터: ${appData.joinedData.length}개`);
    console.log(`필터링 비율: ${(appData.filteredData.length / appData.joinedData.length * 100).toFixed(1)}%`);
    
    console.groupEnd();
};

window.forceUpdateStats = function() {
    console.log('🔄 통계를 수동으로 업데이트합니다...');
    updateStatistics();
    console.log('✅ 통계 업데이트 완료');
};

window.fullDebug = function() {
    console.clear();
    console.log('🔍 영업 담당 상권 조회 시스템 - 전체 디버깅 정보');
    window.checkDataQuality();
    window.checkFilters(); 
    window.checkStats();
    
    console.group('⚙️ 시스템 상태');
    console.log('마커 개수:', markers.length);
    console.log('경계 오버레이 개수:', boundaryOverlays.length);
    console.log('색상 캐시 크기:', colorCache.size);
    console.log('담당자 수정 기능:', salespersonEditManager ? '활성화' : '비활성화');
    console.log('수정 기록 개수:', salespersonEditManager ? salespersonEditManager.getEditHistory().length : 0);
    console.groupEnd();
};

console.log('🛠️ 디버깅 유틸리티가 로드되었습니다!');
console.log('사용 가능한 함수들:');
console.log('- window.checkStats() : 통계 상태 체크');
console.log('- window.checkDataQuality() : 데이터 품질 체크');  
console.log('- window.checkFilters() : 필터 상태 체크');
console.log('- window.forceUpdateStats() : 수동 통계 업데이트');
console.log('- window.fullDebug() : 전체 디버깅 정보 출력');

// ===============================
// 완료 메시지
// ===============================

console.log(`
🎉 완전한 영업 담당 상권 조회 시스템이 로드되었습니다!

✨ 포함된 기능:
📊 기본 기능:
- 영업 구역 지도 표시
- 거래처 마커 표시 (RTM 채널별 모양)
- 담당자별 색상 구분
- 다중 필터링 (지사, 지점, 담당자)
- 실시간 통계
- 행정구역 경계 표시

✏️ 담당자 수정 기능:
- 마커 클릭 시 담당자 수정 모달
- 실시간 유효성 검증
- 자동완성 및 자동 매칭
- 수정 기록 관리
- 변경 사항 미리보기
- CSV 수정 기록 내보내기

🎯 사용법:
1. 필터 설정 후 '📋 필터 적용' 클릭
2. 지도에서 거래처 마커 클릭
3. '✏️ 담당자 수정' 버튼으로 정보 수정
4. '📋 수정기록' 버튼으로 변경 이력 확인

🔧 디버깅:
window.fullDebug() 실행으로 전체 상태 확인 가능
`);
