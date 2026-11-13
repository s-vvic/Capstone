# CloudFront 웹 + VPN 내부 HTTPS API

전제: 실제로 등록·소유하고 DNS를 변경할 수 있는 도메인이 필요하다. Route 53 호스팅 영역을 만드는 것만으로 이름을 취득하지 않는다. 예시 `api.example.com`을 실제 소유 도메인으로 전부 바꾼다. `securecam.com`은 2026-11-13 공개 NS가 Cloudflare였으며 사용자는 Route 53 호스팅 영역만 만든 상태임을 확인했다. 소유권이 확보되기 전 해당 이름으로 인증서를 신청하거나 운영 설정에 사용하지 않는다.

## 1. 도메인과 DNS

Route 53의 Registered domains에서 사용 가능한 도메인을 등록하거나 이미 소유한 도메인을 사용한다. 등록기관에 설정된 NS와 사용할 Public hosted zone의 NS가 일치해야 한다. 같은 이름의 호스팅 영역을 추가로 만들면 등록기관이 어느 영역을 가리키는지 확인한다. 타인의 도메인을 동일 이름으로 호스팅 영역만 만드는 것은 효력이 없다.

공개 호스팅 영역에서 `api.<소유 도메인>` A 레코드를 `10.0.0.100`, TTL 60 등으로 생성한다. CloudFront/S3 주소와 EC2 공인 IP를 이 API 레코드에 넣지 않는다. DNS 이름은 공개적으로 조회되어도 실제 API는 VPN에서만 접근한다. 일부 클라이언트 DNS가 사설 IP 응답을 차단하면 VPN DNS 또는 내부 DNS 구성을 별도로 맞춰야 한다. 기존 CloudFront 웹 주소는 유지한다.

## 2. DNS-01 인증서 (API 80/443 공인 개방 불필요)

EC2에서 Nginx와 Certbot을 설치한다.

```bash
sudo apt update
sudo apt install nginx certbot dnsutils
sudo certbot certonly --manual --preferred-challenges dns \
  --cert-name api.example.com -d api.example.com
```

Certbot이 제시하는 `_acme-challenge.api.example.com` TXT 이름과 값을 소유 도메인의 **공개 권한 DNS**에 추가한다. 공개 조회로 값이 전파된 것을 확인한 뒤 Certbot의 Enter를 진행한다.

```bash
dig +short TXT _acme-challenge.api.example.com @1.1.1.1
```

수동 DNS 인증서는 인증 훅 없이 자동 갱신되지 않는다. 만료 전에 수동 갱신하거나 운영 시 certbot-dns-route53과 해당 TXT 갱신에 필요한 제한된 IAM 권한/역할을 구성한다. AWS 키를 소스나 채팅에 넣지 않는다. Route 53 설정만으로 인증서가 생기지는 않는다.

## 3. Nginx와 방화벽

이 폴더의 `nginx-vpn-api.conf.example`에서 도메인·인증서 경로를 실제 값으로 바꾼 뒤 설치한다.

```bash
sudo install -m 0644 deploy/nginx-vpn-api.conf.example /etc/nginx/sites-available/securecam-api
sudo ln -s /etc/nginx/sites-available/securecam-api /etc/nginx/sites-enabled/securecam-api
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
sudo ufw allow in on wg0 from 10.0.2.0/24 to 10.0.0.100 port 443 proto tcp
```

작업 디렉터리는 controller다. 설치 전에 예제의 `api.example.com`을 반드시 치환한다. 이미 동일 symlink가 있다면 중복 생성하지 않는다. `wg0`와 VPN IP는 실제 환경에 맞춘다. 공개 3000/8889/8189 접근은 계속 차단하며 공인 443도 열 필요가 없다. Nginx는 VPN IP의 443만 리슨하고 클라이언트 VPN 대역만 허용한다. 부팅 시 Nginx보다 WireGuard가 먼저 준비되도록 실제 wg-quick 서비스 의존성을 맞춘다.

Nginx는 `/v1/`만 로컬 controller로, `/CAM-xxxx...` 경로만 MediaMTX로 전달한다. 원본 클라이언트의 전달 헤더를 그대로 믿지 않고 `$remote_addr`로 덮어쓴다. 9997 관리 API는 노출하지 않는다.

## 4. controller 설정

```dotenv
HTTPS_PROXY_ENABLED=true
API_BASE_URL=https://api.example.com/v1
WEBRTC_BASE_URL=https://api.example.com
WG_SERVER_IP=10.0.0.100
CLIENT_VPN_SUBNET=10.0.2.0/24
MEDIAMTX_ENABLED=true
MTX_WEBRTC_PORT=8889
WEBRTC_ALLOWED_ORIGINS=https://d1kp83poail7h2.cloudfront.net
```

이 코드 변경을 배포한 뒤 controller를 재시작한다. HTTPS_PROXY_ENABLED=false는 기존 직접 HTTP 구성을 유지한다. true에서는 `/v1/status`만 루프백 프록시가 덮어쓴 단일 전달 IP를 판정에 사용하며 직접 VPN 요청의 위조 헤더는 무시한다. 전역 Express trust proxy는 켜지 않는다. 보드 출발지 인증도 변경하지 않는다. 보드는 기존 VPN HTTP 3000을 계속 사용한다.

MediaMTX는 여전히 `10.0.0.100:8889`와 `10.0.0.100:8189`에 바인딩하며 HTTPS 외부 도메인으로 직접 바인딩하지 않는다. Nginx가 고정 서버 VPN IP를 출발지로 써서 MediaMTX에 연결하므로 그 서버 /32만 전달 헤더를 신뢰한다. 임의 전체 대역을 trusted proxy로 설정하지 않는다.

## 5. WEB 빌드·배포

`WEB/.env.production`에 아래를 반영한다. 서버의 API_BASE_URL을 바꾸는 것만으로 이미 배포된 WEB은 바뀌지 않는다.

```dotenv
VITE_API_BASE_URL=https://api.example.com/v1
VITE_VPN_API_BASE_URL=
```

WEB에서 `npm run build` 후 dist를 기존 S3에 배포하고 CloudFront index.html 캐시를 갱신한다. CloudFront `/v1/*` 프록시를 API 호출에 사용하지 않는다. 로그인 화면 `/login`의 403은 [CloudFront SPA 함수](../../WEB/deploy/README.md)로 별도 해결한다.

VPN PC에서 다음 주소가 신뢰된 HTTPS로 200 및 connected=true인지 먼저 확인한다. HTTPS 사설망 접근 권한을 요청하는 브라우저는 해당 사이트의 로컬 네트워크 접근을 허용해야 한다.

```bash
curl -i https://api.example.com/v1/status
```

CloudFront 웹 로그인 요청 URL이 `https://api.example.com/v1/auth/login`인지 확인한다. 미디어도 HTTPS WHEP를 사용하며 UDP 영상은 VPN의 8189로 직접 흐른다. C7의 클라이언트 대역 read 제한은 유지하고 소유권 기반 시청 인증은 여전히 I3 범위다.

아직 수행하지 않은 작업: 실제 도메인 등록, DNS 변경, 인증서 발급, EC2 Nginx 설치, UFW 변경, WEB/서버 배포. 로컬 코드와 예제만 준비했다.

공식 자료: [Route 53 도메인 등록](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/domain-register.html), [DNS-01](https://letsencrypt.org/docs/challenge-types/#dns-01-challenge), [Certbot](https://eff-certbot.readthedocs.io/en/stable/using.html#manual), [Route 53 자동 갱신 플러그인](https://certbot-dns-route53.readthedocs.io/en/stable/).
