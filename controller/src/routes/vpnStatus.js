import {
  inSubnet,
  clientAddress,
  parseSubnet,
} from "../../../shared/network.mjs";

export function createVpnStatusHandler(subnet, trustLoopbackProxy = false) {
  parseSubnet(subnet);
  return (req, res) => {
    const clientIp = clientAddress(req, trustLoopbackProxy);
    res.set("Cache-Control", "no-store");
    res
      .status(200)
      .json({ connected: inSubnet(clientIp, subnet), client_ip: clientIp });
  };
}
