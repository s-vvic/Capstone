> Shared backend environment names and deployment dependency: [shared/README.md](../shared/README.md)

# Component 4: WireGuard VPN 컨트롤러 (VPN IP Pool & Tunnel Manager)

SecureCam 플랫폼의 **컴포넌트 4: WireGuard VPN 컨트롤러** 구현체입니다. `SPEC/Component.md`, `SPEC/FR/VPN_F.md`, `SPEC/FR/SV_F.md` (SV-F-014), `SPEC/ICD.md` (ICD-01 2.5, ICD-06) 및 NFR(NF-S-001, NF-A-002/003) 규격을 엄격하게 준수합니다.

---

## 1. 개요 및 주요 기능

1. **WireGuard VPN 터널 관리 (ICD-06 5.1 ~ 5.3)**
   - UDP 443 포트, MTU 1420, ChaCha20-Poly1305 암호화, PersistentKeepalive 25초.
   - Dual Driver 지원: Linux 환경 실시간 WireGuard CLI (`wg`, `wg-quick`, `/etc/wireguard/wg0.conf`) 및 개발/테스트/Windows용 Virtual In-Memory 드라이버.
2. **사설 IPAM (IP Pool Manager)**
   - 서브넷 `10.0.0.0/24` 중 웹캠 보드 및 클라이언트를 위한 사설 IP 풀: `10.0.0.10 ~ 10.0.0.250` (총 241개 용량).
   - 비트맵 기반 O(1) 순차 할당, 선호 IP 지정(preferredIp), 중복 할당 방지, 피어 삭제 시 자동 IP 회수 및 재활용.
   - 풀 소진 시 `IP_POOL_EXHAUSTED` (409 Conflict) 표준 에러 반환.
3. **Curve25519 (x25519) 키 생성기 (`keyGenerator.js`)**
   - Node.js 내장 `crypto` 모듈 기반 32바이트 x25519 공개키/개인키 및 사전공유키(PresharedKey) 생성.
   - 44자리 Base64 규격 포맷 검증 (`/^[A-Za-z0-9+/]{43}=$/`).
4. **연결 상태 모니터링 & 자동 복구 (SV-F-014, NF-A-002/003)**
   - 백그라운드 헬스 모니터 (`VpnHealthMonitor`): 120초 이상 핸드셰이크가 없거나 패킷 송수신이 정체된 피어를 감지하여 `error` 상태로 전이 및 60초 자동 재연결 시도.
   - 사용자/관리자 수동 연결/끊기 API (`POST /vpn/connections/:deviceId/action`, `action: 'connect' | 'disconnect'`).
   - 수동 서버 복구 트리거 API (`POST /vpn/connections/:deviceId/recover`).
5. **Dual Persistence Repository**
   - 개발 및 단위 테스트용 `InMemoryVpnRepository`.
   - PostgreSQL 17.X 운영 환경용 `PostgresVpnRepository` (`vpn_peers` 테이블 연동).

---

## 2. 디렉토리 구조

```
SourceCode/vpn/
├── package.json
├── .env.example
├── README.md
├── src/
│   ├── app.js                          # Express App 팩토리 (미들웨어, 라우터, 에러핸들러)
│   ├── server.js                       # HTTP 서버 부트스트랩 및 헬스 모니터 시작
│   ├── index.js                        # 모듈 진입점
│   ├── config/
│   │   ├── env.js                      # 환경 변수 유효성 검증 및 기본값
│   │   └── database.js                 # PostgreSQL pg Pool 설정
│   ├── constants/
│   │   ├── errorCodes.js               # ICD v2 표준 에러 코드 매핑
│   │   └── vpnConstants.js             # WireGuard 포트, MTU, IP 풀, Keepalive 등 규격
│   ├── controllers/
│   │   ├── vpnConnectionController.js  # /vpn/connections/* 컨트롤러 (ICD 2.5)
│   │   └── vpnPeerController.js        # /vpn/peers/*, /vpn/status 컨트롤러
│   ├── drivers/
│   │   ├── wireguardDriverInterface.js # 드라이버 추상 인터페이스
│   │   ├── virtualWireguardDriver.js   # 메모리 기반 가상 WireGuard 드라이버
│   │   ├── linuxWireguardDriver.js     # 리눅스 wg CLI & wg0.conf 동기화 드라이버
│   │   └── index.js                    # 드라이버 팩토리 싱글톤
│   ├── errors/
│   │   └── AppError.js                 # HTTP 상태코드 및 세부 메타데이터 포함 예외 클래스
│   ├── middleware/
│   │   ├── authMiddleware.js           # JWT Bearer 및 모의 x-user-id 인증 처리
│   │   ├── errorHandler.js             # ICD 8.0 호환 표준 JSON 응답 포맷터
│   │   └── validator.js                # WireGuard 키 형식 및 파라미터 유효성 검사
│   ├── repositories/
│   │   ├── vpnRepositoryInterface.js   # 저장소 추상 인터페이스
│   │   ├── inMemoryVpnRepository.js    # 인메모리 저장소
│   │   ├── postgresVpnRepository.js    # PostgreSQL 저장소
│   │   └── index.js                    # 저장소 팩토리 싱글톤
│   ├── routes/
│   │   ├── vpnConnectionRoutes.js      # ICD 2.5 연결 관리 라우트
│   │   ├── vpnPeerRoutes.js            # 피어 프로비저닝 및 상태 라우트
│   │   └── index.js                    # /vpn 라우터 집합
│   ├── services/
│   │   ├── ipPoolManager.js            # 10.0.0.10 ~ 10.0.0.250 IPAM 관리자
│   │   ├── keyGenerator.js             # x25519 키 생성 및 검증 유틸리티
│   │   ├── vpnConnectionService.js     # 연결 상태 조회, 수동 제어, 복구 서비스
│   │   ├── vpnHealthMonitor.js         # 백그라운드 핸드셰이크 타임아웃 감시 및 재연결
│   │   └── vpnPeerService.js           # 피어 등록, IP 할당, 설정 파일(wg0.conf) 생성
│   └── utils/
│       └── logger.js                   # 통일된 로거 유틸리티
└── tests/
    ├── ipPoolManager.test.js           # IP 풀 순차 할당, 반환, 소진 테스트 (7개 통과)
    ├── keyGenerator.test.js            # x25519 키 생성 및 규격 검증 (3개 통과)
    ├── wireguardDriver.test.js         # 가상 드라이버 및 wg0.conf 생성 검증 (4개 통과)
    ├── vpnPeerService.test.js          # 피어 등록, 중복 차단, 해제 라이프사이클 (5개 통과)
    ├── vpnConnections.test.js          # ICD 2.5.1 연결 목록/단건 조회 (5개 통과)
    └── vpnActionAndRecovery.test.js    # ICD 2.5.2/2.5.3 제어/복구/상태 (12개 통과)
```

---

## 3. REST API 규격 요약

모든 엔드포인트는 통합 컨트롤러(`controller`)의 `/v1/vpn` 또는 독립 실행 시 `/vpn` 경로로 제공됩니다.

| 메서드 | 엔드포인트 | 설명 | 인증 |
|---|---|---|---|
| `GET` | `/vpn/connections` | 로그인한 사용자의 등록 기기 VPN 연결 목록 조회 (ICD 2.5.1) | 필요 (JWT) |
| `GET` | `/vpn/connections/:deviceId` | 특정 기기의 VPN 연결 상세 상태 조회 | 필요 (JWT) |
| `POST` | `/vpn/connections/:deviceId/action` | VPN 수동 연결(`connect`) 또는 끊기(`disconnect`) (ICD 2.5.2) | 필요 (JWT) |
| `POST` | `/vpn/connections/:deviceId/recover` | 오류 상태 기기의 VPN 서버 복구 요청 (ICD 2.5.3) | 필요 (JWT) |
| `GET` | `/vpn/status` | VPN 서버 상태 및 IP 풀 가용성 통계 조회 | 공개/옵션 |
| `POST` | `/vpn/peers/register` | 신규 피어 등록 및 WireGuard 키/IP 프로비저닝 (ICD-02 3.1) | 공개/옵션 |
| `DELETE` | `/vpn/peers/:peerId` | 피어 등록 해제 및 VPN IP 풀 반환 | 필요 (JWT) |
| `GET` | `/vpn/peers/:peerId/config` | 클라이언트용 `wg0.conf` 설정 파일 다운로드 | 옵션 |

---

## 4. 테스트 실행 방법

```bash
# Component 4 단위/통합 테스트 (총 36개 테스트)
npm test --prefix SourceCode/vpn

# Master Controller 통합 연동 테스트 (총 9개 테스트)
npm test --prefix SourceCode/controller
```

## WEB 연동 (2026-11-05)

프론트엔드 연결 설정과 검증 방법은 `../WEB/README.md`를 참고합니다. 권장 경로는 `WEB → controller /v1/vpn → C4`이며 controller가 C1 활성 세션을 확인합니다. 독립 실행 시에는 WEB의 `VPN_PROXY_TARGET`을 C4 주소로 설정하고 C1과 `JWT_SECRET`을 일치시킵니다. 독립 C4의 JWT 검증은 C1 세션 만료 저장소와 연동되지 않습니다.

카메라 목록은 로그인 사용자 소유의 활성 device peer만 반환하며 phone peer는 제외합니다. 응답의 `mac`은 기존 `mac_no`에서 표시용 정규 형식으로 변환해 제공하고 기존 `device_id` 경로 키는 유지합니다. `/vpn/status`의 `driver_mode`로 개발용 가상 상태와 실제 드라이버를 구분합니다. 프론트엔드는 API 실패를 성공으로 표시하지 않으며, Linux 드라이버의 상태 조회·피어 삭제 실패도 오류로 전달합니다.
