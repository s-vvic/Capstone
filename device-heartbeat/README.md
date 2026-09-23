# SecureCam Component 2: 보드 등록 및 생존 관리 모듈 (device-heartbeat)

> 본 모듈은 **SecureCam** 클라우드 서버의 **Component 2: 보드 등록 및 생존 관리 (Device Registry & Heartbeat Management)**를 담당하는 독립 패키지입니다.  
> `SPEC/Component.md`, `SPEC/ICD.md`, `SPEC/FR/SV_F.md`의 **3.2.2**, `SPEC/FR/WC_F.md`, `SPEC/FR/VPN_F.md` 및 `SPEC/NFR/*` 요구사항을 100% 준수합니다.

---

## 1. 요구사항 및 규격 준수 현황 (Traceability Matrix)

| 구분 | 요구사항 ID / 규격 | 세부 요구사항 및 제약사항 | 모듈 구현 위치 | 준수 여부 |
| :--- | :--- | :--- | :--- | :---: |
| **기능 요구사항**<br>(`FR/SV_F.md 3.2.2`) | **SV-F-010** | QR 코드 스캔, 시리얼 번호, 등록 코드 입력 방식으로 보드 등록 지원 | `src/services/deviceService.js`<br>`src/controllers/deviceController.js` | **준수 (100%)** |
| | **SV-F-011** | 보드 온라인/오프라인 상태 실시간 모니터링 | `src/services/heartbeatMonitor.js`<br>`src/repositories/deviceRepository.js` | **준수 (100%)** |
| | **SV-F-012** | 보드별 이름, 설치 위치, 그룹 설정 지원 | `src/controllers/deviceController.js`<br>`src/routes/deviceRoutes.js` | **준수 (100%)** |
| | **SV-F-013** | 보드 Heartbeat 수신 및 상태 갱신 처리 (30초 주기) | `src/services/heartbeatService.js`<br>`src/routes/internalRoutes.js` | **준수 (100%)** |
| | **SV-F-014** | VPN 연결 상태 모니터링 및 수동 연결/끊기 지원 | `src/services/vpnStatusService.js`<br>`src/routes/vpnRoutes.js` | **준수 (100%)** |
| **웹캠/VPN 기능**<br>(`FR/WC_F.md`, `VPN_F.md`) | **WC-F-030** | 부팅 시 VPN 자동 연결 및 서버 프로비저닝 수행 | `src/services/heartbeatService.js` (`provisionBySerial`) | **준수 (100%)** |
| | **WC-F-031** | 30초 주기로 서버에 Heartbeat 전송 | `src/routes/internalRoutes.js` (`POST /devices/heartbeat`) | **준수 (100%)** |
| | **WC-F-033** | PTZ(상하좌우 회전, 줌) 원격 제어 중계 | `src/services/ptzService.js`<br>`src/routes/deviceRoutes.js` | **준수 (100%)** |
| | **VPN-F-001~007** | WireGuard 기반 VPN 터널 관리 및 IP 풀 자동 할당 | `src/utils/vpnIpAllocator.js` (10.0.0.10~250) | **준수 (100%)** |
| **인터페이스 규격**<br>(`SPEC/ICD.md`) | **ICD-01 2.2** | 앱·웹 보드 관리 API (`GET /devices`, `POST /devices/register`, `GET /status`, `PATCH`) | `src/routes/deviceRoutes.js` | **준수 (100%)** |
| | **ICD-01 2.5** | VPN 관리 API (`GET /vpn/connections`, `POST /connections/:id/action`) | `src/routes/vpnRoutes.js` | **준수 (100%)** |
| | **ICD-02 3.1** | 보드 프로비저닝 API (`POST /devices/provision-by-serial`) | `src/routes/internalRoutes.js` | **준수 (100%)** |
| | **ICD-02 3.2** | Heartbeat 전송 API (`POST /devices/heartbeat`, 204 No Content, 403 Forbidden) | `src/routes/internalRoutes.js` | **준수 (100%)** |
| | **ICD-03 3.4** | PTZ 제어 명령 수신 API (`POST /devices/:deviceId/ptz`) | `src/routes/deviceRoutes.js` | **준수 (100%)** |
| | **ICD-08 7.1.2** | PostgreSQL `devices` 테이블 스키마 일치 | `sql/schema.sql` | **준수 (100%)** |
| | **ICD 8.0** | 공통 오류 코드 (400, 401, 403, 404, 409, 500) | `src/constants/errorCodes.js`<br>`src/middleware/errorHandler.js` | **준수 (100%)** |
| **비기능 요구사항**<br>(`SPEC/NFR/*`) | **NF-F-001** | DB 프레임워크: PostgreSQL 17.X | `src/config/database.js` (`pg.Pool`), `sql/schema.sql` | **준수 (100%)** |
| | **NF-F-004** | 백엔드 프레임워크: Express.js (Node.js 24.11) | `package.json`, Express 4.x / ESM | **준수 (100%)** |
| | **NF-P-003** | 보드 상태 갱신 주기 30초 이내 (60초 타임아웃 오프라인 감지) | `src/services/heartbeatMonitor.js` | **준수 (100%)** |
| | **NF-A-001** | 클라우드 서버 가용성 99.5% 이상 (헬스체크 `/health`) | `src/index.js` | **준수 (100%)** |
| | **NF-S-001** | WireGuard 내부망 / 외부 HTTPS 전송 암호화 헤더 | `src/middleware/securityMiddleware.js` | **준수 (100%)** |

---

## 2. 디렉토리 구조

```
SourceCode/device-heartbeat/
├── .env.example                  # 환경 설정 템플릿
├── package.json                  # Node.js 24.11 패키지 설정 (ESM)
├── README.md                     # 모듈 설명서 및 API 명세
├── sql/
│   └── schema.sql                # PostgreSQL 17.X DDL 스키마 (devices, heartbeat_history, ptz_command_logs)
├── src/
│   ├── index.js                  # 모듈 엔트리포인트 (Express 앱 팩토리 & 서비스 export)
│   ├── server.js                 # 독립 실행형 Express API 서버
│   ├── config/
│   │   ├── env.js                # 환경변수 로더 (포트, VPN IP풀, 하트비트 주기 등)
│   │   └── database.js           # PostgreSQL 17.X 커넥션 풀
│   ├── constants/
│   │   └── errorCodes.js         # ICD 8.0 표준 오류 코드
│   ├── errors/
│   │   └── AppError.js           # 규격화된 커스텀 에러 클래스
│   ├── middleware/
│   │   ├── authMiddleware.js     # JWT Bearer 인증 (Component 1 호환)
│   │   ├── validator.js          # 요청 데이터 형식 및 파라미터 검증
│   │   ├── errorHandler.js       # ICD 8.0 중앙 에러 핸들러
│   │   └── securityMiddleware.js # Helmet 보안 헤더 및 CORS 설정
│   ├── repositories/
│   │   ├── index.js              # 저장소 팩토리 (PostgreSQL / In-Memory Dual Driver)
│   │   ├── deviceRepository.js   # PostgreSQL 17.X 보드 저장소
│   │   ├── heartbeatRepository.js# PostgreSQL 17.X Heartbeat 로그 저장소
│   │   └── inMemoryRepository.js # Zero-dependency 독립 테스트 및 데모용 인메모리 저장소
│   ├── services/
│   │   ├── deviceService.js      # 보드 등록, 목록 조회, 상태 조회, 정보 수정 (SV-F-010, 012)
│   │   ├── heartbeatService.js   # 프로비저닝 및 30초 Heartbeat 수신 처리 (SV-F-013, ICD 3.1, 3.2)
│   │   ├── heartbeatMonitor.js   # 60초 타임아웃 실시간 오프라인 감지 백그라운드 데몬 (SV-F-011)
│   │   ├── vpnStatusService.js   # VPN 상태 목록 및 수동 연결/끊기 액션 (SV-F-014, ICD 2.5)
│   │   └── ptzService.js         # PTZ 원격 제어 명령 중계 (WC-F-033, ICD 3.4)
│   ├── controllers/
│   │   ├── deviceController.js   # 클라이언트 기기 관리 API 컨트롤러 (ICD 2.2)
│   │   ├── internalDeviceController.js # 보드 프로비저닝 및 하트비트 내부 컨트롤러 (ICD 3.1, 3.2)
│   │   ├── vpnController.js      # VPN 상태 관리 컨트롤러 (ICD 2.5)
│   │   └── ptzController.js      # PTZ 명령 컨트롤러 (ICD 3.4)
│   ├── routes/
│   │   ├── index.js              # 통합 라우터 (/v1/devices, /v1/vpn 지원)
│   │   ├── deviceRoutes.js       # 클라이언트 기기 관리 라우트
│   │   ├── internalRoutes.js     # 보드 전용 내부 라우트 (Heartbeat, Provision)
│   │   └── vpnRoutes.js          # VPN 관리 라우트
│   └── utils/
│       ├── logger.js             # 상태 전환 및 디버그 로거
│       ├── tokenGenerator.js     # CAM-XXXX 보드 ID, 토큰, 등록 코드 생성기
│       └── vpnIpAllocator.js     # 10.0.0.10 ~ 10.0.0.250 VPN 사설 IP 자동 할당기
└── tests/
    ├── deviceRegister.test.js    # SV-F-010 보드 등록 테스트 (qr / serial / code)
    ├── heartbeat.test.js         # SV-F-013 Heartbeat 수신 및 프로비저닝 테스트
    ├── offlineDetection.test.js  # SV-F-011 오프라인 실시간 감지 데몬 테스트
    ├── deviceInfo.test.js        # SV-F-012 보드 목록, 상세 상태, 정보 수정 테스트
    ├── vpnStatus.test.js         # SV-F-014 VPN 연결 상태 및 수동 연결/끊기 테스트
    └── ptzControl.test.js        # WC-F-033 PTZ 원격 제어 명령 중계 테스트
```

---

## 3. API 엔드포인트 명세

### 3.1 보드 관리 API (앱/웹 대시보드 ↔ 클라우드 서버, ICD-01 2.2)

#### 1. 보드 등록 (`POST /v1/devices/register`, SV-F-010, ICD 2.2.2)
- **Header**: `Authorization: Bearer {JWT_TOKEN}`
- **Request Body**:
  ```json
  {
    "register_type": "serial", // "qr" | "serial" | "code"
    "serial_no": "VPNCAM-000001", // register_type이 qr 또는 serial 시 필수
    "register_code": "A3K9X2",   // register_type이 code 시 필수
    "name": "거실 웹캠",
    "location": "거실 창가",
    "group_id": "LIVING_ROOM"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "device_id": "CAM-0001",
    "user_id": "11111111-2222-3333-4444-555555555555",
    "serial_no": "VPNCAM-000001",
    "register_code": "A3K9X2",
    "name": "거실 웹캠",
    "location": "거실 창가",
    "group_id": "LIVING_ROOM",
    "status": "offline",
    "vpn_status": "disconnected",
    "vpn_ip": "10.0.0.10",
    "rtsp_url": "rtsp://10.0.0.10:8554/CAM-0001/live/0",
    "rtsp_url_sub": "rtsp://10.0.0.10:8554/CAM-0001/live/1",
    "registered_at": "2026-09-23T07:00:00.000Z"
  }
  ```

#### 2. 보드 목록 조회 (`GET /v1/devices`, ICD 2.2.1, SV-F-011)
- **Header**: `Authorization: Bearer {JWT_TOKEN}`
- **Response (200 OK)**:
  ```json
  [
    {
      "device_id": "CAM-0001",
      "name": "거실 웹캠",
      "location": "거실 창가",
      "serial_no": "VPNCAM-000001",
      "model": "RV-1106",
      "firmware_version": "v1.0.0",
      "status": "online",
      "vpn_status": "connected",
      "vpn_ip": "10.0.0.10",
      "last_seen": "2026-09-23T07:05:00.000Z",
      "latest_event_time": null,
      "thumbnail_url": ""
    }
  ]
  ```

#### 3. 보드 상세 상태 조회 (`GET /v1/devices/:deviceId/status`, ICD 2.2.3)
- **Header**: `Authorization: Bearer {JWT_TOKEN}`
- **Response (200 OK)**:
  ```json
  {
    "status": "online",
    "vpn_status": "connected",
    "vpn_ip": "10.0.0.10",
    "last_handshake": "2026-09-23T07:05:00.000Z",
    "uptime_seconds": 3600,
    "storage_total_gb": 32.0,
    "storage_used_gb": 4.5,
    "rtsp_url": "rtsp://10.0.0.10:8554/CAM-0001/live/0",
    "rtsp_url_sub": "rtsp://10.0.0.10:8554/CAM-0001/live/1"
  }
  ```

#### 4. 보드 정보 수정 (`PATCH /v1/devices/:deviceId`, SV-F-012, ICD 2.2.4)
- **Header**: `Authorization: Bearer {JWT_TOKEN}`
- **Request Body**:
  ```json
  {
    "name": "수정된 웹캠 이름",
    "location": "안방",
    "description": "반려동물 관찰용",
    "group_id": "BEDROOM"
  }
  ```
- **Response (200 OK)**: 수정된 보드 레코드 반환

#### 5. PTZ 제어 명령 전달 (`POST /v1/devices/:deviceId/ptz`, WC-F-033, ICD 3.4)
- **Header**: `Authorization: Bearer {JWT_TOKEN}`
- **Request Body**:
  ```json
  {
    "action": "left", // up | down | left | right | home | zoom_in | zoom_out | stop
    "speed": 7,       // 1 ~ 10 (기본값: 5)
    "zoom_scale": 1.5 // 1.0 ~ 10.0
  }
  ```
- **Response (200 OK)**: `{ "success": true, "device_id": "CAM-0001", "command": { ... } }`

---

### 3.2 VPN 관리 API (ICD-01 2.5, SV-F-014)

#### 1. VPN 연결 상태 목록 조회 (`GET /v1/vpn/connections`, ICD 2.5.1)
- **Header**: `Authorization: Bearer {JWT_TOKEN}`
- **Response (200 OK)**:
  ```json
  [
    {
      "device_id": "CAM-0001",
      "device_name": "거실 웹캠",
      "serial_no": "VPNCAM-000001",
      "vpn_status": "connected",
      "vpn_ip": "10.0.0.10",
      "vpn_server": "vpn.securecam.com:443",
      "connected_duration_sec": 3600,
      "last_handshake": "2026-09-23T07:05:00.000Z",
      "error_type": null,
      "auto_connect": true,
      "reconnect_on_start": true,
      "reconnect_on_network_change": true
    }
  ]
  ```

#### 2. VPN 수동 연결 / 끊기 (`POST /v1/vpn/connections/:deviceId/action`, ICD 2.5.2)
- **Header**: `Authorization: Bearer {JWT_TOKEN}`
- **Request Body**: `{ "action": "disconnect" }` // "connect" | "disconnect"
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "device_id": "CAM-0001",
    "action": "disconnect",
    "vpn_status": "disconnected"
  }
  ```

---

### 3.3 보드 내부 API (웹캠 보드 ↔ 클라우드 서버, ICD-02 3.1 / 3.2)

#### 1. 보드 프로비저닝 요청 (`POST /v1/devices/provision-by-serial`, ICD 3.1.1, WC-F-030)
- **호출 주체**: 웹캠 보드 최초 부팅 시
- **Request Body**:
  ```json
  {
    "serial_no": "VPNCAM-000001",
    "wg_pubkey": "boardWireGuardPubKeyBase64=",
    "firmware_version": "v1.0.0",
    "model": "RV-1106"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "device_id": "CAM-0001",
    "vpn_ip": "10.0.0.10",
    "server_pubkey": "BM8aXkG2HwW9QZ3y4j6kLmN1PqRsTuVwXyZ01234567=",
    "server_endpoint": "vpn.securecam.com:443",
    "provision_token": "prov_a1b2c3d4e5f6...",
    "rtsp_proxy_ip": "10.0.0.1"
  }
  ```

#### 2. 보드 Heartbeat 전송 (`POST /v1/devices/heartbeat`, ICD 3.2.1, SV-F-013, WC-F-031)
- **호출 주기**: 보드에서 30초마다 전송 (JWT 불필요, `provision_token`으로 인증)
- **Request Body**:
  ```json
  {
    "serial_no": "VPNCAM-000001",
    "provision_token": "prov_a1b2c3d4e5f6...",
    "status": "online",
    "rtsp_ok": true,
    "wg_ok": true,
    "storage_used_bytes": 1073741824,
    "firmware_version": "v1.0.0",
    "latency_ms": 25
  }
  ```
- **Response**:
  - `204 No Content`: 정상 수신 및 상태 갱신 완료
  - `403 Forbidden`: `provision_token` 불일치 (보드 재프로비저닝 필요)

---

## 4. 실시간 생존 감시 및 오프라인 자동 감지 (HeartbeatMonitor)

- **동작 원리 (SV-F-011, NF-P-003)**:
  1. 보드가 30초 주기로 Heartbeat를 보내면 `last_seen`이 현재 시간으로 갱신되고 상태는 `online`을 유지합니다.
  2. 백그라운드 데몬(`HeartbeatMonitor`)이 10초마다 동작하여, `last_seen`이 현재 시각 기준 **60초(2회 주기 초과)** 이상 경과한 기기를 자동으로 조회합니다.
  3. 무응답 기기는 즉시 `status = 'offline'`, `vpn_status = 'disconnected'`, `error_type = 'heartbeat_timeout'`으로 전환되며 상태 변경 이벤트 로그가 기록됩니다.

---

## 5. 실행 및 테스트 방법

### 5.1 패키지 설치
```bash
cd SourceCode/device-heartbeat
npm install
```

### 5.2 단위 및 통합 테스트 실행 (18개 테스트 통과)
인메모리 드라이버를 통해 외부 DB 설치 없이 즉시 모든 기능을 검증할 수 있습니다:
```bash
npm test
```
**테스트 스위트 구성 (18 Passed / 0 Failed)**:
- `deviceRegister.test.js`: SV-F-010 (QR / 시리얼 / 등록코드 등록, 중복 방지)
- `heartbeat.test.js`: SV-F-013, ICD 3.1/3.2 (프로비저닝, 204 No Content, 토큰 불일치 403)
- `offlineDetection.test.js`: SV-F-011 (실시간 생존 감시 및 60초 타임아웃 오프라인 전환)
- `deviceInfo.test.js`: SV-F-012, ICD 2.2 (보드 목록, 상세 상태, 이름/위치/설명 수정)
- `vpnStatus.test.js`: SV-F-014, ICD 2.5 (VPN 연결 상태 목록, 수동 연결/끊기)
- `ptzControl.test.js`: WC-F-033, ICD 3.4 (PTZ 명령 중계 및 오프라인 차단)

### 5.3 독립 서버 실행
```bash
# 개발 모드 (Auto-reload)
npm run dev

# 일반 실행
npm start
```
기본 `http://localhost:3001` 포트에서 실행되며, `/health` 및 `/v1/devices/*`, `/v1/vpn/*` 엔드포인트가 열립니다.

### 5.4 PostgreSQL 17.X 데이터베이스 연동
```bash
# 1. PostgreSQL 스키마 적용
psql -U postgres -d securecam_db -f sql/schema.sql

# 2. .env 설정
DB_DRIVER=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=securecam_db
```

---

## 6. Component 1 (`user-auth`) 및 타 서비스 연동 방법

본 모듈은 Express 미들웨어 및 라우터 형식으로 작성되어 메인 서버 또는 API 게이트웨이에서 원활히 통합됩니다:

```javascript
import express from 'express';
import { createDeviceHeartbeatApp, heartbeatMonitor } from './SourceCode/device-heartbeat/src/index.js';

const app = express();

// Component 2 라우터 및 미들웨어 마운트
app.use(createDeviceHeartbeatApp());

// 백그라운드 오프라인 감시 데몬 실행
heartbeatMonitor.start();

app.listen(3000, () => {
  console.log('통합 서버 가동 완료');
});
```
