import { getAccessToken, clearSession, saveLoginNotice } from "../storage/authStorage.js";
const BASE_URL = (import.meta.env?.VITE_API_BASE_URL || "/v1").replace(/\/$/, "");
export const API_ERROR_EVENT = "api-error";
export const VPN_UNREACHABLE_EVENT = "vpn-unreachable";
export const VPN_CHECK_MESSAGE = "서버에 접근할 수 없습니다. VPN 연결을 확인하세요.";
function emit(name, detail) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(name, { detail }));
}
export class ApiError extends Error {
  constructor(status, data = {}, fallback = "요청에 실패했습니다.") {
    const body = data?.error || data || {};
    super(body.message || fallback);
    this.name = "ApiError";
    this.status = this.statusCode = status;
    this.code = body.error_code || body.code || (status === 401 ? "UNAUTHORIZED" : "API_ERROR");
    this.details = body.details || null;
  }
}
export class NetworkError extends ApiError {
  constructor(cause) { super(0, { error_code: "NETWORK_ERROR" }, VPN_CHECK_MESSAGE); this.name = "NetworkError"; this.cause = cause; }
}
export function getAuthToken() { return getAccessToken() || localStorage.getItem("token") || ""; }
export function setAuthToken(token) {
  clearSession();
  if (token) localStorage.setItem("accessToken", token);
}
export async function apiFetch(endpoint, options = {}) {
  const { timeoutMs, ...config } = options;
  const headers = { ...(config.headers || {}) };
  const token = getAuthToken();
  if (token && !headers.Authorization && !headers.authorization) headers.Authorization = `Bearer ${token}`;
  if (timeoutMs) {
    const timeout = AbortSignal.timeout(timeoutMs);
    config.signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  }
  const url = /^https?:\/\//.test(endpoint) ? endpoint : `${BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  let response;
  try { response = await fetch(url, { ...config, headers }); }
  catch (error) {
    if (error.name === "AbortError") throw error;
    emit(VPN_UNREACHABLE_EVENT);
    if (error.name === "TimeoutError") throw error;
    throw new NetworkError(error);
  }
  if (response.status === 401 && token && !endpoint.includes("/auth/login")) {
    clearSession();
    if (typeof window !== "undefined") {
      const data = await response.clone().json().catch(() => ({}));
      saveLoginNotice((data.error || data).message || "로그인이 만료되었습니다. 다시 로그인해 주세요.");
      window.location.replace("/login");
    }
  }
  return response;
}
export async function toApiError(response, fallback, { notify = true } = {}) {
  const data = await response.json().catch(() => ({}));
  const error = new ApiError(response.status, data, fallback);
  if (notify) emit(API_ERROR_EVENT, error);
  return error;
}
export async function request(endpoint, options = {}) {
  const config = { ...options, headers: { "Content-Type": "application/json", ...options.headers } };
  if (config.body && typeof config.body === "object" && !(config.body instanceof FormData)) config.body = JSON.stringify(config.body);
  const response = await apiFetch(endpoint, config);
  if (response.status === 204) return null;
  if (!response.ok) throw await toApiError(response, `요청에 실패했습니다. (HTTP ${response.status})`);
  return (response.headers.get("content-type") || "").includes("application/json") ? response.json() : response.text();
}
export const apiClient = {
  get: (path, options = {}) => request(path, { ...options, method: "GET" }),
  post: (path, body, options = {}) => request(path, { ...options, method: "POST", body }),
  patch: (path, body, options = {}) => request(path, { ...options, method: "PATCH", body }),
  put: (path, body, options = {}) => request(path, { ...options, method: "PUT", body }),
  delete: (path, bodyOrOptions = {}, options = {}) => bodyOrOptions.headers || bodyOrOptions.method ? request(path, { ...bodyOrOptions, method: "DELETE" }) : request(path, { ...options, method: "DELETE", body: bodyOrOptions }),
};
export default apiClient;
