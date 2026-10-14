import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const envDir = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, "");
  const frontendPort = Number(env.FRONTEND_PORT || 3000);
  const backendPort = Number(env.BACKEND_PORT || env.PORT || 5001);
  const apiTarget = env.VITE_API_PROXY_TARGET ?? `http://localhost:${backendPort}`;

  return {
    envDir,
    plugins: [react()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      port: frontendPort,
      open: true,
      proxy: {
        "/api": { target: apiTarget, changeOrigin: true },
      },
    },
    preview: {
      port: frontendPort,
    },
    // server.js serves client/build and zip_project.py ships that folder to
    // Elastic Beanstalk, so the bundle has to land there rather than in dist/.
    build: {
      outDir: "build",
      sourcemap: true,
    },
  };
});
