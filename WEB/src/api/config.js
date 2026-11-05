// Vite deployment keeps the existing /v1 controller/proxy setup.
export const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || "/v1").replace(/\/+$/, "");
export const VPN_SERVER_IP = "10.0.0.1";
export const VPN_PORT = 51820;
export const VPN_BOARD_SUBNET = "10.0.1.0/24";
export const VPN_CLIENT_SUBNET = "10.0.2.0/24";
export function isInSubnet(ip, subnet) {
  const prefix = subnet.split("/")[0].split(".").slice(0, 3).join(".");
  return typeof ip === "string" && ip.startsWith(`${prefix}.`);
}
export function subnetHost(subnet, host) { return `${subnet.split("/")[0].split(".").slice(0, 3).join(".")}.${host}`; }
