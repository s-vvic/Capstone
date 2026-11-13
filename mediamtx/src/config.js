import { publicBaseUrl } from "../../shared/config.mjs";
import { isIP } from "node:net";

export function ipv4Number(ip) {
  if (isIP(ip) !== 4) throw new Error("Expected IPv4 address");
  return ip.split(".").reduce((n, part) => (n * 256 + Number(part)) >>> 0, 0);
}
export function inBoardSubnet(ip, cidr) {
  if (isIP(ip) !== 4) return false;
  const [base, bits] = cidr.split("/");
  const mask = (0xffffffff << (32 - Number(bits))) >>> 0;
  const value = ipv4Number(ip);
  const network = (ipv4Number(base) & mask) >>> 0;
  const broadcast = (network | ~mask) >>> 0;
  return (
    (value & mask) >>> 0 === network && value !== network && value !== broadcast
  );
}
function integer(value, fallback, min, max) {
  const number = value === undefined || value === "" ? fallback : Number(value);
  if (!Number.isInteger(number) || number < min || number > max)
    throw new Error("Invalid numeric configuration");
  return number;
}
function endpoint(value, local = false) {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("Invalid HTTP endpoint");
  if (
    local &&
    (url.protocol !== "http:" ||
      url.hostname !== "127.0.0.1" ||
      url.pathname !== "/")
  )
    throw new Error(
      "MediaMTX control endpoints must use http://127.0.0.1:<port>",
    );
  return url.toString().replace(/\/$/, "");
}
export function loadConfig(env = process.env) {
  for (const key of ["MTX_API_PASSWORD", "MTX_READ_PASSWORD"]) {
    if (!env[key] || env[key].length < 32 || /[\r\n]/.test(env[key]))
      throw new Error(`${key} must contain at least 32 characters`);
  }
  if (env.MTX_API_PASSWORD === env.MTX_READ_PASSWORD)
    throw new Error("Use independent MediaMTX secrets");
  const boardCidr = env.C7_BOARD_CIDR || "10.0.1.0/24";
  const [base, prefix, extra] = boardCidr.split("/");
  if (
    isIP(base) !== 4 ||
    !/^\d+$/.test(prefix || "") ||
    +prefix < 1 ||
    +prefix > 30 ||
    extra
  )
    throw new Error("C7_BOARD_CIDR must be an IPv4 subnet /1 through /30");
  const vpnIp = env.WG_SERVER_IP || env.MTX_VPN_IP || "10.0.0.1";
  if (isIP(vpnIp) !== 4)
    throw new Error("WG_SERVER_IP must be an IPv4 address");
  const paths = [
    env.C7_RTSP_HIGH_PATH || "/live/0",
    env.C7_RTSP_LOW_PATH || "/live/1",
  ];
  if (
    paths.some(
      (path) => !/^\/[A-Za-z0-9_/-]+$/.test(path) || path.includes(".."),
    )
  )
    throw new Error(
      "RTSP paths must be absolute paths without queries or traversal",
    );
  const origins = (env.C7_ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (
    origins.some(
      (origin) => new URL(origin).origin !== origin || origin === "null",
    )
  )
    throw new Error("Use explicit CORS origins");
  return {
    host: env.C7_BIND_HOST || vpnIp,
    port: integer(env.PORT ?? env.C7_PORT, 3007, 1, 65535),
    publicBase: endpoint(
      env.API_BASE_URL || env.PUBLIC_BASE_URL
        ? publicBaseUrl(env, 3007)
        : env.C7_PUBLIC_BASE_URL ||
            `http://${vpnIp}:${env.PORT || env.C7_PORT || 3007}`,
    ),
    authMeUrl: endpoint(
      env.C7_AUTH_ME_URL || "http://127.0.0.1:3000/v1/auth/me",
    ),
    apiUrl: endpoint(env.MTX_API_URL || "http://127.0.0.1:9997", true),
    whepUrl: endpoint(env.MTX_WHEP_URL || "http://127.0.0.1:8889", true),
    apiPassword: env.MTX_API_PASSWORD,
    readPassword: env.MTX_READ_PASSWORD,
    vpnIp,
    boardCidr,
    origins,
    rtspPaths: { high: paths[0], low: paths[1] },
    rtspPort: integer(env.RTSP_PORT ?? env.C7_RTSP_PORT, 554, 1, 65535),
    rtspUsername: env.C7_RTSP_USERNAME || "",
    rtspPassword: env.C7_RTSP_PASSWORD || "",
    icePort: integer(env.MTX_ICE_UDP_PORT, 8189, 1, 65535),
    sessionTtlMs: integer(env.C7_SESSION_TTL_SECONDS, 3600, 30, 86400) * 1000,
    maxSessions: integer(env.C7_MAX_SESSIONS, 256, 1, 100000),
    maxReaders: integer(env.C7_MAX_READERS_PER_PATH, 0, 0, 100000),
    logLevel: ["error", "warn", "info", "debug"].includes(env.MTX_LOG_LEVEL)
      ? env.MTX_LOG_LEVEL
      : "warn",
  };
}

export function mediaMtxConfig(config) {
  return {
    logLevel: config.logLevel,
    logDestinations: ["stdout"],
    authMethod: "internal",
    authInternalUsers: [
      {
        user: "c7-api",
        pass: config.apiPassword,
        ips: ["127.0.0.1"],
        permissions: [{ action: "api" }],
      },
      {
        user: "c7-reader",
        pass: config.readPassword,
        ips: ["127.0.0.1"],
        permissions: [
          { action: "read", path: "~^devices/[A-F0-9]{12}/(high|low)$" },
        ],
      },
    ],
    api: true,
    apiAddress: new URL(config.apiUrl).host,
    rtsp: false,
    rtmp: false,
    hls: false,
    srt: false,
    moq: false,
    playback: false,
    metrics: false,
    pprof: false,
    webrtc: true,
    webrtcAddress: new URL(config.whepUrl).host,
    webrtcAllowOrigins: [],
    webrtcLocalUDPAddress: `${config.vpnIp}:${config.icePort}`,
    webrtcLocalTCPAddress: "",
    webrtcIPsFromInterfaces: false,
    webrtcAdditionalHosts: [config.vpnIp],
    webrtcICEServers2: [],
    udpMaxPayloadSize: 1200,
    pathDefaults: {
      sourceOnDemand: true,
      sourceOnDemandStartTimeout: "10s",
      sourceOnDemandCloseAfter: "10s",
      rtspTransport: "tcp",
      maxReaders: config.maxReaders,
      record: false,
    },
    paths: {},
  };
}
