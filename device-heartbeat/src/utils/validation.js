import { AppError } from "../errors/AppError.js";
export function bodyObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw AppError.badRequest("JSON object required");
  return value;
}
export function macAddress(value) {
  if (typeof value !== "string" || !/^[0-9A-F]{12}$/.test(value))
    throw AppError.badRequest(
      "mac must be 12 uppercase hex characters without colons",
    );
  return value;
}
export function text(value, key, max, required = true) {
  if (value === undefined && !required) return undefined;
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw AppError.badRequest(
      key + " must be a nonempty string of at most " + max + " characters",
    );
  return value.trim();
}
export function nonnegative(value, key, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < 0 || value > max)
    throw AppError.badRequest(key + " must be a nonnegative safe integer");
  return value;
}
export function onlyFields(body, allowed) {
  if (Object.keys(body).some((key) => !allowed.includes(key)))
    throw AppError.badRequest("Unknown request field");
}
export function sourceIp(value) {
  return typeof value === "string" ? value.replace(/^::ffff:/, "") : "";
}
