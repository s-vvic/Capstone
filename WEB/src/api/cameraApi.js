export async function registerCamera(cameraData) {
  const response = await fetch("/api/cameras", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cameraData),
  });

  if (!response.ok) {
    throw new Error("카메라 등록에 실패했습니다.");
  }

  return response.json();
}


export async function getCameras() {
  const response = await fetch("/api/cameras");

  if (!response.ok) {
    throw new Error("카메라 목록 조회에 실패했습니다.");
  }

  return response.json();
}