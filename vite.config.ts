import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// /api is served by the auth server (server/index.js). Proxying keeps it same-origin,
// so the session cookie stays first-party and no CORS is needed.
const api = { "/api": { target: "http://127.0.0.1:8787", changeOrigin: false } };

export default defineConfig({
  plugins: [react()],
  worker: { format: "es" }, // the code runners are module workers (Technical tab)
  server: { port: 5173, proxy: api },
  preview: { proxy: api },
});
