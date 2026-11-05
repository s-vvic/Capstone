const KEY_TOKEN = "accessToken";
const stores = () => [globalThis.localStorage, globalThis.sessionStorage].filter(Boolean);
export function getAccessToken() { return globalThis.localStorage?.getItem(KEY_TOKEN) || globalThis.sessionStorage?.getItem(KEY_TOKEN) || null; }
export function isRememberMe() { return localStorage.getItem("rememberMe") === "true"; }
export function getRememberedEmail() { return localStorage.getItem("rememberedEmail") || ""; }
export function hasSavedSession() { return isRememberMe() && !!localStorage.getItem(KEY_TOKEN); }
export function clearSession() {
  for (const storage of stores()) for (const key of [KEY_TOKEN, "token", "refreshToken"]) storage.removeItem(key);
  if (typeof window !== "undefined") window.dispatchEvent(new Event("session-cleared"));
}
export function saveSession(email, token, rememberMe) {
  clearSession();
  if (rememberMe) {
    localStorage.setItem("rememberMe", "true");localStorage.setItem("rememberedEmail", email);localStorage.setItem(KEY_TOKEN, token);
  } else {
    localStorage.removeItem("rememberMe");localStorage.removeItem("rememberedEmail");sessionStorage.setItem(KEY_TOKEN, token);
  }
}
export function saveLoginNotice(message) { globalThis.sessionStorage?.setItem("loginNotice", message); }
export function takeLoginNotice() { const message = globalThis.sessionStorage?.getItem("loginNotice");globalThis.sessionStorage?.removeItem("loginNotice");return message; }
