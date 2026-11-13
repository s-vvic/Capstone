# C7. MediaMTX — Iteration 2

`SPEC/서버 414d6d9e069180d69fdcd91875d20cb4.md`의 A·B 인터페이스와 두 보드 표를 기준으로 수정했다. 문서의 실제 파일명은 저장소에서 `414d6d9e`로 검색할 수 있다. 초기 C7의 MAC 기반 동적 경로와 별도 Node WHEP 프록시는 I2 계약에서 제외했다.

## 실행 구조

```text
controller Node 프로세스 :3000
  ├─ C1/C2/C3/C4/C5 API
  ├─ GET /v1/status
  ├─ 보드 응답에 webrtc_url / webrtc_url_sub 생성
  └─ C7 runtime → MediaMTX 자식 프로세스
                     ├─ RTSP/TCP → 보드 :554
                     ├─ WHEP :8889/TCP (VPN IP에만 바인딩)
                     ├─ WebRTC 미디어 :8189/UDP (VPN IP에만 바인딩)
                     └─ 관리 API 127.0.0.1:9997 (외부 노출 금지)
```

controller의 `npm start`가 MediaMTX 설정 생성·검사·실행을 처리하고 정상 종료 시 자식 프로세스도 종료한다. MediaMTX 시작 실패는 controller 시작 실패로 처리하며, 실행 중 자식이 종료되면 `/health`는 503 및 C7 `failed`를 반환한다. 이 경우 controller를 재시작한다. API와 영상은 별도 프로세스·포트로 처리되며 Node는 영상 데이터를 중계하지 않는다. `MEDIAMTX_ENABLED=false`이면 기존 API만 실행하고 C7 상태는 `disabled`다.

## 설정 및 시작

1. 같은 서버 호스트에 공식 **MediaMTX v1.21.3** 바이너리를 설치한다. 이 버전으로 설정 및 프로세스 통합을 검증한다. [공식 릴리스](https://github.com/bluenviron/mediamtx/releases/tag/v1.21.3)의 OS/CPU별 파일과 `checksums.sha256`을 받아 해시를 확인한다. 바이너리는 소스에 포함하지 않는다.
2. controller와 함께 배포할 때 `mediamtx/`, `shared/` 폴더도 기존 상대 경로를 유지해 포함한다. C7 자체는 Node 내장 모듈만 사용하며 DB·JWT·Express 의존성이 없다.
3. **controller/.env**에 아래를 반영한다. 실제 `.env`는 자동 수정하지 않았다.

```dotenv
API_BASE_URL=http://10.0.0.100:3000/v1
WG_SERVER_IP=10.0.0.100
RTSP_PORT=554
WEBRTC_BASE_URL=http://10.0.0.100:8889
CLIENT_VPN_SUBNET=10.0.2.0/24
BOARD_VPN_SUBNET=10.0.1.0/24
MEDIAMTX_ENABLED=true
MEDIAMTX_BINARY=/usr/local/bin/mediamtx
WEBRTC_ALLOWED_ORIGINS=*
MTX_ICE_UDP_PORT=8189
MTX_API_URL=http://127.0.0.1:9997
MTX_LOG_LEVEL=info
```

`WG_SERVER_IP`는 실제 WireGuard 인터페이스에 있어야 한다. `WEBRTC_BASE_URL`은 같은 IP의 HTTP origin으로 `/v1`이나 경로를 붙이지 않는다. 끝 `/`는 제거한다. controller의 API_BASE_URL과 역할이 다르다. 원시 WHEP는 8889에 직접 연결하므로 API 주소로 대체하지 않는다. `PORT`는 controller의 3000이며 C7 전용 Node 포트 3007은 사용하지 않는다.

```bash
cd SourceCode/controller
npm ci
npm run media:configure
npm start
```

기존 WireGuard 관리 권한이 필요한 환경은 이전에 사용하던 `setpriv ... node --env-file=.env src/server.js`로 실행해도 동일하게 C7이 시작된다. MediaMTX 자체는 1024 이상 포트를 사용하므로 WireGuard 관리 capability를 요구하지 않는다. 소스 코드 변경으로 호스트·AWS 방화벽, WireGuard peer, DB, 실제 인증서 파일을 변경하지 않는다.

`NODE_EXTRA_CA_CERTS`가 필요한 기존 DB 환경은 Node 시작 **이전의 프로세스 환경변수**로 유지한다. `.env`에만 넣는 것으로 시작 시 CA 로딩을 대체하지 않는다. 공통 DB TLS 설정은 [shared/README.md](../shared/README.md)를 참조한다.

기본 생성 파일은 `mediamtx/runtime/mediamtx.yml`이다. 선택 항목 `MEDIAMTX_CONFIG_PATH`, `MEDIAMTX_BOARDS_FILE`로 위치를 지정할 수 있으며, 상대 경로는 실행 디렉터리 기준이다. 시작할 때 설정을 다시 생성하므로 생성 파일 대신 `.env`와 `config/boards.json`을 수정한다. 동일 MediaMTX를 별도로 실행해 둔 채 controller 관리 모드를 켜면 포트가 충돌하므로 둘 중 하나만 실행한다.

독립 실행이 필요하면 `mediamtx/.env.example`을 `.env`로 복사하고 `mediamtx/`에서 `npm start`한다. 이때 controller의 `MEDIAMTX_ENABLED=false`를 유지한다. 기존 `C7_PORT`, `C7_PUBLIC_BASE_URL`, `C7_AUTH_ME_URL`, `C7_RTSP_*`, `MTX_READ_PASSWORD`, `MTX_API_PASSWORD`는 I2 구조에서 사용하지 않는다. `WEBRTC_BASE_URL`, `RTSP_PORT`, 고정 보드 설정으로 대체한다.

## I2 고정 경로와 보안

| 경로           | 소스                         | 연결                                                  |
| -------------- | ---------------------------- | ----------------------------------------------------- |
| `CAM-E099`     | `rtsp://10.0.1.2:554/live/0` | 상시 수신                                             |
| `CAM-E099_sub` | `rtsp://10.0.1.2:554/live/1` | 시청 요청 시 연결, 마지막 시청자 종료 후 10초 뒤 해제 |
| `CAM-04AF`     | `rtsp://10.0.1.1:554/live/0` | 상시 수신                                             |
| `CAM-04AF_sub` | `rtsp://10.0.1.1:554/live/1` | 시청 요청 시 연결                                     |

`config/boards.json`의 명시적 보드 목록을 사용하며 DB나 heartbeat로 경로를 동적 변경하지 않는다. 고화질은 보드가 꺼져 있어도 MediaMTX가 재시도한다. 실제 WebRTC 연결이 끊기면 웹·앱은 새 WHEP 협상을 해야 한다. 화면의 자동 재접속은 클라이언트 책임이다.

클라이언트 대역 `10.0.2.0/24`에는 위 경로 패턴의 **read만 허용**하고 publish·관리 API·메트릭은 허용하지 않는다. 관리 API는 루프백에서만 허용한다. 전달 헤더를 신뢰하지 않아 `X-Forwarded-For` 위조로 우회할 수 없다. HLS/RTMP/SRT/MoQ/외부 RTSP/녹화는 끄고 외부 STUN/TURN이나 다른 NIC ICE 후보를 쓰지 않는다. CORS는 I2 기본 `*`이며 필요하면 `WEBRTC_ALLOWED_ORIGINS`를 쉼표 구분 origin 목록으로 좁힌다.

HTTPS로 배포한 WEB에서 I2의 HTTP WHEP 주소를 호출할 때는 브라우저 mixed-content·사설망 접근 정책도 확인해야 한다. CORS 허용만으로 이 정책을 해제할 수 없다. 이 구현은 명세의 직접 VPN HTTP 계약을 유지하며, HTTPS 전환이 필요하면 인증서·접속 주소 계약을 별도로 맞춘다.

**I2에서는 로그인 사용자별 영상 소유권을 검사하지 않는다.** 같은 클라이언트 VPN 대역의 다른 사용자가 경로를 알면 볼 수 있다는 명세의 임시 한계가 있다. 소유권 기반 시청 인증은 I3 작업이다. 기존 C7 인증이 유지된 것으로 간주하면 안 된다. REST 보드 목록·등록의 인증·소유권 검사는 계속 기존 C1/C2에서 처리한다.

## controller API

보드 목록·상태·등록 응답에 다음을 포함한다. DB 컬럼은 추가하지 않았다.

```json
{
  "device_id": "CAM-E099",
  "mac": "7424CAAAE099",
  "webrtc_url": "http://10.0.0.100:8889/CAM-E099/whep",
  "webrtc_url_sub": "http://10.0.0.100:8889/CAM-E099_sub/whep"
}
```

`WEBRTC_BASE_URL` 미설정 또는 `vpn_ip=null`이면 두 필드 모두 null이다. offline 여부로 지우지 않는다. URL은 정적 규칙으로 만들기 때문에 URL이 있어도 해당 보드가 경로 설정에 없거나 준비되지 않았으면 재생되지 않는다. 시작 시 base 누락 경고를 출력한다.

`GET /v1/status`는 JWT를 검사하지 않고 항상 200으로 응답한다. 실제 소켓 출발지가 `CLIENT_VPN_SUBNET`에 속하는지 판단한다. `::ffff:`는 제거하고 전달 헤더는 무시한다.

```json
{ "connected": true, "client_ip": "10.0.2.3" }
```

`/health`의 C7 항목은 실제 관리 API까지 검사한다. 기존 다른 컴포넌트의 UP 표시는 전체 DB·VPN·영상 가용성을 보증하지 않는다.

## 서버 부팅 자동 실행

controller 관리 모드에서는 controller 서비스 한 개만 자동 시작한다. `deploy/securecam-controller.service.example`을 실제 사용자·경로·Node 위치에 맞춰 설치할 수 있다. 서비스 설치·활성화는 이 작업에서 수행하지 않았다. 이미 `npm start`로 실행 중이라면 그대로 사용할 수 있지만 서버 재부팅 후 자동 시작은 별도 서비스 설정이 필요하다. 독립 C7 모드는 `deploy/securecam-mediamtx.service.example`을 참조한다. 두 모드를 동시에 활성화하지 않는다.

## 검증

```bash
cd SourceCode/mediamtx
npm test
```

controller에서 실제 바이너리까지 확인하려면 `DB_DRIVER=memory`, `DB_SSL=false`를 지정한 격리 환경에서 실행한다.

```bash
cd SourceCode/controller
MTX_TEST_BINARY=/usr/local/bin/mediamtx DB_DRIVER=memory DB_SSL=false NODE_ENV=test node --test tests/mediaI2.test.js tests/mediaNative.test.js
```

자동 검증 범위는 정적 경로·상시/on-demand 설정·권한·VPN 상태 API·프로세스 시작/종료·실패 상태·CORS 및 비클라이언트 IP 차단이다. 성공한 WHEP 201 응답의 `Location` 노출은 [1.21.3 공식 HTTP 처리 코드](https://github.com/bluenviron/mediamtx/blob/v1.21.3/internal/servers/webrtc/http_server.go)에서 확인했다. 거절된 401 응답에는 세션 Location이 없다. 실제 보드 영상 수신, H.265 브라우저 첫 프레임, 지연·재접속, VPN/AWS 방화벽은 운영 환경에서 B-6 및 통합 체크리스트로 확인해야 한다. MediaMTX는 재인코딩하지 않으며 서버가 H.265를 지원하더라도 브라우저·GPU 지원을 따로 확인해야 한다. [공식 WebRTC 코덱 설명](https://mediamtx.org/docs/features/webrtc-specific-features)

모든 변경 JS/JSON은 VS Code Prettier 확장 내 Prettier 3.7.4와 루트 `.prettierrc.json`으로 포맷한다.
