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

`mac`은 대문자·콜론 없는 12자리 hex입니다. 구 `device_id`·`mac_no`·`MAC_no`·`serial_no`·`provision_token`, 접두어 없는 경로, `provision-by-serial`, PTZ 및 C4 VPN 제어 경로는 제공하지 않습니다. QR·시리얼·등록 코드 입력과 MAC 등록 간 변환·소유권 확인 계약은 원본 ICD의 보완 대상이며 임의 생성하지 않습니다.

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
  "config_version": 3
}
```

| 응답 필드        | 타입    | 예시 | 의미                                                                                         |
| ---------------- | ------- | ---- | -------------------------------------------------------------------------------------------- |
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
