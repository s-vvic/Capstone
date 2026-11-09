# 백엔드 공통 환경변수

각 컴포넌트는 실행 디렉터리의 `.env`를 읽는다. controller로 통합 실행하면 controller의 `.env` 한 곳에서 설정한다. 독립 실행하면 해당 컴포넌트의 `.env`에 같은 이름으로 설정한다. 파일 자동 병합·변수 보간은 하지 않는다. 프로세스에 이미 주어진 환경변수가 우선한다. 실제 `.env`는 이 변경에서 수정하지 않았다.

모든 백엔드는 `shared/config.mjs`를 사용하므로 **배포 시 `SourceCode/shared/`도 컴포넌트 폴더들과 같은 상위 디렉터리에 포함해야 한다.** 별도 npm 의존성은 없다. 폴더명과 상대 경로를 유지한다.

| 역할 | 표준 변수 | 이전 이름과 호환 |
| --- | --- | --- |
| PostgreSQL 접속 | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | C4의 `DATABASE_URL`은 위 접속 항목이 모두 없을 때만 사용 |
| DB TLS | `DB_SSL`, `DB_SSL_CA_FILE` | 모든 클라이언트 동일. true면 인증서를 검증하고 선택적 CA 파일을 신뢰 |
| 외부 API 주소 | `API_BASE_URL` (`https://api.example.com/v1`) | C5의 `PUBLIC_BASE_URL`(이전에는 `/v1` 없음)은 표준 변수가 없을 때 사용 |
| C7 외부 API 주소 | `API_BASE_URL` (`http://10.0.0.1:3007/v1`) | `PUBLIC_BASE_URL`, `C7_PUBLIC_BASE_URL` 순으로 호환 |
| 서비스 포트 | `PORT` | C7의 `C7_PORT`는 호환용 |
| 보드 RTSP 포트 | `RTSP_PORT` | C7의 `C7_RTSP_PORT`는 호환용 |
| 서버 VPN IP | `WG_SERVER_IP` | C7의 `MTX_VPN_IP`는 호환용 |
| 서버 WireGuard 공개키 | `WG_SERVER_PUBLIC_KEY` | `WG_SERVER_PUBKEY`는 호환용 |
| 로그인 토큰 | `JWT_SECRET` | C1/C2/C3/C4/C5 공통. C7은 C1 `/auth/me`로 검증 |

새 표준 이름을 우선한다. `DB_*` 접속 항목은 하나라도 명시되어 있으면 **그 묶음 전체가 표준 모드**이고, 누락 항목에는 공통 기본값이 적용된다. 이때 `DATABASE_URL`은 무시되므로 URL과 개별 접속 항목을 혼합하지 않는다. `.env.example`을 기준으로 다섯 항목을 모두 채우는 것을 권장한다. 기본값은 localhost:5432, postgres/postgres, securecam_db이다.

`DATABASE_URL`만 사용하는 기존 배포의 URL 쿼리는 유지한다. 단 `DB_SSL`을 명시하면 URL의 ssl 관련 쿼리 대신 공통 TLS 설정을 적용한다. `DB_SSL_CA_FILE`은 `DB_SSL=true`일 때 사용한다. 모든 컴포넌트의 인증서 검증이 활성화되었으므로 기존 C1/C3의 검증 생략에 의존하던 사설 CA 환경은 CA 파일을 설정해야 한다. 비밀번호는 개별 `DB_PASSWORD`에 원문을 넣으며, URL 호환 모드에서만 URL 인코딩한다.

```dotenv
DB_DRIVER=postgres
DB_HOST=database.internal.example
DB_PORT=5432
DB_USER=securecam
DB_PASSWORD=replace-with-real-password
DB_NAME=securecam_db
DB_SSL=true
DB_SSL_CA_FILE=/home/ubuntu/certs/database-ca.pem
API_BASE_URL=https://api.example.com/v1
```

C5 다운로드·공유 URL은 표준 API 주소를 사용한다. C3 `SNAPSHOT_BASE_URL`은 생략하면 `API_BASE_URL + /snapshots`이다. 다른 저장소/CDN 주소가 필요한 경우만 별도 지정한다. C7은 독립 서비스이므로 같은 변수 이름에 C7의 실제 주소·포트를 설정한다. controller의 3000과 독립 C7의 3007을 동일 값으로 만들라는 의미는 아니다.

서로 다른 역할은 분리해 유지한다: WireGuard 공인 `WG_SERVER_ENDPOINT`, C7의 로컬 `MTX_API_URL/MTX_WHEP_URL`, C1 검증용 `C7_AUTH_ME_URL`, 파일 다운로드 서명 `SIGNED_URL_SECRET`은 공통 API URL이나 JWT_SECRET과 다르다. API_BASE_URL을 바꿔도 WireGuard 인터페이스나 리스너가 자동 변경되지 않는다.

WEB은 Vite의 공개 설정 `VITE_API_BASE_URL`을 유지한다. 백엔드 DB·JWT 비밀값을 브라우저에 주입하지 않는다. 별도 VPN 서버 배포용 `VITE_VPN_API_BASE_URL`도 선택 항목으로 유지한다.

범위 밖인 기존 동작: C4 IP 풀/MTU/서브넷 상수, C3 모의 FCM 송신, controller에서 시작하지 않는 보존 스케줄러는 변수명 통일만으로 구현되지 않는다. 기존 예제 주석을 참조한다.

검증: `SourceCode/shared/`에서 `node --test tests/*.test.mjs`. 각 컴포넌트의 기존 테스트도 함께 실행한다.
