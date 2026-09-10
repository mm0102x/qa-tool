import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // Empty prefix loads every var, including the non-VITE_ secrets below.
  // Only VITE_-prefixed vars are exposed to client code.
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api/zendesk": {
          target: `https://${env.VITE_ZENDESK_SUBDOMAIN}.zendesk.com`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/zendesk/, ""),
          headers: {
            Authorization:
              "Basic " +
              Buffer.from(
                `${env.ZENDESK_EMAIL}/token:${env.ZENDESK_API_TOKEN}`
              ).toString("base64"),
          },
        },
      },
    },
  };
});
