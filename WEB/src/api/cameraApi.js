/**
 * 카메라(보드) 등록 및 제어 REST API (Component 2, ICD 2.2, SV-F-010 ~ SV-F-015, WC-F-033)
 */
import { apiClient } from "./client.js";

/**
 * 로그인한 사용자의 등록 카메라 목록 전체 조회 (GET /devices, ICD 2.2.1)
 */
export async function getCameras() {
  const result = await apiClient.get("/devices");
  if (Array.isArray(result)) return result;
  return result?.devices || [];
}

/**
 * 특정 카메라의 실시간 상세 상태 및 RTSP 스트림 URL 조회 (GET /devices/:id/status, ICD 2.2.3)
 */
export async function getCameraStatus(deviceId) {
  return apiClient.get(`/devices/${encodeURIComponent(deviceId)}/status`);
}

/**
 * 카메라 신규 등록 (POST /devices/register, ICD 2.2.2, SV-F-010)
 * @param {Object} cameraData - { serial_no, mac_no, name, location, register_type: 'qr' | 'serial' | 'code' }
 */
export async function registerCamera(cameraData) {
  return apiClient.post("/devices/register", cameraData);
}

/**
 * 카메라 정보(이름, 설치 위치, 설명 등) 수정 (PATCH /devices/:id, ICD 2.2.4, SV-F-012)
 */
export async function updateCamera(deviceId, updateData) {
  return apiClient.patch(`/devices/${encodeURIComponent(deviceId)}`, updateData);
}

/**
 * 온라인 카메라 PTZ 원격 제어 명령 전송 (POST /devices/:id/ptz, ICD 3.4, WC-F-033)
 * @param {string} deviceId - 카메라 고유 ID
 * @param {'up'|'down'|'left'|'right'|'home'|'zoom_in'|'zoom_out'|'stop'} action
 * @param {number} [speed=5] - 1 ~ 10
 * @param {number} [zoom=1.0] - 1.0 ~ 5.0
 */
export async function sendPtzCommand(deviceId, action, speed = 5, zoom = 1.0) {
  return apiClient.post(`/devices/${encodeURIComponent(deviceId)}/ptz`, {
    action,
    speed,
    zoom,
  });
}

export const cameraApi = {
  getCameras,
  getCameraStatus,
  registerCamera,
  updateCamera,
  sendPtzCommand,
};

export default cameraApi;
