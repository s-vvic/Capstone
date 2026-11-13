# CloudFront 로그인 장애 확인 및 SPA 경로 수정

2026-11-13 실제 Chrome으로 `https://d1kp83poail7h2.cloudfront.net/login`에 접속해 다음을 재현했다. 테스트 계정 비밀번호·토큰은 기록하지 않는다.

| 요청                  | 확인한 응답                                                    |
| --------------------- | -------------------------------------------------------------- |
| `GET /login`          | S3 `403 AccessDenied`                                          |
| `GET /`               | 200, React가 로그인 화면 표시                                  |
| `POST /v1/auth/login` | CloudFront HTML `504 Gateway Timeout`, `Error from cloudfront` |

403과 504는 서로 다른 배포 구간의 문제다. 백엔드 `API_BASE_URL` 변경으로 S3의 경로 처리나 이미 빌드된 프론트엔드 요청 주소가 자동 변경되지 않는다. 504만으로 DB 또는 비밀번호 오류를 확정할 수 없다.

## 403: 직접 /login 접속

1. CloudFront Functions에서 함수 생성, 런타임 2.0 선택.
2. `cloudfront-spa-rewrite.js` 내용을 붙여 넣고 테스트 후 Publish.
3. 배포의 **S3 기본 캐시 동작(Default)** 에 Viewer request 함수로 연결한다. `/v1/*` 동작에는 연결하지 않는다.
4. 기존 캐시를 무효화한다: `/login`, `/login/*`, `/index.html` 및 필요한 UI 경로. 전체 정리가 필요하면 `/*`.
5. 직접 `/login` 접속 및 새로고침 시 HTML 200인지 확인한다.

알려진 React 경로만 `/index.html`로 내부 재작성하며 API·정적 파일 오류는 유지한다. API 403/404를 전역 custom error response로 index.html 200에 매핑하지 않는다. 함수 연결은 AWS 배포 설정이며 dist 파일 업로드만으로 적용되지 않는다.

## 504: CloudFront → capstone-back

현재 확인한 `/v1/*` 동작은 POST 허용, CachingDisabled, AllViewerExceptHostHeader로 설정되어 있다. 다음은 별도의 Origins 탭에서 확인해야 한다.

사용자가 제공한 원본은 `capstone-back`, 도메인은 `ec2-43-201-227-58.ap-northeast-2.compute.amazonaws.com`, 원본 경로는 비어 있다. 이 작업 환경에서 해당 호스트의 HTTP 80/3000 및 HTTPS 443 상태 요청은 모두 6초 내 응답하지 않았다. 이는 외부 일반 요청의 관찰이며 CloudFront 전용 허용 규칙 유무나 실제 인스턴스 상태까지 확정하지 않는다. VPN 주소 `10.0.0.100:3000`도 이 작업 환경에서는 도달하지 못했다. 따라서 제공받은 계정의 백엔드 인증 성공·실패는 아직 확인하지 못했다.

- `capstone-back`의 실제 원본 도메인, HTTP/HTTPS 연결 정책, 포트, 원본 경로.
- 원본이 최신 EC2의 올바른 주소인지, 실제 controller 리스너가 3000인지.
- 원본 프로토콜이 HTTP이면 HTTP 포트를 3000으로, HTTPS이면 실제 TLS 리스너와 인증서를 일치시켜야 한다. 일반 HTTP Express 서버에 HTTPS로 연결하면 안 된다.
- 원본 경로를 `/v1`로 중복 지정하지 않는다. 브라우저 요청 URI에 이미 `/v1`이 있다.
- EC2 로컬 `curl -i --max-time 5 http://127.0.0.1:3000/v1/status`가 응답하는지.
- PC VPN 직접 접속 `curl -i --max-time 5 http://10.0.0.100:3000/v1/status`가 connected=true인지.

**I2는 API 공인 접근 차단·VPN 직접 접속을 요구한다.** 이 경우 기존 공인 CloudFront origin 연결은 별도의 네트워크 설계 없이 동작하지 않는다. 이 문서는 API 3000 포트를 인터넷에 개방하도록 변경하지 않는다.

CloudFront HTTPS 화면에서 VPN HTTP API를 직접 호출하도록 VITE_API_BASE_URL만 바꾸는 방법은 브라우저 mixed-content 정책에 막힐 수 있다. CloudFront 화면을 유지하려면 브라우저가 신뢰하고 VPN으로 접근할 수 있는 **HTTPS API 주소**와 해당 origin의 CORS 허용이 필요하다. 또는 UI도 VPN HTTP의 같은 출처로 제공하는 I2 구성을 사용한다. CloudFront가 프록시한 요청의 socket IP는 VPN PC의 IP가 아니므로 `/v1/status` connected 판정에도 영향을 준다. 전달 헤더를 무조건 신뢰하도록 바꿔 우회하지 않는다.

실제 API 주소가 결정되면 `WEB/.env.production`의 `VITE_API_BASE_URL=<HTTPS API origin>/v1`을 설정한 뒤 `npm run build`하고 dist를 재배포한다. 미설정이면 현재처럼 CloudFront의 `/v1`을 사용한다. `API_PROXY_TARGET`은 Vite 개발 서버용이며 S3 배포에는 적용되지 않는다.

이 작업 환경에는 AWS 배포 설정을 변경할 연결이 없으므로 함수 Publish/연결·Origin 변경·S3 재배포는 자동 적용되지 않았다.

공식 참고: [SPA URL 처리](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/example_cloudfront_functions_url_rewrite_single_page_apps_section.html), [504 원인](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/http-504-gateway-timeout.html).
