import { isIP } from "node:net";

export function httpsProxyEnabled(env = process.env) {
  if (![undefined, "", "true", "false"].includes(env.HTTPS_PROXY_ENABLED)) {
    throw new Error("HTTPS_PROXY_ENABLED must be true or false");
  }
  return env.HTTPS_PROXY_ENABLED === "true";
}

export function clientAddress(req, trustLoopbackProxy = false) {
  const socketIp = normalizeIp(req.socket.remoteAddress || "");
  const local = socketIp === "::1" || inSubnet(socketIp, "127.0.0.0/8");
  const forwarded = req.headers?.["x-forwarded-for"];
  // Nginx must OVERWRITE this header with $remote_addr, not append client input.
  if (
    trustLoopbackProxy &&
    local &&
    typeof forwarded === "string" &&
    isIP(forwarded.trim())
  ) {
    return normalizeIp(forwarded.trim());
  }
  return socketIp;
}

export function normalizeIp(ip = "") {
  return ip.startsWith("::ffff:") ? ip.slice(7) : ip;
}

export function ipv4Number(ip) {
  if (isIP(ip) !== 4) throw new Error("Expected IPv4 address");
  return ip
    .split(".")
    .reduce((number, octet) => number * 256 + Number(octet), 0);
}

export function parseSubnet(cidr) {
  const [ip, prefix, extra] = cidr.split("/");
  if (isIP(ip) !== 4 || !/^\d+$/.test(prefix || "") || +prefix > 32 || extra) {
    throw new Error("Expected IPv4 CIDR subnet");
  }
  const size = 2 ** (32 - Number(prefix));
  const network = Math.floor(ipv4Number(ip) / size) * size;
  return { network, last: network + size - 1 };
}

export function inSubnet(address, cidr, { hostOnly = false } = {}) {
  const ip = normalizeIp(address);
  if (isIP(ip) !== 4) return false;
  const { network, last } = parseSubnet(cidr);
  const value = ipv4Number(ip);
  return hostOnly
    ? value > network && value < last
    : value >= network && value <= last;
}
