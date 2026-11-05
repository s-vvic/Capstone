/**
 * SecureCam Web Dashboard - 공통 HTTP API 클라이언트
 * Master Controller (/v1) 및 하위 컴포넌트 REST API 연동
 */

const BASE_URL = (import.meta.env?.VITE_API_BASE_URL || "/v1").replace(
  /\/$/,
  "",
);

export function getAuthToken() {
  return (
    localStorage.getItem("accessToken") || localStorage.getItem("token") || ""
  );
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem("accessToken", token);
  } else {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("token");
  }
}

export async function request(endpoint, options = {}) {
  const { timeoutMs, ...fetchOptions } = options;
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const token = getAuthToken();
  if (token && !headers.Authorization && !headers.authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const config = {
    ...fetchOptions,
    headers,
  };

  if (timeoutMs) {
    const timeout = AbortSignal.timeout(timeoutMs);
    config.signal = options.signal
      ? AbortSignal.any([options.signal, timeout])
      : timeout;
  }

  if (
    config.body &&
    typeof config.body === "object" &&
    !(config.body instanceof FormData)
  ) {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(url, config);

  // 204 No Content
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  let data;
  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorObj =
      typeof data === "object" && data !== null ? data.error || data : {};
    const message =
      errorObj.message ||
      (typeof data === "string"
        ? data
        : `요청에 실패했습니다. (HTTP ${response.status})`);

    const error = new Error(message);
    error.status = response.status;
    error.statusCode = response.status;
    error.code =
      errorObj.error_code ||
      errorObj.code ||
      (response.status === 401 ? "UNAUTHORIZED" : "API_ERROR");
    error.details = errorObj.details || null;
    throw error;
  }

  return data;
}

export const apiClient = {
  get: (endpoint, options = {}) =>
    request(endpoint, { ...options, method: "GET" }),
  post: (endpoint, body, options = {}) =>
    request(endpoint, { ...options, method: "POST", body }),
  patch: (endpoint, body, options = {}) =>
    request(endpoint, { ...options, method: "PATCH", body }),
  put: (endpoint, body, options = {}) =>
    request(endpoint, { ...options, method: "PUT", body }),
  delete: (endpoint, bodyOrOptions = {}, options = {}) => {
    if (
      typeof bodyOrOptions === "object" &&
      !bodyOrOptions.headers &&
      !bodyOrOptions.method
    ) {
      return request(endpoint, {
        ...options,
        method: "DELETE",
        body: bodyOrOptions,
      });
    }
    return request(endpoint, { ...bodyOrOptions, method: "DELETE" });
  },
};

export default apiClient;
