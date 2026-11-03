import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import fs from "fs";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "sync-root-html",
      writeBundle() {
        try {
          const nestedHtml = resolve(
            import.meta.dirname,
            "dist/public/index.html",
          );
          const rootHtml = resolve(import.meta.dirname, "dist/index.html");
          if (fs.existsSync(nestedHtml)) {
            fs.copyFileSync(nestedHtml, rootHtml);
          }
        } catch (e) {
          // ignore
        }
      },
    },
  ],
  build: {
    rollupOptions: {
      input: resolve(import.meta.dirname, "public/index.html"),
    },
  },
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
