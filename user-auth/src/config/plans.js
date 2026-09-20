/**
 * 구독 플랜 정책 정의 (SV-F-005, NF-P-005, SV-F-032, SV-F-033)
 * Basic / Standard / Premium 플랜별 차등 기준
 */
export const SUBSCRIPTION_PLANS = {
  BASIC: 'basic',
  STANDARD: 'standard',
  PREMIUM: 'premium',
};

export const PLAN_TIERS = {
  [SUBSCRIPTION_PLANS.BASIC]: {
    name: 'Basic',
    code: 'basic',
    level: 1,
    description: '단일 사용자 및 소규모 기본 모니터링 플랜',
    maxConcurrentSessions: 1, // NF-P-005: 동시 접속 가능 세션 수
    maxDevices: 2,           // 최대 등록 가능 웹캠 보드 수
    storageQuotaGb: 5,       // SV-F-032: 클라우드 저장 용량 (5GB)
    retentionDays: 7,        // SV-F-033: 오래된 파일 자동 삭제 보관 일수 (7일)
    maxPrivacyZonesPerDevice: 3, // 보드당 프라이버시 존 최대 개수
    liveStreamQuality: '720p',  // 지원 스트리밍 해상도
    features: {
      motionDetection: true,
      soundDetection: false,
      aiAlerts: false,
      ptzControl: false,
      cloudExport: false,
      prioritySupport: false,
    },
  },
  [SUBSCRIPTION_PLANS.STANDARD]: {
    name: 'Standard',
    code: 'standard',
    level: 2,
    description: '가정 및 소호(SOHO) 사업장을 위한 표준 보안 플랜',
    maxConcurrentSessions: 3, // NF-P-005: 동시 접속 가능 세션 수
    maxDevices: 5,           // 최대 등록 가능 웹캠 보드 수
    storageQuotaGb: 30,      // SV-F-032: 클라우드 저장 용량 (30GB)
    retentionDays: 30,       // SV-F-033: 보관 일수 (30일)
    maxPrivacyZonesPerDevice: 10,
    liveStreamQuality: '1080p',
    features: {
      motionDetection: true,
      soundDetection: true,
      aiAlerts: false,
      ptzControl: true,
      cloudExport: true,
      prioritySupport: false,
    },
  },
  [SUBSCRIPTION_PLANS.PREMIUM]: {
    name: 'Premium',
    code: 'premium',
    level: 3,
    description: '기업 및 다채널 관제를 위한 고성능 프리미엄 플랜',
    maxConcurrentSessions: 10, // NF-P-005: 동시 접속 가능 세션 수
    maxDevices: 16,           // 최대 등록 가능 웹캠 보드 수 (WEB-F-010 16채널 지원)
    storageQuotaGb: 100,      // SV-F-032: 클라우드 저장 용량 (100GB)
    retentionDays: 90,        // SV-F-033: 보관 일수 (90일)
    maxPrivacyZonesPerDevice: 20, // ICD 2.6.2 (보드 1개당 최대 20개)
    liveStreamQuality: '1080p@60fps',
    features: {
      motionDetection: true,
      soundDetection: true,
      aiAlerts: true,          // NF-S-005 이상 감지 알림
      ptzControl: true,
      cloudExport: true,
      prioritySupport: true,
    },
  },
};

/**
 * 플랜 코드 유효성 검사
 */
export function isValidPlan(planCode) {
  return Object.values(SUBSCRIPTION_PLANS).includes(planCode);
}

/**
 * 플랜 정보 조회 (기본값 basic)
 */
export function getPlanDetails(planCode) {
  return PLAN_TIERS[planCode] || PLAN_TIERS[SUBSCRIPTION_PLANS.BASIC];
}

/**
 * 플랜 등급 비교 (requiredLevel 이상인지 확인)
 */
export function hasRequiredPlanLevel(currentPlanCode, requiredPlanCode) {
  const current = getPlanDetails(currentPlanCode);
  const required = getPlanDetails(requiredPlanCode);
  return current.level >= required.level;
}
