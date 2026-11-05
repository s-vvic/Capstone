# SecureCam WEB — VPN 연동

`WEB/`은 프론트엔드이며 `vpn/`은 독립 백엔드 C4입니다. `controller/`가 C1 인증과 C4 VPN API를 함께 제공합니다. 기존 C1 로그인에서 받은 `accessToken`을 VPN 요청의 `Authorization: Bearer ...`에도 사용합니다.

## 통합 controller로 실행

1. `SourceCode/controller/`에서 기존 환경 설정으로 `npm start`를 실행합니다. 기본 포트는 3000입니다.
2. `SourceCode/WEB/`에서 `npm run dev`를 실행합니다. 기본 주소는 `http://localhost:5173`입니다.
3. 로그인 후 VPN 확인 화면을 거쳐, 사이드 메뉴의 VPN 관리(`/vpn-manage`)를 엽니다.

WEB의 기본 API 주소는 `/v1`입니다. Vite가 요청을 `http://localhost:3000`으로 전달하므로 별도 프론트 환경변수 없이 C1·C4를 함께 사용합니다. controller의 `/vpn` 경계는 C1의 활성 세션을 검사합니다. 로그아웃·세션 강제 종료 후에는 VPN API도 401로 거부합니다.

## C4를 별도 프로세스로 실행

이미 C1을 별도 서버에 연결한 경우 그 연결을 유지하고 VPN만 분리할 수 있습니다.

1. `SourceCode/vpn/`에서 `npm start`를 실행합니다. 기본 포트는 3004입니다.
2. WEB의 `.env.local`에 아래 설정을 추가하고 Vite를 재시작합니다.

```dotenv
API_PROXY_TARGET=http://localhost:3000
VPN_PROXY_TARGET=http://localhost:3004
```

`API_PROXY_TARGET`은 기존 로그인 백엔드 주소로 지정합니다. `/v1/vpn` 요청만 C4에 전달하고 나머지 `/v1`은 기존 대상으로 전달합니다. C1과 C4의 `JWT_SECRET`은 같아야 합니다. 별도 프로세스 C4는 자체 JWT 검증을 사용하며 C1의 세션 저장소를 공유하지 않습니다. **로그아웃·강제 만료의 즉시 반영이 필요하면 통합 controller 경로를 사용해야 합니다.**

배포 환경에서 주소를 직접 지정할 때는 다음 빌드 환경변수를 사용할 수 있습니다. 두 주소 모두 `/v1`까지 포함합니다.

```dotenv
VITE_API_BASE_URL=http://10.0.0.1:3000/v1
VITE_VPN_API_BASE_URL=http://10.0.0.1:3004/v1
```

`VITE_VPN_API_BASE_URL`을 생략하면 공통 API 주소를 사용합니다. HTTPS 웹페이지에서 HTTP API를 직접 호출하면 브라우저가 혼합 콘텐츠로 차단할 수 있으므로 같은 출처의 리버스 프록시 또는 적절한 HTTPS 구성을 사용합니다. Vite 개발 프록시는 운영 빌드나 preview에 적용되지 않습니다. 운영에서는 `/v1` 프록시를 별도로 구성해야 합니다.

## 연결된 API와 화면 동작

| API | 사용 |
| --- | --- |
| `GET /v1/vpn/status` | VPN 서버 응답 확인, 가상 드라이버 여부 안내 |
| `GET /v1/vpn/connections` | 로그인 사용자 소유의 활성 카메라 VPN 목록 |
| `POST /v1/vpn/connections/{id}/action` | `connect` / `disconnect` 요청 |
| `POST /v1/vpn/connections/{id}/recover` | 오류 기기의 터널 복구 요청 |

현재 C4가 반환하는 `device_id`를 제어 경로 키로 사용하며 MAC 키 응답도 프론트에서 지원합니다. `mac_no`는 표시 시 콜론 없는 대문자 MAC으로 변환합니다. C4 내부 ID·네트워크 규격의 전체 최신 SPEC 이관은 이번 웹 연동과 별개입니다.

- 목록은 최초 진입, 수동 새로고침, 화면 활성 상태에서 10초마다 조회합니다. 검색·상태 필터·페이지 이동은 조회된 실제 데이터에 적용합니다.
- 연결·해제·복구 중에는 중복 제어를 막습니다. 성공 후 서버를 다시 조회하며 실패를 로컬 성공 상태로 바꾸지 않습니다.
- 빈 목록은 등록 기기가 없는 상태로 표시합니다. 조회 실패 시 샘플 카메라를 넣지 않습니다. 기존 조회값을 유지할 때는 마지막 조회 상태임을 표시하고 제어를 비활성화합니다.
- 요청 제한 시간은 15초입니다. 화면 이탈 시 요청·타이머를 정리하며 인증 오류는 로그인 화면으로 이동합니다.
- 브라우저는 OS WireGuard를 시작하거나 실제 터널 연결을 보증할 수 없습니다. VPN 확인 화면은 인증된 서버 접근 가능 여부를 확인합니다. 접근 실패 시 OS WireGuard 연결 안내와 재시도를 제공합니다.
- `WG_DRIVER=virtual`은 개발용 가상 상태이며 실제 VPN이 아닙니다. 화면에도 이를 표시합니다. 실제 Linux 드라이버 명령이 실패하면 조회·제어 API가 오류를 반환합니다.

C4 목록은 C4 저장소(`vpn_peers` 또는 메모리)의 소유권 매핑을 사용합니다. 기존 C4 등록 절차로 피어가 등록되어 있고 `user_id`가 로그인 사용자와 일치해야 합니다. C2 등록만으로 C4 peer를 자동 생성하거나 다른 사용자의 기기를 노출하지 않습니다. 메모리 모드에서는 프로세스 재시작 시 목록이 초기화됩니다.

## 검증

```powershell
# WEB의 실제 API 모듈 → HTTP controller → C1/C4 통합 테스트
npm test
# 프론트엔드 빌드
npm run build
# C4 독립 테스트는 ../vpn에서 npm test
```

현재 환경에서는 기존 `dist` 디렉토리를 비우는 과정과 Vite 설정 번들러의 상위 폴더 접근이 제한되어, 아래 명령으로 별도 출력 디렉토리에 프로덕션 빌드를 검증했습니다.

```powershell
npm run build -- --configLoader native --emptyOutDir false --outDir build-vpn-check
```

선택적 실제 브라우저 회귀 테스트는 빌드 결과와 설치된 Edge/Chrome 경로를 지정해 실행합니다. 테스트는 임시 프로필·메모리 저장소·가상 VPN을 사용하며 운영 WireGuard 설정을 변경하지 않습니다.

```powershell
$env:WEB_TEST_BROWSER = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$env:WEB_TEST_BUILD_DIR = 'build-vpn-check'
npm run test:browser
```

검증 범위는 로그인, 본인 기기 조회, 연결·해제·복구, 서버 오류, 타인·미소유 기기 차단, 로그아웃된 토큰 거부입니다. 실제 WireGuard 터널·운영 DB·네트워크 방화벽은 운영 환경 통합 검증이 필요합니다. 구버전 C2 계약을 사용하는 controller의 다른 통합 시나리오는 이번 VPN 연동 검증 범위에 포함하지 않습니다.

## WebDashboard-main UI 병합 (2026-11-05)

`../WebDashboard-main/src`와 기존 `WEB/src`를 비교해 화면·스타일·공통 컴포넌트·차트·훅·기본 썸네일을 반영했습니다. 참조 폴더와 백엔드 파일은 수정하지 않았습니다. 실행은 기존 Vite(`npm run dev`)를 유지하며 CRA의 react-scripts·React 버전·package.json을 덮어쓰지 않았습니다.

| 영역 | 반영 내용 | 기존 연결과의 조정 |
| --- | --- | --- |
| 공통 화면 | 새 헤더·사이드바·모달·날짜 선택기·오류 토스트·반응형 페이지네이션 | Vite 진입점 App.jsx 및 기존 경로 유지 |
| 인증 | 로그인·회원가입·비밀번호 찾기를 전환하는 카드, 비밀번호 표시, 입력 검증, 로그인 유지 | 기존 C1 API 사용. 일반 로그인은 sessionStorage, 유지 로그인은 localStorage. 로그아웃은 서버 세션도 종료 |
| 대시보드·리포트 | 요약 카드·기간 선택·도넛/막대/선/순위 차트·상세 모달 | 보드 목록은 C2 조회, 이벤트 통계·리포트는 시연 데이터 안내 |
| 카메라 | MAC 등록 UI·목록·썸네일·멀티뷰·디지털 줌·WebRTC 훅 | 전체 MAC으로 C2 등록·이름 변경 유지. 서버가 준 스트림 URL만 사용. 삭제 API는 미지원 안내 |
| 이벤트 | 새 검색·기간·필터·자동 행 수·상세·미디어 모달 | 기존 이벤트 조회·상태·메모·일괄 변경 API 연결 유지. 목록은 우선 최근 100건을 가져와 화면에서 필터링 |
| VPN | 새 요약 바·행 상세 모달·화면 높이에 맞춘 페이지네이션 | 기존 실제 조회·연결·해제·복구·타임아웃·세션 인증 유지. 가짜 연결 이력과 비활성 목업 모드는 적용하지 않음 |
| 설정 | 저장소·프라이버시 존·구독/결제 미리보기 화면 | 신규 설정은 서버 미연동 상태로 표시. 영역 편집은 실제 보드 마스킹 적용을 의미하지 않음 |

세션이 바뀌면 공유 카메라 목록을 초기화해 이전 사용자의 캐시가 남지 않게 했습니다. 카메라 요청 실패 시 샘플 기기로 바꾸지 않고 실패 또는 마지막 조회 상태를 표시합니다. 원본의 비활성 API 주석·REACT_APP 환경변수·임시 로그인 우회는 그대로 덮어쓰지 않았습니다. 기존 `.env.example`의 VITE/API/VPN 프록시 설정을 사용합니다.

추가 경로는 `/settings/storage`, `/settings/privacy-zones`입니다. `/find-id`는 유지하고 `/find-password`는 새 카드의 `/find-pw`로 연결합니다. 기존 비밀번호 안내 화면은 `/reset-password`에 보존했습니다.

이번 병합 검증은 실제 API 모듈 통합 테스트 12개와 헤드리스 Edge의 로그인·화면 이동·VPN 상세·연결/해제/복구·15초 타임아웃·세션 만료 시나리오 및 JavaScript 런타임 예외 확인입니다. UI 빌드 검증 명령은 다음과 같습니다.

```powershell
npm run build -- --configLoader native --emptyOutDir false --outDir build-ui-merge-check
$env:WEB_TEST_BUILD_DIR = 'build-ui-merge-check'
# WEB_TEST_BROWSER는 위 브라우저 테스트 설명과 동일
npm run test:browser
```
