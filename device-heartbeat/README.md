# SecureCam C2 — 보드 등록 및 생존 관리

적용 기준: `SPEC/FR`, `SPEC/NFR`, `SPEC/ICD_v2.md`, `SPEC/Component.md` v2.1.
Node.js 24.11 이상 / Express / PostgreSQL 17.X. 메모리 저장소는 개발·격리 테스트용입니다.

## 실행

1. 이 디렉토리에서 `npm ci`를 실행합니다.
2. `.env.example`을 참고해 환경을 설정합니다. 운영 `JWT_SECRET`은 C1과 일치시킵니다.
3. PostgreSQL은 C1의 `users` 스키마를 먼저 적용하고 `sql/schema.sql`을 적용합니다.
4. `npm test`로 검증하고 `npm start`로 실행합니다. 상태 점검은 `GET /health`입니다.

기존 DB에는 `schema.sql`을 바로 적용하지 않습니다. 쓰기를 중단하고 백업한 뒤 다음 명령으로 명시적으로 전환합니다.

```powershell
psql -v ON_ERROR_STOP=1 -f sql/migrate-v1-to-v2.sql
```

잘못된 합성 MAC·정규화 중복·VPN IP 중복이 있으면 마이그레이션을 중단합니다. 원본은 `devices_legacy_v1`에 보존합니다. 기존 테이블을 참조하는 다른 컴포넌트의 FK는 아카이브에 남으므로 해당 컴포넌트 전환 시 MAC FK로 별도 이관해야 합니다. 구 토큰·시리얼·등록 코드·그룹·기록은 보존하지만 새 인증에 사용하지 않습니다.

기존 `10.0.0.x` IP를 자동으로 새 VPN 대역으로 바꾸지 않습니다. C4의 peer·라우팅 전환과 함께 조정해야 합니다. 롤백은 백업·아카이브를 기반으로 별도 수행하며 신규 쓰기를 자동 병합하지 않습니다.

## API

모든 업무 API는 VPN 내부의 `/v1` 아래에서 제공합니다. 공인 HTTPS 노출 대상이 아닙니다.

| 메서드 | 경로                           | 계약                                                      |
| ------ | ------------------------------ | --------------------------------------------------------- |
| POST   | `/v1/devices/register`         | JWT, `mac`·`location` 필수, `name` 선택                   |
| GET    | `/v1/devices`                  | JWT, 소유한 활성 보드 배열                                |
| GET    | `/v1/devices/{mac}/status`     | JWT, 소유권 확인                                          |
| PATCH  | `/v1/devices/{mac}`            | JWT, `name`·`location`·`description`만 수정               |
| POST   | `/v1/devices/heartbeat`        | 등록된 VPN 출발지 IP와 `mac` 대조, 200 + `config_version` |
| POST   | `/v1/devices/provision-by-mac` | 기존 VPN 보드 인증 후 명시적 C4 어댑터 연동               |

`mac`은 대문자·콜론 없는 12자리 hex입니다. 서버는 `device_id`를 `CAM-` + MAC 끝 4자리로 자동 생성하며, 보드 정보·heartbeat·프로비저닝의 정상 응답에 `device_id`와 `mac`을 함께 포함합니다. 요청 본문에 `device_id`를 지정할 필요는 없으며 직접 지정은 거부합니다. 기존 요청·경로 키는 `mac`을 유지합니다. 구 `mac_no`·`MAC_no`·`serial_no`·`provision_token`, 접두어 없는 경로, `provision-by-serial`, PTZ 및 C4 VPN 제어 경로는 제공하지 않습니다. QR·시리얼·등록 코드 입력과 MAC 등록 간 변환·소유권 확인 계약은 원본 ICD의 보완 대상입니다.

### Heartbeat 및 상태

아래 JSON은 **보드가 서버의 `POST /v1/devices/heartbeat`로 보내는 요청 본문(Request Body)** 예시입니다. 보드의 현재 상태와 적용 중인 설정 버전을 보고하며, `Content-Type: application/json`으로 전송합니다.

```json
{
  "mac": "001A2B3C4D5E",
  "status": "online",
  "rtsp_ok": true,
  "wg_ok": true,
  "config_version": 0,
  "storage_used_bytes": 0,
  "latency_ms": 0
}
```

#### Heartbeat 요청 필드

| 요청 필드 | JSON 자료형 | 필수 여부 | 유효값 및 의미 |
| --- | --- | --- | --- |
| `mac` | String | 필수 | 대문자 16진수 12자리, 콜론·공백 없음. 예: `"001A2B3C4D5E"`. 등록된 VPN 출발지 IP의 보드 MAC과 일치해야 합니다. |
| `status` | String | 필수 | `"online"`만 허용합니다. 오프라인은 서버가 heartbeat 수신 시간으로 판정합니다. |
| `rtsp_ok` | Boolean | 필수 | `true` 또는 `false`. 보드의 RTSP 스트리밍 정상 여부입니다. |
| `wg_ok` | Boolean | 필수 | `true` 또는 `false`. 보드가 보고하는 WireGuard 터널 정상 여부입니다. 서버의 실제 VPN 상태 판정을 대체하지 않습니다. |
| `config_version` | Number (정수) | 필수 | `0`~`2147483647`. 보드가 현재 적용 중인 설정 버전입니다. 서버에서는 `applied_config_version`에 저장합니다. |
| `storage_used_bytes` | Number (정수) | 선택 | `0`~`9007199254740991`. 보드의 사용 저장 용량이며 단위는 byte입니다. JavaScript 안전 정수 범위까지 허용합니다. |
| `latency_ms` | Number (정수) | 선택 | `0`~`2147483647`. 보드가 보고하는 서버 응답 지연 시간이며 단위는 ms입니다. |
| `firmware_version` | String | 선택 | 공백만으로 구성되지 않은 최대 50자의 펌웨어 버전 문자열입니다. 예: `"v2.0.0"`. 위 JSON 예시에는 생략되어 있습니다. |

JSON에는 별도의 Integer 자료형이 없으므로 정수 필드는 Number로 보내되 소수 부분이 없어야 합니다. 숫자 `0`과 Boolean `false`도 유효하며, 문자열 `"0"`·`"true"`로 보내면 안 됩니다. 선택 필드는 생략하면 기존 저장값을 유지하고, `null`은 허용하지 않습니다. 필수 필드 누락, 잘못된 타입·범위, 표에 없는 필드나 구 필드는 **`400 BAD_REQUEST`**로 거부합니다. 형식은 맞더라도 등록되지 않은 출발지 IP이거나 MAC이 일치하지 않으면 **`403 FORBIDDEN`**으로 거부합니다.

#### Heartbeat 정상 응답

정상 수신 시 **`200 OK`**와 `Content-Type: application/json`으로 다음 본문을 반환합니다.

```json
{
  "device_id": "CAM-4D5E",
  "mac": "001A2B3C4D5E",
  "config_version": 3
}
```

| 응답 필드        | 타입    | 예시 | 의미                                                                                         |
| ---------------- | ------- | ---- | -------------------------------------------------------------------------------------------- |
| `device_id` | String | `"CAM-4D5E"` | MAC 끝 4자리로 서버가 생성한 보드 식별자입니다. |
| `mac` | String | `"001A2B3C4D5E"` | 요청을 인증한 보드의 전체 MAC입니다. |
| `config_version` | Integer | `3`  | 서버에 저장된 해당 보드의 최신 설정 버전. 요청에서 보고한 보드 적용 버전과 다를 수 있습니다. |

위 요청의 적용 버전이 `0`이고 응답이 `3`이면, 보드는 서버에 더 최신 설정이 있음을 확인하고 `GET /v1/board/config`로 설정을 조회합니다. 설정을 적용한 후 다음 heartbeat 요청의 `config_version`에 `3`을 넣어 보고합니다. 응답 버전이 보드 적용 버전보다 크지 않으면 버전 비교에 따른 설정 조회는 필요하지 않습니다. 부팅 직후 설정 조회는 별도로 수행합니다. 설정 조회 API는 ICD에서 `[TBD]`이며 C6 구현 범위입니다.

요청 버전은 `applied_config_version`에 저장하고 서버 `config_version`을 덮어쓰지 않습니다. C6가 존 변경과 서버 버전 증가를 단일 트랜잭션으로 수행하며 C2는 이를 반환합니다. `GET /board/config` 및 결과 보고는 C6 범위입니다.

ICD의 **5초 송신·15초 초과 시 offline**을 적용합니다. WC-F-031의 30초 송신 요구와 충돌은 미해결이며, NF-P-003의 30초 이내 상태 갱신과 구분합니다. 조회 시 `last_seen`으로 상태를 계산하고 감시기는 기본 1초마다 전환 이벤트를 발생시킵니다. `last_seen` 이력을 누적하지 않습니다.

반복 수신으로 uptime·handshake를 꾸며내거나 heartbeat 누락을 VPN 터널 해제로 간주하지 않습니다. C4가 실제 VPN 상태를 제공해야 합니다. 미관측 uptime·저장 총량·handshake는 `null`입니다.

RTSP 상태 URL은 보드 VPN IP의 `:554/live/0` 및 `/live/1`이며 포트는 `[TBR]`입니다. 앱·웹용 WebRTC URL과 구분해야 하며 실제 WebRTC 접근 계약은 C7에서 확정합니다.

## 보안 및 연동 경계

### 클라이언트 인증

JWT Bearer만 허용하며 `x-user-id` 우회를 제거했습니다. 기본 검증은 HS256 서명·만료·`sub` 검증입니다. C1의 로그아웃·강제 세션 만료까지 적용하려면 `createDeviceHeartbeatApp({ authenticateClient })` 또는 통합 라우터 호스트의 `app.locals.authenticateClient`에 C1 미들웨어를 연결합니다. 미들웨어는 실패 시 요청을 종료하고 성공 시 `req.user.userId`를 설정해야 합니다.

### 보드 출발지 인증

출발지는 `req.socket.remoteAddress`이며 IPv4-mapped IPv6를 정규화합니다. `X-Forwarded-For`·`X-Real-IP`·본문 IP는 인증에 사용하지 않습니다. 임의 VPN IP 매핑을 만들 수 없도록 저장소 쓰기와 C4 관리를 보호해야 합니다. VPN 방화벽은 등록 보드·서버 경계를 강제해야 합니다.

프록시가 TCP 출발지를 바꾸면 인증이 실패하므로 직접 VPN 연결 또는 원본 출발지를 보존하는 네트워크 구성이 필요합니다. VPN 내부 HTTP를 무조건 HTTPS로 리다이렉트하지 않습니다. CORS·Helmet은 VPN 방화벽을 대체하지 않습니다.

### 프로비저닝

초기 부트스트랩 API가 VPN 내부에 있는 문제는 ICD의 `[TBR]`입니다. 임의의 미등록 MAC에 키·IP를 발급하지 않습니다. 기존 VPN 보드의 재프로비저닝은 `createDeviceHeartbeatApp({ provisionBoard })`로 C4 어댑터를 제공합니다.

어댑터 입력은 `mac`·`wg_pubkey`·`firmware_version`·`model`·`source_ip`·`device`이며, 실제 peer 처리를 완료한 후 `vpn_ip`·`server_pubkey`·`server_endpoint`·`rtsp_proxy_ip`를 반환해야 합니다. 기본값은 미등록 출발지 403, 등록 출발지도 어댑터 미설정 시 503입니다. IP 할당·OS peer 조작을 C2에서 모사하지 않습니다.

### 상태 이벤트

`heartbeatMonitor.onStatusChange(callback)`은 `mac`·`device_name`·`old_status`·`new_status`·`occurred_at`을 전달하고 구독 해제 함수를 반환합니다. 전달은 프로세스 내 best effort이며 영속 이벤트 큐가 아닙니다. C3와의 내구성 있는 연동 방식은 별도 확정합니다.

## 전환 영향 및 검증

`controller`·`event-notification`·`storage-retention`·`vpn`은 구버전 소비자이며 이번 변경 범위에 포함하지 않았습니다. 통합 controller의 `device_id` 기반 동기화, heartbeat 토큰·PTZ 테스트는 후속 이관이 필요합니다. 새 C2 API와 구버전 통합 흐름은 호환되지 않습니다.

`npm test`는 MAC·소유권·JWT·TCP 출발지 인증, heartbeat 필수 필드와 0 값, 버전 분리·15초 경계·상태 전환, 폐지 경로와 오류 JSON을 검증합니다. PostgreSQL 회귀 테스트는 `C2_TEST_DATABASE_URL`이 지정된 격리 테스트 DB에서만 실행합니다. 실제 WireGuard·C1 세션·C6 트랜잭션·C7 영상·가용성은 해당 구성요소의 통합 환경에서 검증해야 합니다.

이 문서는 UTF-8로 저장합니다.

## API 접근·오류 콘솔 로그

단독 C2와 통합 controller 모두 **기본적으로 오류 로그만** 콘솔에 출력합니다. 정상 heartbeat의 접근·응답 로그는 숨기며 4xx·5xx 및 응답 전 연결 종료 로그는 유지합니다. 코드를 반영한 뒤 실제 요청을 받는 프로세스를 재시작합니다. 포트 3000의 통합 서버를 사용한다면 controller를 재시작해야 합니다.

```dotenv
C2_ACCESS_LOG_ENABLED=false
```

위 환경변수를 생략해도 오류 전용 모드입니다. 접근·응답까지 추적해야 할 때만 `C2_ACCESS_LOG_ENABLED=true`로 바꾸고 프로세스를 재시작합니다. 통합 controller를 사용한다면 controller 프로세스가 읽는 환경 설정에 지정합니다.

- `[C2][REQUEST]`: 접근 로그 활성화 시 요청 ID, HTTP 메서드, 경로, TCP 출발지 IP를 출력합니다.
- `[C2][RESPONSE]`: 접근 로그 활성화 시 응답 완료 HTTP 상태와 처리 시간(ms)을 출력합니다.
- `[C2][REJECTED]`: 입력 오류·인증 실패 등 4xx 사유를 출력합니다.
- `[C2][ERROR]`: 500 등 서버 오류의 원본 메시지, 오류 코드, 스택을 출력합니다. 운영 모드에서도 서버 콘솔에 스택이 남습니다.
- `[C2][ABORTED]`: 응답 완료 전에 연결이 종료되면 출력합니다.

같은 요청은 동일한 `request_id`를 사용하며 응답 헤더의 `X-Request-Id`에서도 확인할 수 있습니다. 통합 controller와 C2 라우터가 함께 동작해도 중복 출력하지 않습니다. JSON 파싱 전에 접근을 기록하므로 잘못된 JSON 요청도 확인할 수 있습니다. Authorization 헤더·요청 본문 전체·쿼리 문자열은 접근 로그에 포함하지 않습니다.

접근 로그를 활성화했을 때의 예시:

```text
[INFO] [C2][REQUEST] Incoming request {"request_id":"...","method":"POST","path":"/v1/devices/heartbeat","remote_ip":"10.0.1.11"}
[ERROR] [C2][ERROR] Request failed {
  errorMessage: 'database connection refused',
  stack: 'Error: database connection refused ...',
  request_id: '...',
  error_code: 'ECONNREFUSED',
  status: 500
}
[INFO] [C2][RESPONSE] Request completed {"request_id":"...","method":"POST","path":"/v1/devices/heartbeat","remote_ip":"10.0.1.11","status":500,"duration_ms":4.2}
```

오류 전용 모드에서는 정상 요청에 로그가 없는 것이 정상입니다. 접근 로그를 활성화했는데도 로그가 없다면 해당 요청이 이 프로세스까지 도달했는지, 실행 중인 서버 주소·포트와 재시작 여부를 확인합니다. `[REQUEST]`는 있지만 `[RESPONSE]`가 없다면 요청 처리가 아직 완료되지 않은 상태이며, 연결이 먼저 닫히면 `[ABORTED]`가 표시됩니다. 프로세스 관리자로 실행 중이면 해당 프로세스의 stdout·stderr 로그에서 확인합니다.

## PostgreSQL 인증서 체인 오류 해결

heartbeat 처리 중 `findByVpnIp`에서 `SELF_SIGNED_CERT_IN_CHAIN` / `self-signed certificate in certificate chain`이 발생하면, 보드 → API 연결 이후 서버 → PostgreSQL TLS 인증서 검증에서 실패한 것입니다. 이 오류만으로 보드 VPN 인증이나 MAC 검증이 완료되었다고 볼 수는 없습니다.

C2는 `DB_SSL=true`일 때 인증서를 검증합니다. DB가 사설 CA 또는 기본 신뢰 저장소에 없는 인증서를 사용하면 DB 운영자·제공자가 배포한 신뢰할 CA PEM 또는 인증서 번들을 서버에 배치하고 다음과 같이 지정합니다.

```dotenv
DB_DRIVER=postgres
DB_SSL=true
DB_SSL_CA_FILE=/home/ubuntu/certs/database-ca.pem
```

위 경로는 예시이며 실제 CA 파일 경로로 바꿉니다. 이 파일은 Node.js 서버 프로세스가 읽을 수 있어야 하고 `DB_HOST`도 인증서의 서버 이름과 일치해야 합니다. CA 파일을 지정하지 않으면 Node.js 기본 신뢰 저장소를 사용합니다. 잘못된 파일 경로는 명시적 파일 읽기 오류로 처리하며 인증서 검증을 자동으로 우회하지 않습니다.

단독 C2라면 C2 프로세스의 환경 설정에, 통합 controller라면 controller 프로세스가 로드하는 환경 설정에 추가한 뒤 해당 프로세스를 재시작합니다. 서버 인증서 체인이 불완전한 경우에는 DB 서버의 체인 구성도 함께 수정해야 합니다. 로컬 설정 테스트는 운영 DB와의 TLS 연결 성공을 보증하지 않으므로 배포 후 heartbeat를 다시 보내 로그로 확인합니다.

## device_id 자동 생성 및 기존 DB 반영 (2026-11-08)

예를 들어 요청의 `mac`이 `001A2B3C4D5E`이면 `device_id`는 `CAM-4D5E`입니다.

- 메모리·PostgreSQL 저장소의 신규 등록에서 자동 생성하고, heartbeat 상태 갱신에서도 같은 값을 유지·저장합니다. 클라이언트가 임의 ID나 변경된 MAC으로 기존 보드의 식별자를 덮어쓸 수 없습니다.
- 등록·목록·상태·정보 수정·프로비저닝·heartbeat의 보드 관련 정상 응답에는 `device_id`와 `mac`을 함께 제공합니다. 오류 응답 형식과 `/health`는 기존 계약을 유지합니다.
- heartbeat는 계속 VPN 출발지 IP와 전체 MAC으로 인증합니다. 미등록 MAC의 heartbeat를 받아 보드를 자동 등록하는 기능은 추가하지 않았습니다.
- 신규 `schema.sql`은 사용자가 지정한 `device_id CHAR(8) PRIMARY KEY`를 유지하고 `mac`에 UNIQUE를 추가합니다. 등록 SQL의 `ON CONFLICT (mac)`에는 이 UNIQUE 제약이 필요합니다.
- DB 트리거도 ID를 자동 계산하므로 SQL 시드에서 `device_id`를 생략할 수 있습니다. CHECK 제약은 `device_id`와 MAC의 파생 관계를 검사합니다.
- 기존의 단순 `device_id` 존재 여부 검사는 현재 스키마까지 구버전으로 오인하므로, 구버전 판별을 `mac_no` 컬럼 기준으로 수정했습니다.

**기존 테이블은 `CREATE TABLE IF NOT EXISTS`로 변경되지 않습니다.** 현재 MAC 기반 DB 또는 수동으로 `device_id`를 추가한 DB에는 쓰기를 중단·백업한 뒤 다음 스크립트를 실행하고 변경 코드를 배포합니다. 연결 옵션은 실제 DB 환경에 맞게 지정합니다.

```sh
psql -v ON_ERROR_STOP=1 -f sql/migrate-add-device-id.sql
```

이 스크립트는 컬럼 추가, 기존 행의 ID 채우기, NOT NULL·MAC/ID UNIQUE·형식 관계 CHECK·자동 생성 트리거를 한 트랜잭션으로 적용합니다. 반복 실행할 수 있으며 기존 PK 및 외래 키는 보존합니다. **기존 DB에서 PK가 `mac`이면 이 스크립트 이후에도 PK는 `mac`이고 `device_id`는 UNIQUE입니다.** 이미 `device_id`가 PK인 DB는 이를 유지합니다. FK 재설계 없이 PK를 강제로 교체하지 않습니다.

서로 다른 MAC의 끝 4자리가 같을 수 있습니다. 예를 들어 `001A2B3C4D5E`와 `AA1122334D5E`는 모두 `CAM-4D5E`가 됩니다. 새 등록은 HTTP 409로 거부하며 기존 보드를 덮어쓰지 않습니다. 이관 전에 이런 충돌이나 잘못된 MAC이 발견되면 스크립트를 중단하고 롤백합니다. 데이터나 FK에 의해 이관이 실패해도 자동으로 데이터를 삭제하거나 CASCADE 처리하지 않습니다.

`mac_no`가 있는 초기 구버전 DB는 기존 `migrate-v1-to-v2.sql` 경로를 사용합니다. 해당 경로도 최신 스키마로 ID를 생성하며 MAC 끝 4자리 충돌을 먼저 검사합니다. 운영 DB에는 자동 이관하지 않으므로 배포 전에 해당 DB용 스크립트를 직접 적용해야 합니다.
