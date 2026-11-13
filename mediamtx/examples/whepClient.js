// Browser ES module. Pass a WHEP URL returned by GET /v1/streams/{mac}.
// Keep the token in application auth storage, never in the URL.
export async function openStream({
  whepUrl,
  token,
  video,
  signal,
  onState = () => {},
}) {
  const pc = new RTCPeerConnection({ iceServers: [] });
  let sessionUrl;
  let closed = false;
  const authorization = `Bearer ${token}`;
  const close = async () => {
    if (closed) return;
    closed = true;
    pc.close();
    video.srcObject = null;
    signal?.removeEventListener("abort", abort);
    if (sessionUrl) {
      try {
        await fetch(sessionUrl, {
          method: "DELETE",
          headers: { authorization },
          keepalive: true,
        });
      } catch {}
    }
  };
  const abort = () => {
    void close();
  };
  signal?.addEventListener("abort", abort, { once: true });
  pc.ontrack = (event) => {
    video.srcObject = event.streams[0] || new MediaStream([event.track]);
  };
  pc.onconnectionstatechange = () => {
    onState(pc.connectionState);
    if (pc.connectionState === "failed") void close();
  };
  try {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    pc.addTransceiver("video", { direction: "recvonly" });
    pc.addTransceiver("audio", { direction: "recvonly" });
    await pc.setLocalDescription(await pc.createOffer());
    // Non-trickle ICE: wait for complete local candidates before sending the offer.
    await new Promise((resolve, reject) => {
      const finish = (error) => {
        clearTimeout(timeout);
        pc.removeEventListener("icegatheringstatechange", check);
        signal?.removeEventListener("abort", cancelled);
        error ? reject(error) : resolve();
      };
      const check = () => {
        if (pc.iceGatheringState === "complete") finish();
      };
      const cancelled = () => finish(new DOMException("Aborted", "AbortError"));
      const timeout = setTimeout(
        () => finish(new Error("ICE gathering timed out")),
        10000,
      );
      pc.addEventListener("icegatheringstatechange", check);
      signal?.addEventListener("abort", cancelled, { once: true });
      check();
    });
    const response = await fetch(whepUrl, {
      method: "POST",
      headers: { authorization, "content-type": "application/sdp" },
      body: pc.localDescription.sdp,
      signal,
    });
    if (response.status !== 201)
      throw new Error(`WHEP failed (${response.status})`);
    const location = response.headers.get("location");
    if (!location) throw new Error("Missing WHEP Location");
    const resolved = new URL(location, whepUrl);
    if (resolved.origin !== new URL(whepUrl).origin)
      throw new Error("Unexpected WHEP session origin");
    sessionUrl = resolved.href;
    if (closed || signal?.aborted) {
      await fetch(sessionUrl, { method: "DELETE", headers: { authorization } });
      throw new DOMException("Aborted", "AbortError");
    }
    await pc.setRemoteDescription({
      type: "answer",
      sdp: await response.text(),
    });
    // The page should use <video autoplay playsinline muted>; user action enables sound.
    return { pc, close };
  } catch (error) {
    await close();
    throw error;
  }
}
