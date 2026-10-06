// SV-F-032 플랜별 저장 용량 · 보관 기간 (Component.md 기준)
// 1 GiB = 1024 × 1024 × 1024 바이트
const GiB = 1024 ** 3;

export const PLAN_LIMITS = Object.freeze({
  basic:    { quotaBytes: 5 * GiB,   retentionDays: 7 },
  standard: { quotaBytes: 30 * GiB,  retentionDays: 30 },
  premium:  { quotaBytes: 100 * GiB, retentionDays: 90 },
});