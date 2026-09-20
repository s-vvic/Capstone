import "./DeviceManage.css";
import { useState } from "react";
import { FiEdit2, FiTrash2, FiPlus } from "react-icons/fi";
import { AiFillStar, AiOutlineStar } from "react-icons/ai";

import EditableCameraName from "../components/EditableCameraName";
import CameraRegisterModal from "../components/CameraRegisterModal";

import { cameras as initialCameras } from "../data/cameras";

function DeviceManage() {
  const [ cameras, setCameras ] = useState(initialCameras);
  const [ editingCameraId, setEditingCameraId ] = useState(null);

  const [ isRegisterOpen, setIsRegisterOpen ] = useState(false);
  
  function handleCameraNameChange(cameraId, newName) {
    setCameras((prev) =>
    prev.map((camera) =>
      camera.id === cameraId
        ? { ...camera, name: newName}
        : camera
      )
    );
    /*
    updateCameraName(cameraId, newName);
     */
  }

  function handleDeleteCamera(cameraId) {
    setCameras((prev) =>
      prev.filter((camera) => camera.id !== cameraId)
    );
  }

  function handleRegisterCamera(newCamera) {
    setCameras((prev) => [
      ...prev,
      {
        ...newCamera,
        id: Date.now(),
        status: "offline",
      },
    ]);
    setIsRegisterOpen(false);

  }

  /*
  async function handleRegiserCamera(cameraData) {
    const response = await registerCamera(cameraData);
    setCameras((prev) => [
      ...prev,
      response,
    ]);
  
    setIsRegisterOpen(false);
  }
  */

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
                      handleCameraNameChange(camera.id, newName)
                      setEditingCameraId(null);
                    }}
                    onCancel={() => setEditingCameraId(null)}
                  />
                </td>

                <td>
                  {camera.location || "미설정"}
                </td>

                <td>
                  <span
                    className={`device-status ${camera.status}`}
                  >
                    <span className="status-dot" />
                    {camera.status === "online"
                      ? "Online"
                      : "Offline"}
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
                      onClick={() => 
                        handleDeleteCamera(camera.id)
                      }
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