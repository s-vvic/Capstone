import { useCallback, useEffect, useRef, useState } from "react";
import { getCameras } from "../api/cameraApi";
import { getAccessToken } from "../storage/authStorage";
export const CAMERA_POLL_MS = 5000;
const empty = () => ({ cameras: [], source: "loading", fetchedAt: null });
let shared = empty();
let ownerToken = null;
const listeners = new Set();
function publish(next) { shared = next; listeners.forEach((listener) => listener(shared)); }
if (typeof window !== "undefined") window.addEventListener("session-cleared", () => { ownerToken = null; publish(empty()); });
function useCameraList({ pollMs = CAMERA_POLL_MS } = {}) {
  const [state, setState] = useState(() => ownerToken === getAccessToken() ? shared : empty());
  const [isFetching, setIsFetching] = useState(false);
  const requestRef = useRef(null);
  const mounted = useRef(false);
  const load = useCallback(async ({ silent = false } = {}) => {
    if (requestRef.current) return;
    const token = getAccessToken();
    if (ownerToken !== token) { ownerToken = token; publish(empty()); }
    const controller = new AbortController();requestRef.current = controller;setIsFetching(true);
    try {
      const cameras = await getCameras({ silent, signal: controller.signal });
      if (!controller.signal.aborted && token === getAccessToken()) publish({ cameras, source: "server", fetchedAt: new Date() });
    } catch (error) {
      if (!controller.signal.aborted && token === getAccessToken()) publish({ ...shared, source: shared.fetchedAt ? "stale" : "error" });
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      if (mounted.current) setIsFetching(false);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;listeners.add(setState);
    if (ownerToken !== getAccessToken()) { ownerToken = getAccessToken();publish(empty()); } else setState(shared);
    let stopped = false;let timer;
    async function tick(silent) { if (!document.hidden) await load({ silent });if (!stopped && pollMs > 0) timer = setTimeout(() => tick(true), pollMs); }
    tick(false);
    return () => { stopped = true;mounted.current = false;clearTimeout(timer);listeners.delete(setState);requestRef.current?.abort();requestRef.current = null; };
  }, [load, pollMs]);
  const setCameras = useCallback((updater) => publish({ ...shared, cameras: typeof updater === "function" ? updater(shared.cameras) : updater }), []);
  return { ...state, setCameras, isFetching, refresh: load };
}
export default useCameraList;
