import { useEffect, useState } from "react";

/*
  WebRTC 실시간 스트림 (WHEP 시그널링)
  - WHEP: SDP offer 를 POST 하면 answer 를 돌려주는 표준 방식 (MediaMTX / go2rtc / Janus 등 지원)
  - status: "idle"(주소 없음) | "connecting" | "connected" | "failed"
  - reloadKey 가 바뀌면 기존 연결을 끊고 다시 연결 (새로고침 버튼)
*/

const ICE_GATHERING_TIMEOUT = 2000;

// ICE 후보 수집이 끝날 때까지 기다림 (WHEP 는 trickle ICE 없이 한 번에 offer 를 보냄)
function waitIceGathering(pc) {
  if (pc.iceGatheringState === "complete") return Promise.resolve();

  return new Promise((resolve) => {
    const timer = setTimeout(done, ICE_GATHERING_TIMEOUT);

    function done() {
      clearTimeout(timer);
      pc.removeEventListener("icegatheringstatechange", onChange);
      resolve();
    }

    function onChange() {
      if (pc.iceGatheringState === "complete") done();
    }

    pc.addEventListener("icegatheringstatechange", onChange);
  });
}

function useWebRtcStream(videoRef, whepUrl, reloadKey) {
  const [status, setStatus] = useState(whepUrl ? "connecting" : "idle");

  useEffect(() => {
    if (!whepUrl) {
      setStatus("idle");
      return undefined;
    }

    let cancelled = false;
    let resourceUrl = null;

    const pc = new RTCPeerConnection();

    pc.addTransceiver("video", { direction: "recvonly" });
    pc.addTransceiver("audio", { direction: "recvonly" });

    pc.ontrack = (event) => {
      const video = videoRef.current;

      if (video && event.streams[0] && video.srcObject !== event.streams[0]) {
        video.srcObject = event.streams[0];
      }
    };

    pc.onconnectionstatechange = () => {
      if (cancelled) return;

      if (pc.connectionState === "connected") setStatus("connected");
      else if (pc.connectionState === "failed") setStatus("failed");
      // disconnected 는 잠깐 끊겼다 스스로 복구되는 경우가 많아 재연결 중으로 표시
      else if (pc.connectionState === "disconnected") setStatus("connecting");
    };

    // 서버 쪽 세션 정리 (WHEP 리소스 삭제)
    function releaseResource(url) {
      fetch(url, { method: "DELETE" }).catch(() => {});
    }

    async function connect() {
      setStatus("connecting");

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await waitIceGathering(pc);

        if (cancelled) return;

        const response = await fetch(whepUrl, {
          method: "POST",
          headers: { "Content-Type": "application/sdp" },
          body: pc.localDescription.sdp,
        });

        if (!response.ok) {
          throw new Error(`WHEP 요청 실패 (${response.status})`);
        }

        const location = response.headers.get("Location");
        const base = new URL(whepUrl, window.location.href);
        const sessionUrl = location ? new URL(location, base).href : null;

        const answer = await response.text();

        // 응답을 기다리는 동안 화면을 벗어났으면 방금 만든 세션을 바로 정리
        if (cancelled) {
          if (sessionUrl) releaseResource(sessionUrl);
          return;
        }

        resourceUrl = sessionUrl;

        await pc.setRemoteDescription({ type: "answer", sdp: answer });
      } catch (error) {
        if (!cancelled) {
          console.error("WebRTC 연결 실패:", error);
          setStatus("failed");
        }
      }
    }

    connect();

    const video = videoRef.current;

    return () => {
      cancelled = true;

      pc.close();

      if (video) video.srcObject = null;
      if (resourceUrl) releaseResource(resourceUrl);
    };
  }, [videoRef, whepUrl, reloadKey]);

  return status;
}

export default useWebRtcStream;
