import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": new URL("./src", import.meta.url).pathname },
  },
  server: {
    port: 5173,
    proxy: {
      // Évite toute question de CORS en développement : le front et l'API
      // partagent la même origine vue du navigateur.
      "/api": { target: "http://127.0.0.1:8000", changeOrigin: true },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/tests/configuration.ts"],
    globals: true,
    coverage: {
      reporter: ["text", "lcov"],
      exclude: ["src/api/genere.ts", "**/*.config.*", "src/main.tsx"],
    },
  },
});
