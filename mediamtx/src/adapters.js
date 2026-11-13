import { databaseOptions } from "../../shared/config.mjs";
import pg from "pg";
import { GatewayError } from "./errors.js";

export function createDeviceStore(env = process.env) {
  const pool = new pg.Pool({
    ...databaseOptions(env),
    max: 5,
    connectionTimeoutMillis: 5000,
  });
  pool.on("error", (error) =>
    console.error(
      JSON.stringify({
        level: "error",
        component: "C7",
        error_code: error.code || "DB_POOL_ERROR",
      }),
    ),
  );
  return {
    async findOwned(mac, userId) {
      const result = await pool.query(
        "SELECT device_id, mac, vpn_ip, is_active FROM devices WHERE mac = $1 AND user_id = $2 AND is_active = true",
        [mac, userId],
      );
      return result.rows[0] || null;
    },
    async health() {
      await pool.query(
        "SELECT mac, user_id, vpn_ip, is_active FROM devices LIMIT 0",
      );
    },
    close: () => pool.end(),
  };
}

export function createAuthenticator(config, fetchImpl = fetch) {
  return async (authorization) => {
    if (!/^Bearer [^\s]+$/.test(authorization || ""))
      throw new GatewayError(401, "UNAUTHORIZED", "Bearer token required");
    let response;
    try {
      response = await fetchImpl(config.authMeUrl, {
        headers: { authorization },
        redirect: "error",
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      throw new GatewayError(
        503,
        "AUTH_UNAVAILABLE",
        "Authentication service unavailable",
      );
    }
    if ([401, 403].includes(response.status)) {
      await response.body?.cancel();
      throw new GatewayError(401, "UNAUTHORIZED", "Login session is invalid");
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new GatewayError(
        503,
        "AUTH_UNAVAILABLE",
        "Authentication service unavailable",
      );
    }
    let profile;
    try {
      profile = await response.json();
    } catch {
      throw new GatewayError(
        503,
        "AUTH_UNAVAILABLE",
        "Invalid authentication response",
      );
    }
    if (!profile.user_id)
      throw new GatewayError(
        503,
        "AUTH_UNAVAILABLE",
        "Invalid authentication response",
      );
    return { userId: String(profile.user_id), plan: profile.plan };
  };
}
