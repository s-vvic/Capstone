> Shared backend environment names and deployment dependency: [shared/README.md](../shared/README.md)

# SecureCam - Component 3: Event Ingestion & Push Notification Engine

> **컴포넌트 3:** 이벤트 수집 & Push 알림 중계 모듈  
> **적용 기준:** `SPEC/ICD_v2.md` (2.3, 2.7, 3.3, 6.0/ICD-07, 7.1.3), `SPEC/FR/SV_F.md` (3.2.3), `SPEC/FR/WEB_F.md` (3.6.4, 3.6.10), `SPEC/FR/APP_F.md` (3.5.4, 3.5.8), `SPEC/NFR/*` (NF-P-002, NF-S-001, NF-F-001)  
> **개발 스택:** Node.js 24.11 / Express.js (ESM), PostgreSQL 17.X (In-Memory Dual Driver 지원)

---

## 1. 개요 및 주요 기능

본 모듈은 SecureCam 시스템의 **이벤트 수집 및 실시간 푸시 알림 중계**를 전담하는 핵심 독립 백엔드 컴포넌트입니다.

1. **보드 이벤트 수신 및 저장 (ICD_v2 3.3, SV-F-020, SV-F-021)**:
   - 웹캠 보드가 감지한 움직임(`motion`), 소리(`sound`), 연결(`connection`), 시스템(`system`) 이벤트를 수신하여 DB에 영속화합니다.
   - `mac_no` 및 `provision_token` 기반의 보드 인증을 검증합니다.
2. **미디어 연계 저장 (ICD_v2 7.1.3, SV-F-024)**:
   - Base64 스냅샷 이미지를 저장하고 `snapshot_url`을 생성하여 이벤트 메타데이터와 결합합니다.
   - 소리 감지 데시벨(`sound_level_db`), 감지 영역(`zone_id`) 등을 기록합니다.
3. **이벤트 상태 및 일괄 확인 처리 (ICD_v2 2.3.2, WEB-F-033, APP-F-034)**:
   - 미확인(`unconfirmed`) 및 확인 완료(`confirmed`) 상태 전환.
   - 중요 이벤트(`is_important`) 플래그 지정 및 메모(`memo`, 최대 500자) 저장.
   - 여러 건의 미확인 이벤트를 한 번에 확인 처리하는 일괄 확인 API(`PATCH /events/batch`) 지원.
4. **사용자별 알림 환경설정 관리 (ICD_v2 2.7, APP-F-070, APP-F-072, WEB-F-091)**:
   - 이벤트 유형별 알림(`motion_alert`, `sound_alert`, `offline_alert`, `reconnect_alert`), 중요 전용(`important_only`), 기기별 개별 알림(`device_alerts`) CRUD 제공.
5. **FCM Push 알림 엔진 및 5초 SLA 보장 (ICD-07, SV-F-023, NF-P-002)**:
   - 이벤트 접수 즉시 사용자 설정 필터링을 거쳐 5초 이내에 FCM HTTP v1 / Push 알림을 발송합니다.
   - 대시보드 연계를 위한 미확인 이벤트 및 오늘 통계 요약(`GET /events/summary`) 제공.

---

## 2. 디렉토리 구조

```plaintext
SourceCode/event-notification/
├── .env.example
├── .gitignore
├── package.json
├── README.md
├── sql/
│   └── schema.sql                        # PostgreSQL 17.X DDL (events, notification_settings)
├── src/
│   ├── config/
│   │   ├── env.js                        # 환경설정 로더
│   │   └── database.js                   # PostgreSQL 연결 풀 매니저
│   ├── constants/
│   │   ├── errorCodes.js                 # ICD 제8장 공통 오류 코드
│   │   └── eventTypes.js                 # 이벤트 유형 및 알림 템플릿 정의
│   ├── errors/
│   │   └── AppError.js                   # 표준화된 예외 클래스
│   ├── utils/
│   │   ├── logger.js                     # 구조화 로거
│   │   ├── snapshotStorage.js            # Base64 이미지 디코딩 및 스토리지 유틸
│   │   └── fcmPayloadBuilder.js          # ICD-07 푸시 알림 페이로드 빌더
│   ├── repositories/
│   │   ├── index.js                      # 저장소 팩토리 및 In-Memory 전환 함수
│   │   ├── inMemoryRepository.js         # 완전 호환 인메모리 저장소
│   │   ├── eventRepository.js            # PostgreSQL 이벤트 저장소
│   │   └── notificationSettingsRepository.js # PostgreSQL 알림 설정 저장소
│   ├── services/
│   │   ├── eventService.js               # 이벤트 수집, 조회, 상태 처리 비즈니스 로직
│   │   ├── notificationSettingsService.js# 알림 설정 조회 및 수정
│   │   └── fcmNotificationService.js     # FCM Push 디스패치 및 5초 SLA 계측
│   ├── middleware/
│   │   ├── authMiddleware.js             # JWT 검증 및 x-user-id 개발 fallback
│   │   ├── validator.js                  # 요청 유효성 검증
│   │   ├── securityMiddleware.js         # Helmet, CORS 설정
│   │   └── errorHandler.js               # ICD 8.0 표준 오류 핸들러
│   ├── controllers/
│   │   ├── boardEventController.js       # 보드 이벤트 보고 엔드포인트
│   │   ├── eventController.js            # 클라이언트 이벤트 관리 엔드포인트
│   │   └── notificationSettingsController.js # 알림 설정 엔드포인트
│   ├── routes/
│   │   ├── index.js                      # 통합 라우터
│   │   ├── boardRoutes.js                # POST /events/report
│   │   ├── eventRoutes.js                # GET/PATCH /events
│   │   └── notificationRoutes.js         # GET/PUT /notifications/settings
│   ├── index.js                          # Express 애플리케이션 팩토리
│   └── server.js                         # 독립 구동 서버 진입점
└── tests/
    ├── eventReport.test.js               # 보드 이벤트 보고 및 인증 테스트 (5개 테스트)
    ├── eventQuery.test.js                # 이벤트 목록/필터/페이징 테스트 (6개 테스트)
    ├── eventStatus.test.js               # 개별 및 일괄 확인 처리 테스트 (5개 테스트)
    ├── notificationSettings.test.js      # 알림 설정 조회 및 수정 테스트 (3개 테스트)
    └── fcmNotification.test.js           # FCM 푸시 페이로드 및 5초 SLA 테스트 (3개 테스트)
```

---

## 3. API 명세 요약

### 3.1 웹캠 보드 ↔ 클라우드 서버 (ICD_v2 3.3)
| 메서드 | 경로 | 설명 | 인증 |
| :--- | :--- | :--- | :--- |
| `POST` | `/events/report` | 보드 감지 이벤트 보고 수신 | `mac_no` + `provision_token` |

### 3.2 앱/웹 클라이언트 ↔ 클라우드 서버 (ICD_v2 2.3, 2.7)
| 메서드 | 경로 | 설명 | 인증 |
| :--- | :--- | :--- | :--- |
| `GET` | `/events` | 조건별 이벤트 목록 조회 (페이징, 필터) | JWT Bearer |
| `PATCH` | `/events/:eventId` | 개별 이벤트 확인 처리, 중요 표시, 메모 저장 | JWT Bearer |
| `PATCH` | `/events/batch` | 미확인 이벤트 다중/일괄 확인 처리 | JWT Bearer |
| `GET` | `/events/summary` | 대시보드용 오늘 이벤트 수 및 미확인 알림 수 요약 | JWT Bearer |
| `GET` | `/notifications/settings` | 사용자 알림 환경설정 조회 | JWT Bearer |
| `PUT` | `/notifications/settings` | 사용자 알림 환경설정 전체 저장 | JWT Bearer |

---

## 4. 실행 및 테스트

```bash
# 의존성 설치
npm install

# 단위 및 통합 테스트 실행 (22개 테스트 통과)
npm test

# 개발 서버 구동 (Watch 모드)
npm run dev

# 프로덕션 서버 구동
npm start
```
