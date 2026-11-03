import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/v1": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/auth": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/vpn": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/devices": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/events": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/notifications": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/storage": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
  },
});
