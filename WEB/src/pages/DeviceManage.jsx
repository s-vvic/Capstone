import "./DeviceManage.css";
import { useState, useEffect, useCallback } from "react";
import { FiEdit2, FiTrash2, FiPlus } from "react-icons/fi";

import EditableCameraName from "../components/EditableCameraName";
import CameraRegisterModal from "../components/CameraRegisterModal";
import { cameraApi } from "../api/cameraApi";
import { cameras as initialCameras } from "../data/cameras";

function DeviceManage() {
  const [cameras, setCameras] = useState([]);
  const [editingCameraId, setEditingCameraId] = useState(null);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // 백엔드 기기 목록을 UI 포맷으로 변환
  const transformDevices = useCallback((devices) => {
    if (!Array.isArray(devices)) return [];
    return devices.map((d) => ({
      id: d.device_id || d.id,
      name: d.name || d.device_id,
      location: d.location || "미설정",
      status: d.status || (d.is_online ? "online" : "offline"),
      serial_no: d.serial_no || d.mac_no || "",
      vpn_ip: d.vpn_ip || "-",
      rtsp_stream_url: d.rtsp_stream_url || "",
    }));
  }, []);

  const loadCameras = useCallback(async () => {
    try {
      const data = await cameraApi.getCameras();
      if (Array.isArray(data) && data.length > 0) {
        setCameras(transformDevices(data));
      } else {
        setCameras(initialCameras);
      }
    } catch (error) {
      console.warn("[DeviceManage] Using fallback cameras data:", error.message);
      setCameras(initialCameras);
    } finally {
      setLoading(false);
    }
  }, [transformDevices]);

  useEffect(() => {
    loadCameras();
  }, [loadCameras]);

  async function handleCameraNameChange(cameraId, newName) {
    // 1. 낙관적 UI 업데이트
    setCameras((prev) =>
      prev.map((camera) =>
        camera.id === cameraId ? { ...camera, name: newName } : camera
      )
    );

    // 2. 실제 백엔드 PATCH /devices/:id 호출 (SV-F-012, ICD 2.2.4)
    try {
      await cameraApi.updateCamera(cameraId, { name: newName });
    } catch (error) {
      console.warn("[DeviceManage] Failed to update camera name on server:", error);
    }
  }

  function handleDeleteCamera(cameraId) {
    setCameras((prev) => prev.filter((camera) => camera.id !== cameraId));
  }

  async function handleRegisterCamera(newCamera) {
    try {
      // 실제 백엔드 POST /devices/register 호출 (SV-F-010, ICD 2.2.2)
      const registered = await cameraApi.registerCamera({
        name: newCamera.name || "신규 카메라",
        serial_no: newCamera.serial_no || `VPNCAM-${Date.now()}`,
        mac_no: newCamera.mac_no || null,
        location: newCamera.location || "거실",
        register_type: "serial",
      });

      setCameras((prev) => [
        ...prev,
        {
          id: registered.device_id || registered.id || Date.now(),
          name: registered.name || newCamera.name,
          location: registered.location || newCamera.location || "미설정",
          status: registered.status || "offline",
        },
      ]);
    } catch (error) {
      console.warn("[DeviceManage] Register API fallback to local state:", error);
      setCameras((prev) => [
        ...prev,
        {
          ...newCamera,
          id: Date.now(),
          status: "offline",
        },
      ]);
    } finally {
      setIsRegisterOpen(false);
    }
  }

  return (
    <main className="device-manage">
      <div className="device-manage-top">
        <h2 className="device-manage-title">등록된 카메라</h2>
        <button
          className="register-camera-button"
          onClick={() => setIsRegisterOpen(true)}
        >
          <FiPlus />
          카메라 등록
        </button>
      </div>

      <div className="device-table-wrapper">
        <table className="device-table">
          <thead>
            <tr>
              <th>카메라 이름</th>
              <th>설치 위치</th>
              <th>상태</th>
              <th>작업</th>
            </tr>
          </thead>

          <tbody>
            {cameras.map((camera) => (
              <tr key={camera.id}>
                <td>
                  <EditableCameraName
                    initialName={camera.name}
                    isEditing={editingCameraId === camera.id}
                    onSave={(newName) => {
                      handleCameraNameChange(camera.id, newName);
                      setEditingCameraId(null);
                    }}
                    onCancel={() => setEditingCameraId(null)}
                  />
                </td>

                <td>{camera.location || "미설정"}</td>

                <td>
                  <span className={`device-status ${camera.status}`}>
                    <span className="status-dot" />
                    {camera.status === "online" ? "Online" : "Offline"}
                  </span>
                </td>

                <td>
                  <div className="device-actions">
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => setEditingCameraId(camera.id)}
                      aria-label="카메라 이름 수정"
                      title="이름 수정"
                    >
                      <FiEdit2 />
                    </button>

                    <button
                      className="icon-button delete"
                      onClick={() => handleDeleteCamera(camera.id)}
                      aria-label="카메라 삭제"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isRegisterOpen && (
        <CameraRegisterModal
          onClose={() => setIsRegisterOpen(false)}
          onRegister={handleRegisterCamera}
        />
      )}
    </main>
  );
}

export default DeviceManage;
