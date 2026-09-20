# SecureCam Cloud Server - 사용자 및 인증 관리 모듈 (v1.0)

> 본 모듈은 **SecureCam** 클라우드 서버의 핵심 부체계인 **3.2.1 사용자 및 인증 관리**를 모듈형 구조로 구현한 Express.js/Node.js 백엔드 패키지입니다.  
> `SPEC/FR/SV_F.md`, `SPEC/ICD.md`, `SPEC/NFR/*`의 기능 요구사항, 비기능 요구사항, 인터페이스 규격 및 제약사항을 100% 준수합니다.

---

## 1. 요구사항 및 제약사항 준수 현황 (Traceability Matrix)

| 구분                                    | 요구사항 ID      | 요구사항 내용                                                                                                                                                                  | 모듈 구현 위치                                                                               |    준수 여부    |
| :-------------------------------------- | :--------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------- | :-------------: |
| **기능 요구사항**<br>(FR/SV_F.md 3.2.1) | **SV-F-001**     | 회원가입 / 로그인 / 로그아웃 기능 제공                                                                                                                                         | `src/controllers/authController.js`<br>`src/services/authService.js`                         | **준수 (100%)** |
|                                         | **SV-F-002**     | 아이디/비밀번호 찾기 기능 제공                                                                                                                                                 | `src/controllers/accountController.js`<br>`src/services/accountService.js`                   | **준수 (100%)** |
|                                         | **SV-F-003**     | 자동 로그인(세션 유지) 기능 제공                                                                                                                                               | `src/utils/jwt.js`<br>`src/services/authService.js` (`auto_login`)                           | **준수 (100%)** |
|                                         | **SV-F-004**     | 다중 기기 로그인 현황 조회 및 강제 로그아웃 지원                                                                                                                               | `src/controllers/sessionController.js`<br>`src/services/sessionService.js`                   | **준수 (100%)** |
|                                         | **SV-F-005**     | 구독 플랜(Basic/Standard/Premium)별 기능 차등 제공                                                                                                                             | `src/config/plans.js`<br>`src/middleware/planMiddleware.js`<br>`src/services/planService.js` | **준수 (100%)** |
| **인터페이스 규격**<br>(ICD.md)         | **ICD-01 1.3**   | 통신 암호화: WireGuard VPN 내부 / 외부 HTTPS<br>데이터 형식: JSON (UTF-8)<br>인증 방식: JWT Bearer Token<br>토큰 유효기간: 1년(525,600분, auto_login시)<br>날짜 형식: ISO 8601 | `src/config/env.js`<br>`src/utils/jwt.js`<br>`src/middleware/securityMiddleware.js`          | **준수 (100%)** |
|                                         | **ICD-01 2.1.1** | 로그인 API (`POST /auth/login`)                                                                                                                                                | `src/routes/authRoutes.js`                                                                   | **준수 (100%)** |
|                                         | **ICD-01 2.1.2** | 로그아웃 API (`POST /auth/logout`)                                                                                                                                             | `src/routes/authRoutes.js`                                                                   | **준수 (100%)** |
|                                         | **ICD-01 2.1.3** | 회원가입 API (`POST /auth/register`)                                                                                                                                           | `src/routes/authRoutes.js`                                                                   | **준수 (100%)** |
|                                         | **ICD-08 7.1.1** | PostgreSQL `users` 테이블 스키마 일치                                                                                                                                          | `sql/schema.sql` (`users`, `user_sessions` 등)                                               | **준수 (100%)** |
|                                         | **ICD 8.0**      | 공통 오류 코드 (400, 401, 403, 404, 409, 429, 500, 503)                                                                                                                        | `src/constants/errorCodes.js`<br>`src/middleware/errorHandler.js`                            | **준수 (100%)** |
| **비기능 요구사항**<br>(NFR)            | **NF-F-001**     | DB 프레임워크: PostgreSQL 17.X                                                                                                                                                 | `sql/schema.sql`<br>`src/config/database.js` (`pg.Pool`)                                     | **준수 (100%)** |
|                                         | **NF-F-004**     | 백엔드 프레임워크: Express.js (Node.js 24.11)                                                                                                                                  | `package.json`, Express 4.x/ESM                                                              | **준수 (100%)** |
|                                         | **NF-S-001**     | 모든 통신 구간 암호화 및 HTTPS 헤더                                                                                                                                            | `src/middleware/securityMiddleware.js` (HSTS, Helmet)                                        | **준수 (100%)** |
|                                         | **NF-S-002**     | 사용자 비밀번호 해시 저장 (bcrypt salt rounds 12)                                                                                                                              | `src/utils/password.js` (`bcryptjs`)                                                         | **준수 (100%)** |
|                                         | **NF-S-003**     | JWT 기반 인증 토큰 적용                                                                                                                                                        | `src/utils/jwt.js` (`jsonwebtoken`)                                                          | **준수 (100%)** |
|                                         | **NF-S-005**     | 이상 접근 감지 시 알림 발송 (5회 실패 시 차단 및 로깅)                                                                                                                         | `src/middleware/rateLimiter.js`<br>`src/utils/logger.js` (`security` alert)                  | **준수 (100%)** |
|                                         | **NF-P-005**     | 동시 접속 가능 사용자 수 플랜별 차등                                                                                                                                           | `src/config/plans.js` (Basic 1대, Standard 3대, Premium 10대)                                | **준수 (100%)** |

---

## 2. 모듈 디렉토리 구조

```
모듈/
├── .env.example                  # 환경변수 예시 파일
├── package.json                  # Node.js 24.11 패키지 정의
├── README.md                     # 모듈 설명서 및 API 명세
├── sql/
│   └── schema.sql                # PostgreSQL 17.X DDL 스키마 (users, user_sessions 등)
├── src/
│   ├── index.js                  # 모듈 엔트리포인트 (외부 임포트용 팩토리 & 컴포넌트 export)
│   ├── server.js                 # 독립 실행형 Express 웹 서버
│   ├── config/
│   │   ├── env.js                # 환경변수 관리 및 기본값
│   │   ├── plans.js              # 구독 플랜 티어 정의 (Basic/Standard/Premium)
│   │   └── database.js           # PostgreSQL 17.X 커넥션 풀 관리
│   ├── constants/
│   │   └── errorCodes.js         # ICD 8.0 표준 오류 코드 정의
│   ├── errors/
│   │   └── AppError.js           # ICD 8.0 규격화된 커스텀 에러 클래스
│   ├── middleware/
│   │   ├── authMiddleware.js     # JWT Bearer 토큰 검증 및 세션 활성 체크
│   │   ├── planMiddleware.js     # 플랜 등급 및 세부 기능 접근 제어
│   │   ├── rateLimiter.js        # 무차별 대입 방어 (429 TOO_MANY_REQUESTS)
│   │   ├── securityMiddleware.js # HSTS, Helmet 보안 헤더, CORS 설정
│   │   ├── validator.js          # 요청 데이터 형식 및 유효성 검증
│   │   └── errorHandler.js       # ICD 8.0 표준 오류 응답 핸들러
│   ├── repositories/
│   │   ├── index.js              # 저장소 팩토리 (PostgreSQL / In-Memory 스위칭)
│   │   ├── userRepository.js     # PostgreSQL 17.X 사용자 저장소
│   │   ├── sessionRepository.js  # PostgreSQL 17.X 세션 저장소
│   │   ├── loginAttemptRepository.js # 로그인 시도 기록 저장소
│   │   ├── passwordResetRepository.js# 비밀번호 재설정 토큰 저장소
│   │   └── inMemoryRepository.js # Zero-dependency 독립 테스트 및 데모용 인메모리 저장소
│   ├── services/
│   │   ├── authService.js        # 회원가입, 로그인, 로그아웃, 토큰 갱신
│   │   ├── accountService.js     # 아이디/비밀번호 찾기, 비밀번호 재설정, 회원탈퇴
│   │   ├── sessionService.js     # 다중 기기 세션 조회 및 강제 로그아웃
│   │   └── planService.js        # 구독 플랜 조회, 변경 및 권한 검증
│   ├── controllers/
│   │   ├── authController.js     # 인증 관련 요청/응답 처리
│   │   ├── accountController.js  # 계정 관리 요청/응답 처리
│   │   ├── sessionController.js  # 세션 관리 요청/응답 처리
│   │   └── planController.js     # 플랜 관리 요청/응답 처리
│   ├── routes/
│   │   ├── index.js              # 통합 라우터 (/v1/auth 및 /auth 지원)
│   │   ├── authRoutes.js         # 인증 및 계정 관리 라우트
│   │   ├── sessionRoutes.js      # 세션 관리 라우트
│   │   └── planRoutes.js         # 플랜 관리 라우트
│   └── utils/
│       ├── jwt.js                # JWT 서명, 검증, 1년 만료일 계산
│       ├── password.js           # bcrypt 해시 및 검증 (NF-S-002)
│       └── logger.js             # 보안 이상 접근 로깅 (NF-S-005)
└── tests/
    ├── auth.test.js              # SV-F-001 회원가입/로그인/로그아웃 테스트
    ├── account.test.js           # SV-F-002 아이디/비밀번호 찾기 테스트
    ├── autoLogin.test.js         # SV-F-003 자동 로그인 및 세션 유지 테스트
    ├── multiDevice.test.js       # SV-F-004 다중 기기 세션 및 강제 로그아웃 테스트
    ├── plan.test.js              # SV-F-005 구독 플랜별 차등 및 동시접속 제한 테스트
    └── icdErrors.test.js         # ICD 8.0 공통 오류 규격 테스트
```

---

## 3. 구독 플랜 정책 (SV-F-005, NF-P-005, SV-F-032, SV-F-033)

| 항목                                 |            Basic 플랜            | Standard 플랜 |           Premium 플랜            |
| :----------------------------------- | :------------------------------: | :-----------: | :-------------------------------: |
| **동시 접속 기기 수 (NF-P-005)**     | **1대** (초과 시 기존 기기 만료) |    **3대**    |             **10대**              |
| **등록 가능 카메라 보드 수**         |             최대 2대             |   최대 5대    | 최대 16대 (WEB-F-010 멀티뷰 지원) |
| **클라우드 저장 용량 (SV-F-032)**    |               5 GB               |     30 GB     |              100 GB               |
| **녹화 파일 보관 기간 (SV-F-033)**   |               7일                |     30일      |               90일                |
| **실시간 스트리밍 화질**             |               720p               | 1080p @ 30fps |           1080p @ 60fps           |
| **카메라당 프라이버시 존 (ICD 2.6)** |             최대 3개             |   최대 10개   |             최대 20개             |
| **AI 이상 감지 알림 (NF-S-005)**     |              미지원              |    미지원     |             **지원**              |
| **소리 탐지 알림 (SV-F-021)**        |              미지원              |   **지원**    |             **지원**              |
| **PTZ 카메라 원격 제어 (ICD 3.4)**   |              미지원              |   **지원**    |             **지원**              |

---

## 4. API 엔드포인트 명세

베이스 URL: `https://api.securecam.com/v1` (모듈 내부에서는 `/v1/auth/...` 및 `/auth/...` 모두 지원)

### 4.1 인증 API (ICD 2.1, SV-F-001, SV-F-003)

#### 1. 회원가입 (ICD 2.1.3)

- **POST** `/v1/auth/register`
- **Request Body**:
  ```json
  {
    "email": "user@securecam.com",
    "password": "password123!",
    "name": "홍길동",
    "plan": "basic"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "user_id": "4913a63e-344c-40a9-800c-1f89974564b3",
    "email": "user@securecam.com",
    "name": "홍길동",
    "plan": "basic",
    "created_at": "2026-09-17T02:00:00.000Z"
  }
  ```

#### 2. 로그인 (ICD 2.1.1, SV-F-003)

- **POST** `/v1/auth/login`
- **Request Body**:
  ```json
  {
    "email": "user@securecam.com",
    "password": "password123!",
    "auto_login": true,
    "device_name": "Galaxy S24 Ultra",
    "device_type": "android"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer",
    "user_id": "4913a63e-344c-40a9-800c-1f89974564b3",
    "name": "홍길동",
    "email": "user@securecam.com",
    "plan": "basic",
    "session_id": "8319de64-4db0-458d-88b7-a70699e2b44d",
    "is_auto_login": true,
    "expires_at": "2027-09-17T02:00:00.000Z"
  }
  ```
- **Error Codes**:
  - `400 INVALID_CREDENTIALS`: 이메일 또는 비밀번호 불일치
  - `429 TOO_MANY_REQUESTS`: 5회 연속 로그인 실패 시 15분 차단

#### 3. 로그아웃 (ICD 2.1.2)

- **POST** `/v1/auth/logout`
- **Header**: `Authorization: Bearer {JWT_TOKEN}`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "성공적으로 로그아웃되었습니다."
  }
  ```

#### 4. 자동 로그인 토큰 갱신 (SV-F-003)

- **POST** `/v1/auth/refresh`
- **Header**: `Authorization: Bearer {JWT_TOKEN}`
- **Response (200 OK)**: 새 액세스 토큰 및 만료 시간 반환

#### 5. 현재 사용자 정보 조회

- **GET** `/v1/auth/me`
- **Header**: `Authorization: Bearer {JWT_TOKEN}`
- **Response (200 OK)**: 프로필 및 현재 세션 정보 반환

---

### 4.2 아이디 / 비밀번호 찾기 API (SV-F-002, WEB-F-060)

#### 1. 아이디 찾기

- **POST** `/v1/auth/find-id`
- **Request Body**: `{ "name": "홍길동" }`
- **Response (200 OK)**:
  ```json
  {
    "count": 1,
    "items": [
      {
        "name": "홍길동",
        "masked_email": "us****@securecam.com",
        "created_at": "2026-09-17T02:00:00.000Z"
      }
    ]
  }
  ```

#### 2. 비밀번호 재설정 토큰 요청

- **POST** `/v1/auth/forgot-password`
- **Request Body**: `{ "email": "user@securecam.com" }`
- **Response (200 OK)**: 일회용 재설정 토큰(`reset_token`, 1시간 유효) 생성

#### 3. 비밀번호 재설정 실행

- **POST** `/v1/auth/reset-password`
- **Request Body**:
  ```json
  {
    "reset_token": "a1b2c3d4e5f6...",
    "new_password": "newSecurePassword2026!"
  }
  ```
- **Response (200 OK)**: 비밀번호 bcrypt 갱신 및 기존 모든 세션 자동 강제 로그아웃

#### 4. 비밀번호 직접 변경

- **PATCH** `/v1/auth/password` (로그인 인증 필요)
- **Request Body**:
  ```json
  {
    "current_password": "password123!",
    "new_password": "newPassword789!"
  }
  ```

#### 5. 프로필 수정 & 회원 탈퇴

- **PATCH** `/v1/auth/profile`: 이름 변경
- **DELETE** `/v1/auth/account`: 비밀번호 확인 후 계정 및 세션 영구 삭제

---

### 4.3 다중 기기 로그인 현황 및 강제 로그아웃 API (SV-F-004)

#### 1. 활성 세션 목록 조회

- **GET** `/v1/auth/sessions`
- **Header**: `Authorization: Bearer {JWT_TOKEN}`
- **Response (200 OK)**:
  ```json
  {
    "user_id": "4913a63e-344c-40a9-800c-1f89974564b3",
    "plan": "standard",
    "max_allowed_sessions": 3,
    "active_count": 2,
    "sessions": [
      {
        "session_id": "8319de64-4db0-458d-88b7-a70699e2b44d",
        "device_name": "Galaxy S24 Ultra",
        "device_type": "android",
        "client_ip": "10.0.0.15",
        "is_current": true,
        "is_auto_login": true,
        "last_active_at": "2026-09-17T02:10:00.000Z",
        "created_at": "2026-09-17T02:00:00.000Z",
        "expires_at": "2027-09-17T02:00:00.000Z"
      },
      {
        "session_id": "c9cbd428-4649-494f-a420-b42858758c47",
        "device_name": "Chrome on Windows",
        "device_type": "web",
        "client_ip": "211.234.56.78",
        "is_current": false,
        "is_auto_login": false,
        "last_active_at": "2026-09-17T02:05:00.000Z",
        "created_at": "2026-09-17T02:02:00.000Z",
        "expires_at": "2026-09-18T02:02:00.000Z"
      }
    ]
  }
  ```

#### 2. 특정 기기 강제 로그아웃

- **DELETE** `/v1/auth/sessions/:sessionId`
- **Header**: `Authorization: Bearer {JWT_TOKEN}`
- **Response (200 OK)**: 해당 기기의 토큰 즉시 무효화 (접근 시 401 UNAUTHORIZED)

#### 3. 현재 기기 제외 다른 모든 기기 일괄 로그아웃

- **DELETE** `/v1/auth/sessions/other`
- **Header**: `Authorization: Bearer {JWT_TOKEN}`
- **Response (200 OK)**: 종료된 세션 수 반환

---

### 4.4 구독 플랜 관리 API (SV-F-005, WEB-F-061)

#### 1. 전체 플랜 비교 목록 조회

- **GET** `/v1/auth/plan/tiers` (공개)
- **Response (200 OK)**: Basic, Standard, Premium 플랜의 상세 한도 및 지원 기능 반환

#### 2. 내 플랜 및 사용량 조회

- **GET** `/v1/auth/plan`
- **Header**: `Authorization: Bearer {JWT_TOKEN}`
- **Response (200 OK)**: 현재 이용 중인 플랜 정보, 동시 접속 현황/한도 반환

#### 3. 플랜 변경 (업그레이드/다운그레이드)

- **PATCH** `/v1/auth/plan`
- **Header**: `Authorization: Bearer {JWT_TOKEN}`
- **Request Body**: `{ "plan": "premium" }`
- **Response (200 OK)**: 변경된 플랜 및 혜택 반환

---

## 5. 실행 및 테스트 방법

### 5.1 사전 준비 및 패키지 설치

Node.js 24.11 환경에서 `모듈` 디렉토리로 이동 후 패키지를 설치합니다:

```bash
cd 모듈
npm install
```

### 5.2 단위 및 통합 테스트 실행

외부 데이터베이스 설치 없이 내장 인메모리 저장소를 통해 28개 테스트를 즉시 검증할 수 있습니다:

```bash
npm test
```

**테스트 결과 (28 Passed / 0 Failed)**:

- `auth.test.js`: SV-F-001 회원가입, 로그인, 로그아웃, 비밀번호 8자 유효성, 이메일 중복 체크
- `account.test.js`: SV-F-002 아이디 찾기(이메일 마스킹), 비밀번호 재설정 토큰 발급 및 변경, 회원탈퇴
- `autoLogin.test.js`: SV-F-003 자동 로그인(유효기간 1년 525,600분), 일반 로그인(24시간), 토큰 갱신
- `multiDevice.test.js`: SV-F-004 다중 기기 세션 조회, 특정 기기 원격 로그아웃, 타 기기 일괄 로그아웃
- `plan.test.js`: SV-F-005 & NF-P-005 플랜별 기능 차등, 플랜 변경, Basic 1대 동시접속 제한 초과 자동 만료
- `icdErrors.test.js`: ICD 8.0 공통 에러 코드(400, 401, 404, 409, 429 Brute-force 차단) 검증

### 5.3 독립 서버 실행

```bash
# 개발 모드 (Auto-reload)
npm run dev

# 일반 실행
npm start
```

서버 실행 시 기본 `http://localhost:3000` 포트로 바인딩되며, `/health` 및 `/v1/auth/*` 엔드포인트가 활성화됩니다.

### 5.4 PostgreSQL 17.X 데이터베이스 연동 방법

1. PostgreSQL 17.X에서 데이터베이스를 생성합니다:
   ```sql
   CREATE DATABASE securecam_db;
   ```
2. `sql/schema.sql` 스크립트를 실행하여 테이블과 트리거를 생성합니다:
   ```bash
   psql -U postgres -d securecam_db -f sql/schema.sql
   ```
3. `.env` 파일을 생성하거나 수정하여 PostgreSQL 연결 정보를 설정합니다:
   ```env
   DB_DRIVER=postgres
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=your_password
   DB_NAME=securecam_db
   ```
4. `npm start`를 실행하면 PostgreSQL 17.X 커넥션 풀을 통해 영속적으로 데이터가 저장됩니다.

---

## 6. 다른 서버/프로젝트 연동 가이드 (모듈 임포트)

다른 Express 서버(예: CCTV 관제 메인 서버, API 게이트웨이 등)에서 본 모듈을 서브라우터 또는 미들웨어로 임포트하여 사용할 수 있습니다:

```javascript
import express from "express";
import { createAuthApp, authenticate, requirePlan } from "./모듈/src/index.js";

const mainApp = express();

// 1. 인증 서브 애플리케이션 마운트
mainApp.use("/api", createAuthApp());

// 2. 다른 비즈니스 라우트에서 인증 미들웨어 재사용
mainApp.get("/api/v1/devices", authenticate, (req, res) => {
  res.json({
    message: `안녕하세요 ${req.user.name}님`,
    userId: req.user.userId,
  });
});

// 3. 플랜별 접근 제어 미들웨어 재사용 (Standard 플랜 이상만 접근)
mainApp.get(
  "/api/v1/devices/:id/ptz",
  authenticate,
  requirePlan("standard"),
  (req, res) => {
    res.json({ message: "PTZ 제어 권한 확인 완료" });
  },
);

mainApp.listen(8080);
```
