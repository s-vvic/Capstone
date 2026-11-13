import { isIP } from "node:net";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inSubnet, parseSubnet } from "../../shared/network.mjs";

export const TESTED_VERSION = "v1.21.3";
const directory = fileURLToPath(new URL("../", import.meta.url));

function port(value, fallback) {
  const number = Number(value || fallback);
  if (!Number.isInteger(number) || number < 1 || number > 65535) {
    throw new Error("Invalid MediaMTX port");
  }
  return number;
}

export function loadConfig(env = process.env) {
  if (![undefined, "", "true", "false"].includes(env.MEDIAMTX_ENABLED)) {
    throw new Error("MEDIAMTX_ENABLED must be true or false");
  }
  const vpnIp = env.WG_SERVER_IP || "10.0.0.100";
  if (isIP(vpnIp) !== 4) throw new Error("WG_SERVER_IP must be IPv4");
  const clientSubnet = env.CLIENT_VPN_SUBNET || "10.0.2.0/24";
  const boardSubnet = env.BOARD_VPN_SUBNET || "10.0.1.0/24";
  parseSubnet(clientSubnet);
  parseSubnet(boardSubnet);
  const webRtcBase = new URL(
    (env.WEBRTC_BASE_URL || `http://${vpnIp}:8889`).trim().replace(/\/+$/, ""),
  );
  if (
    webRtcBase.protocol !== "http:" ||
    webRtcBase.hostname !== vpnIp ||
    webRtcBase.pathname !== "/" ||
    webRtcBase.username ||
    webRtcBase.password ||
    webRtcBase.search ||
    webRtcBase.hash
  ) {
    throw new Error(
      "I2 WEBRTC_BASE_URL must be http://<WG_SERVER_IP>:<port> without a path",
    );
  }
  const api = new URL(env.MTX_API_URL || "http://127.0.0.1:9997");
  if (
    api.protocol !== "http:" ||
    api.hostname !== "127.0.0.1" ||
    api.pathname !== "/" ||
    api.username ||
    api.password ||
    api.search ||
    api.hash
  ) {
    throw new Error("MTX_API_URL must be a loopback HTTP origin");
  }
  const origins = (env.WEBRTC_ALLOWED_ORIGINS || "*")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (
    !origins.length ||
    origins.some(
      (origin) => origin !== "*" && new URL(origin).origin !== origin,
    )
  ) {
    throw new Error("Invalid WEBRTC_ALLOWED_ORIGINS");
  }
  const boardsFile = resolve(
    env.MEDIAMTX_BOARDS_FILE || `${directory}/config/boards.json`,
  );
  const boards = JSON.parse(readFileSync(boardsFile, "utf8"));
  if (!Array.isArray(boards) || !boards.length)
    throw new Error("At least one I2 board is required");
  const ids = new Set();
  const ips = new Set();
  for (const board of boards) {
    if (
      !/^CAM-[A-F0-9]{4}$/.test(board.device_id || "") ||
      !inSubnet(board.vpn_ip || "", boardSubnet, { hostOnly: true }) ||
      ids.has(board.device_id) ||
      ips.has(board.vpn_ip)
    ) {
      throw new Error("Invalid or duplicate static MediaMTX board");
    }
    ids.add(board.device_id);
    ips.add(board.vpn_ip);
  }
  return {
    enabled: env.MEDIAMTX_ENABLED === "true",
    binary: env.MEDIAMTX_BINARY || "mediamtx",
    configPath: resolve(
      env.MEDIAMTX_CONFIG_PATH || `${directory}/runtime/mediamtx.yml`,
    ),
    vpnIp,
    clientSubnet,
    boardSubnet,
    origins,
    boards,
    webRtcBase: webRtcBase.origin,
    webRtcAddress: webRtcBase.host,
    apiUrl: api.origin,
    apiAddress: api.host,
    icePort: port(env.MTX_ICE_UDP_PORT, 8189),
    rtspPort: port(env.RTSP_PORT, 554),
    logLevel: ["error", "warn", "info", "debug"].includes(env.MTX_LOG_LEVEL)
      ? env.MTX_LOG_LEVEL
      : "info",
  };
}

export function mediaMtxConfig(config) {
  const paths = {};
  for (const board of config.boards) {
    paths[board.device_id] = {
      source: `rtsp://${board.vpn_ip}:${config.rtspPort}/live/0`,
      sourceOnDemand: false,
    };
    paths[`${board.device_id}_sub`] = {
      source: `rtsp://${board.vpn_ip}:${config.rtspPort}/live/1`,
      sourceOnDemand: true,
    };
  }
  return {
    logLevel: config.logLevel,
    logDestinations: ["stdout"],
    authMethod: "internal",
    authInternalUsers: [
      {
        user: "any",
        ips: [config.clientSubnet],
        permissions: [{ action: "read", path: "~^CAM-[A-F0-9]{4}(_sub)?$" }],
      },
      {
        user: "any",
        ips: ["127.0.0.1", "::1"],
        permissions: [{ action: "api" }],
      },
    ],
    api: true,
    apiAddress: config.apiAddress,
    apiAllowOrigins: [],
    apiTrustedProxies: [],
    rtsp: false,
    rtmp: false,
    hls: false,
    srt: false,
    moq: false,
    playback: false,
    metrics: false,
    pprof: false,
    webrtc: true,
    webrtcAddress: config.webRtcAddress,
    webrtcAllowOrigins: config.origins,
    webrtcTrustedProxies: [],
    webrtcLocalUDPAddress: `${config.vpnIp}:${config.icePort}`,
    webrtcLocalTCPAddress: "",
    webrtcIPsFromInterfaces: false,
    webrtcAdditionalHosts: [config.vpnIp],
    webrtcICEServers2: [],
    udpMaxPayloadSize: 1200,
    pathDefaults: {
      rtspTransport: "tcp",
      sourceOnDemandStartTimeout: "10s",
      sourceOnDemandCloseAfter: "10s",
      record: false,
    },
    paths,
  };
}
