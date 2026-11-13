import {
  inSubnet,
  normalizeIp,
  parseSubnet,
} from "../../../shared/network.mjs";

export function createVpnStatusHandler(subnet) {
  parseSubnet(subnet);
  return (req, res) => {
    const clientIp = normalizeIp(req.socket.remoteAddress || "");
    res.set("Cache-Control", "no-store");
    res
      .status(200)
      .json({ connected: inSubnet(clientIp, subnet), client_ip: clientIp });
  };
}
