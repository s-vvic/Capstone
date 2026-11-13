import { deviceIdFromMac } from "./deviceIdentity.js";

export function webrtcUrls(device, baseUrl) {
  const base = (baseUrl || "").replace(/\/+$/, "");
  if (!base || !device.vpn_ip)
    return { webrtc_url: null, webrtc_url_sub: null };
  const id = deviceIdFromMac(device.mac);
  return {
    webrtc_url: `${base}/${id}/whep`,
    webrtc_url_sub: `${base}/${id}_sub/whep`,
  };
}

export function warnMissingWebRtcBase(baseUrl, logger = console) {
  if (!baseUrl)
    logger.warn(
      "[C7] WEBRTC_BASE_URL is unset; device webrtc_url/webrtc_url_sub will be null",
    );
}
