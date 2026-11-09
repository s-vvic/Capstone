> Shared backend environment names and deployment dependency: [shared/README.md](../shared/README.md)

# C7. MediaMTX 미디어 게이트웨이

`SPEC/FR/`, `SPEC/NFR/`, `SPEC/ICD_v2.md` 4장을 기준으로 작성한 독립 컴포넌트다. **Node.js 24.11 이상 + Express 제어 서비스와 공식 MediaMTX 1.21.3 바이너리를 함께 실행**한다. 영상은 Node 프로세스를 통과하지 않는다.

```text
보드 rkipc (10.0.1.x:554)
    ↑ RTSP over TCP 연결 시작: MediaMTX → 보드
    ↓ 영상 수신: 보드 → MediaMTX
MediaMTX → WebRTC / WireGuard → WEB·Android
    ↑ 로컬 관리 API / 로컬 WHEP
C7 Express → C1 /v1/auth/me + PostgreSQL devices 소유권 조회
```

## 구현 범위와 명세 대응

| 근거 | 구현 |
| --- | --- |
| ICD-04, WC-F-001~004 | DB의 보드 VPN IP로 `/live/0` 고화질, `/live/1` 저화질 RTSP/TCP pull. 두 경로를 동시에 사용할 수 있다. 해상도·fps·인코딩은 보드 설정을 유지한다. |
| ICD-05, WEB-F-020·025, APP-F-010·016·020 | MAC별 high/low WHEP 세션 생성, WebRTC 중계. 2/4/6개 세션을 열어 멀티뷰를 구성할 수 있다. 화면 배치는 클라이언트 책임이다. |
| NF-S-001·003 | VPN IP에 서비스·ICE 바인딩, 공인 STUN/TURN 미사용. C1이 JWT와 활성 로그인 세션을 검증하고 DB에서 보드 소유권을 확인한다. |
| WC-F-040~041, APP-F-017 | 실제 MediaMTX/DB 헬스체크, 스트림 준비 상태 조회. 소스 장애 시 MediaMTX의 RTSP 재시도, 끊긴 WebRTC 세션은 클라이언트가 새 WHEP 요청으로 재접속한다. |
| NF-S-004 | 마스킹은 보드에서 스트리밍 이전에 수행한다. C7은 영상을 재가공하지 않는다. |
| NF-F-001·004 | 기존 PostgreSQL 17 `devices` 테이블 읽기, Express/Node.js. 신규 DB 테이블·마이그레이션은 없다. |
| NF-P-005 | 전체 세션 및 경로별 시청자 수 운영 상한 제공. 플랜별 수치는 명세 미정이므로 임의의 플랜 정책을 만들지 않았다. |

H.265/H.264/G.711을 재인코딩하지 않는다. **H.265의 Chrome·Edge·Safari/Android 재생 지원은 실제 코덱·브라우저·기기 조합으로 확인해야 한다.** 호환되지 않으면 보드 H.264 호환 모드를 검토한다. H.264도 브라우저 호환 프로파일·B-frame 설정 확인이 필요하다. 서버의 HLS/RTMP/SRT/공개 RTSP 출력·녹화는 비활성화했다. 스냅샷·MP4 저장·PTZ는 이 컴포넌트의 구현 범위가 아니다.

미확정 항목: `/live/0`, `/live/1`, RTSP 554는 ICD의 TBR 기본값이다. `devices/{MAC}/{high|low}`와 아래 C7 REST API, 3007/8189 포트는 ICD의 TBD를 채운 **구현 제안**이다. 저화질 704×576@15fps와 WC-F-004의 30fps 충돌은 해결되지 않았고, 목표 960×540@30fps도 보드에서 확정해야 한다. 지연 3초·월 가용성 99.5%·재연결 60초는 실환경 측정 전 충족을 주장하지 않는다.

## 실행

1. VPN이 연결된 서버에 Node.js 24.11 이상과 [공식 MediaMTX 1.21.3](https://github.com/bluenviron/mediamtx/releases/tag/v1.21.3)을 설치한다. CPU/OS에 맞는 배포 파일과 `checksums.sha256`을 받아 SHA-256을 비교한다. 바이너리는 저장소에 포함하지 않는다.
2. 이 디렉터리에서 `.env.example`을 `.env`로 복사하고 아래 설정을 입력한다.
3. 의존성을 설치하고 설정을 생성한다.

```sh
cd SourceCode/mediamtx
npm ci
npm run configure
```

`MTX_API_PASSWORD`, `MTX_READ_PASSWORD`는 각각 서로 다른 32자 이상의 난수로 채운다. 예: `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`를 두 번 실행한다. `.env`와 생성된 `runtime/mediamtx.yml`에는 비밀값이 있으므로 외부에 공개하지 않는다. Linux에서는 `.env` 권한도 `chmod 600 .env`로 제한한다.

각각 별도 터미널에서 실행한다. 아래 `mediamtx`는 설치한 바이너리의 경로로 바꿀 수 있다. Windows는 `mediamtx.exe`를 사용한다.

```sh
mediamtx --validate-conf=runtime/mediamtx.yml
mediamtx runtime/mediamtx.yml
```

```sh
npm start
```

`.env` 변경 시 `npm run configure`를 다시 실행하고 **두 프로세스를 재시작**한다. 서비스 관리자로 각각 자동 재시작하도록 운영한다. Node 서비스는 바이너리를 자동 다운로드하거나 VPN 인터페이스를 생성하지 않는다.

| 설정 | 의미 |
| --- | --- |
| `C7_BIND_HOST`, `PORT` | 기본 `10.0.0.1:3007`. API_BASE_URL은 `/v1`까지 포함한다. 실제 서버 WireGuard IP를 사용한다. 해당 IP가 서버에 없으면 바인딩이 실패한다. |
| `API_BASE_URL` | 클라이언트가 접근하는 C7 주소. 메타데이터 및 WHEP `Location`에 사용한다. 역방향 프록시 사용 시 클라이언트 HTTPS 주소와 경로를 지정한다. 예: `https://media.vpn.example.com/v1`. |
| `C7_AUTH_ME_URL` | 기존 C1 또는 controller의 실제 `/v1/auth/me` 주소. 기본 포트 3000은 예시이며 실제 실행 포트와 맞춘다. 매 요청마다 활성 세션을 확인한다. 인증 서버 장애 시 신규 요청은 503이다. |
| `DB_HOST/PORT/NAME/USER/PASSWORD` | C2가 사용하는 PostgreSQL의 실제 접속 정보. **controller/.env를 자동으로 읽지 않는다.** 원격 DB라면 localhost 기본값을 반드시 수정한다. DB 계정은 `devices` SELECT 권한만 있으면 된다. |
| `DB_SSL`, `DB_SSL_CA_FILE` | TLS 사용 시 `true`와 신뢰할 CA 파일을 설정한다. 인증서 검증을 비활성화하지 않는다. `DATABASE_URL`은 DB_* 접속 항목이 없을 때만 호환용으로 사용한다. |
| `C7_BOARD_CIDR` | 기본 `10.0.1.0/24`. DB 주소가 대역 밖이거나 네트워크/브로드캐스트 주소이면 pull을 거부한다. 클라이언트가 RTSP URL·IP를 직접 지정할 수 없다. |
| `RTSP_PORT`, `C7_RTSP_HIGH_PATH/LOW_PATH/USERNAME/PASSWORD` | 포트·high/low 경로 및 선택적 보드 인증 계정. 계정은 URL에 인코딩해 넣고 클라이언트에는 반환하지 않는다. |
| `MTX_API_URL`, `MTX_WHEP_URL` | 기본 `127.0.0.1:9997`, `127.0.0.1:8889`. 같은 호스트의 MediaMTX 전용. 루프백 HTTP만 허용한다. |
| `WG_SERVER_IP`, `MTX_ICE_UDP_PORT` | 기본 `10.0.0.1:8189/UDP`. ICE 후보는 이 VPN IP만 광고한다. 외부 STUN/TURN은 사용하지 않는다. |
| `C7_ALLOWED_ORIGINS` | 허용할 WEB origin을 쉼표로 구분한다. wildcard 미지원. Android 등 Origin 헤더가 없는 클라이언트도 JWT·소유권 검사는 동일하다. |
| `C7_SESSION_TTL_SECONDS` | 기본 3600초. 만료 시 세션을 종료하므로 장시간 시청 클라이언트는 재접속해야 한다. |
| `C7_MAX_SESSIONS` | 기본 256. 진행 중인 협상도 포함하며 초과 시 429. 한 C7 프로세스 기준 운영 제한이다. |
| `C7_MAX_READERS_PER_PATH` | 기본 0(제한 없음). MediaMTX의 MAC/화질별 상한. 플랜별 상한과는 별개다. |
| `MTX_LOG_LEVEL` | 기본 warn. Node는 서버 오류를 JSON으로 출력하며 정상 요청·JWT·SDP·RTSP 비밀번호는 기록하지 않는다. |

## 네트워크와 배포 경계

VPN 클라이언트 → 서버의 3007/TCP(시그널링), 8189/UDP(실제 영상)를 허용한다. 서버 → 보드의 554/TCP를 허용한다. 클라이언트 → 보드 직접 포워딩은 차단하고, WireGuard `AllowedIPs=10.0.0.1/32` 구성과 일치시킨다. C7은 방화벽·WireGuard 설정을 변경하지 않는다. MediaMTX 관리 API와 원시 WHEP는 127.0.0.1에만 바인딩되며 외부로 프록시하지 않는다.

**CloudFront HTTPS 페이지에서 `http://10.0.0.1:3007`을 바로 호출하면 브라우저 mixed-content 정책에 막힐 수 있다.** VPN 내부에서 접근 가능한 HTTPS 역방향 프록시를 두고 C7의 `/v1/streams/`만 전달한다. 이때 `API_BASE_URL`을 그 HTTPS 주소로 맞추고 SDP 본문, Authorization, PATCH/DELETE, Location/ETag를 보존한다. 미디어 UDP는 계속 서버 VPN IP로 직접 흐른다. 공인 CloudFront 경로에 미디어를 무조건 개방하면 ICD의 VPN 내부 제한과 어긋난다. HTTPS·사설망 접근 권한 정책은 실제 대상 브라우저에서 확인한다.

한 C7 Node 프로세스와 한 MediaMTX를 한 호스트에서 운영하는 구성을 전제로 한다. WHEP 세션 소유권은 메모리에 저장하므로 다중 Node 인스턴스 앞에 일반 로드밸런싱을 두면 안 된다. Node 재시작 시 기존 세션을 이어 관리하지 않으므로 클라이언트는 기존 PeerConnection을 닫고 다시 연결한다. MediaMTX도 함께 재시작하면 남은 미디어 세션이 정리된다.

## API

`/health` 이외에는 **모든 요청에 `Authorization: Bearer <C1 access_token>`**이 필요하다. 토큰을 query string에 넣지 않는다. 대상 보드의 `user_id`가 로그인 사용자와 같고 `is_active=true`인 경우만 허용한다. 소유하지 않은 보드는 404로 응답한다.

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/health` | DB/MediaMTX 실제 상태. 정상 200, 장애 503. C1 상태·실제 영상 재생까지 보증하는 검사는 아니다. |
| GET | `/v1/streams/{mac}` | 보드 식별자 및 고/저화질 WHEP URL. 영상을 시작하지 않는다. |
| GET | `/v1/streams/{mac}/{quality}/status` | `ready`, `tracks`, `readers`. 미시청 on-demand 경로는 정상이어도 ready=false일 수 있다. |
| POST | `/v1/streams/{mac}/{quality}/whep` | `application/sdp` offer → 201 `application/sdp` answer + Location + ETag. |
| PATCH | `/v1/streams/{mac}/{quality}/whep/{session_id}` | 선택적 trickle ICE. `application/trickle-ice-sdpfrag`, `If-Match` 전달 → 204. |
| DELETE | `/v1/streams/{mac}/{quality}/whep/{session_id}` | 해당 사용자가 생성한 세션 종료 → 204. |

`mac`은 `001A2B3C4D5E` 같은 대문자 12자리 hex 문자열, `quality`는 `high` 또는 `low`이다. `session_id`는 POST Location에서 받은 불투명 식별자를 그대로 사용한다. WHEP POST/PATCH 본문은 JSON이 아닌 SDP 문자열이며 64KiB로 제한한다. 오류는 JSON `{ "error_code": "...", "message": "..." }`이다.

메타데이터 응답 예시:

```json
{
  "device_id": "CAM-4D5E",
  "mac": "001A2B3C4D5E",
  "transport": "webrtc",
  "streams": [
    {
      "quality": "high",
      "whep_url": "http://10.0.0.1:3007/v1/streams/001A2B3C4D5E/high/whep",
      "status_url": "http://10.0.0.1:3007/v1/streams/001A2B3C4D5E/high/status"
    },
    {
      "quality": "low",
      "whep_url": "http://10.0.0.1:3007/v1/streams/001A2B3C4D5E/low/whep",
      "status_url": "http://10.0.0.1:3007/v1/streams/001A2B3C4D5E/low/status"
    }
  ]
}
```

첫 시청 요청에서 DB VPN IP를 확인하고 필요한 경로를 MediaMTX API에 등록한다. 시청자가 없으면 10초 뒤 소스 연결을 해제한다. MediaMTX 재시작으로 경로가 사라져도 다음 POST에서 다시 등록한다. DB IP가 바뀌면 다음 POST에서 갱신한다. 이 갱신은 해당 경로의 기존 시청을 끊을 수 있으므로 클라이언트는 재접속해야 한다. 보드 IP·MAC 이외의 동적 입력을 소스 URL에 반영하지 않는다.

세션은 10초 주기로 만료를 검사하고, 약 30초 주기로 C1 로그인·보드 소유권을 재확인한다. 로그아웃/강제 로그아웃·소유권 해제 확인 시 연결을 종료한다. 재확인 중 C1/DB 장애가 나면 오류를 기록하고 다음 주기에 재시도하며, 기존 세션은 최대 TTL까지 유지된다. 비정상 종료 정리에 실패하면 다음 주기에 DELETE를 재시도한다.

주요 오류: 400 잘못된 MAC/화질/SDP, 401 무효 로그인, 403 미허용 Origin, 404 보드/세션 없음, 409 보드 VPN IP 오류, 413 본문 초과, 415 Content-Type 오류, 429 세션 상한, 503 인증/미디어 의존성 또는 소스 장애. DB 예외는 500과 서버 오류 코드 로그로 확인한다. 미디어 장애 응답에는 보드 자격 증명을 노출하지 않는다.

## WEB·앱 연결

`examples/whepClient.js`는 브라우저 ES module 예제다. 메타데이터에서 선택한 화질 URL을 받아 `openStream({ whepUrl, token, video, onState })`를 호출한다. 종료/화질 전환 시 반환된 `close()`를 호출하고 새 세션을 연다. 실패 시 지수 backoff 등으로 새 WHEP 협상을 시도하고, 로그인 만료는 C1 재로그인 흐름으로 처리한다. 멀티뷰는 카메라마다 별도 세션을 만든다. 자동재생은 muted/playsinline을 사용하고 소리는 사용자 동작으로 켠다.

**기존 `WEB`과 `controller`는 이 작업에서 수정하지 않았다.** 현재 WEB WHEP 훅은 POST/DELETE에 Bearer 헤더가 없으므로 그대로 연결하면 401이다. C7 메타데이터 조회 및 POST/PATCH/DELETE 모두 기존 로그인 토큰을 전달하도록 연동해야 한다. C2의 기존 `rtsp_url`을 클라이언트 재생 URL로 쓰거나 보드 RTSP 주소를 공개하지 않는다. controller를 통한 프록시도 별도 연결 작업이며 이 컴포넌트는 3007 포트로 독립 실행한다.

## 검증

```sh
npm test
```

일반 테스트는 C1·DB·미디어 대역으로 권한, 경로 생성/변경, WHEP 세션·종료·만료·소유권 회수, CORS, 오류 응답을 검증한다. 공식 바이너리를 지정하면 실제 설정 검사와 인증된 관리 API/경로 등록·변경, 미인증 WHEP 차단도 실행한다.

```powershell
$env:MTX_TEST_BINARY = 'C:\tools\mediamtx.exe'
npm test
```

```sh
MTX_TEST_BINARY=/usr/local/bin/mediamtx npm test
```

실보드 인수 검증은 별도로 필요하다: 두 RTSP 경로의 해상도/fps와 H.265·H.264·G.711, Chrome/Edge/Safari 및 Android 재생, 2/4/6채널, VPN·보드 단절 후 복구, 로그인 회수, 출력 마스킹, 부하별 영상 종단 지연 3초 이내를 측정한다. 자동 테스트는 실제 프레임 재생이나 성능 목표 달성을 입증하지 않는다.

구현에 확인한 공식 계약: [1.21.3 설정](https://github.com/bluenviron/mediamtx/blob/v1.21.3/mediamtx.yml), [Control API](https://github.com/bluenviron/mediamtx/blob/v1.21.3/api/openapi.yaml), [WebRTC 읽기](https://mediamtx.org/docs/read/webrtc).
