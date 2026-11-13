import { isIP } from "node:net";

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
