// 구독 / 결제 수단 / 저장소 목업 데이터 (서버 연결 전 시연용)

export const subscriptionPlans = [
  {
    id: "basic",
    name: "Basic",
    price: 9900,
    maxCameras: 4,
    storageGb: 50,
    retentionDays: 7,
    features: ["카메라 최대 4대", "클라우드 50GB", "보관 7일"],
  },
  {
    id: "standard",
    name: "Standard",
    price: 19900,
    maxCameras: 16,
    storageGb: 200,
    retentionDays: 30,
    features: ["카메라 최대 16대", "클라우드 200GB", "보관 30일", "이벤트 영상 다운로드"],
  },
  {
    id: "premium",
    name: "Premium",
    price: 39900,
    maxCameras: 64,
    storageGb: 1000,
    retentionDays: 90,
    features: ["카메라 최대 64대", "클라우드 1TB", "보관 90일", "통계 리포트 다운로드", "우선 기술 지원"],
  },
];

// 카드 번호 전체는 저장하지 않고 마지막 4자리만 표시
export const initialPaymentMethods = [
  {
    id: "pm-1",
    type: "card",
    brand: "VISA",
    last4: "4242",
    expiry: "12/28",
    isDefault: true,
  },
  {
    id: "pm-2",
    type: "card",
    brand: "Mastercard",
    last4: "5100",
    expiry: "03/27",
    isDefault: false,
  },
];

export const initialStorageSettings = {
  autoSave: true,
  saveMode: "event", // event | continuous
  quality: "high", // low | medium | high
  retentionDays: 30,
  overwriteWhenFull: true,
  usage: {
    totalGb: 200,
    usedGb: 128.4,
    byType: [
      { key: "event", label: "이벤트 영상", gb: 86.2 },
      { key: "continuous", label: "상시 녹화", gb: 34.7 },
      { key: "snapshot", label: "스냅샷", gb: 7.5 },
    ],
  },
};
