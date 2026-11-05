import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.API_PROXY_TARGET || "http://localhost:3000";
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        // Longest /v1/vpn match comes before /v1; C1 stays on its current target.
        "/v1/vpn": {
          target: env.VPN_PROXY_TARGET || apiTarget,
          changeOrigin: true,
        },
        ...Object.fromEntries(
          [
            "/v1",
            "/auth",
            "/vpn",
            "/devices",
            "/events",
            "/notifications",
            "/storage",
          ].map((path) => [path, { target: apiTarget, changeOrigin: true }]),
        ),
      },
    },
    preview: { port: 4173 },
  };
});
