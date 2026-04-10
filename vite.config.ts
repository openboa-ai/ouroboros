import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) {
            return "react-vendor";
          }

          if (id.includes("node_modules/recharts")) {
            return "chart-vendor";
          }

          if (id.includes("node_modules/lucide-react")) {
            return "ui-vendor";
          }

          if (id.includes("@tauri-apps/api")) {
            return "tauri-vendor";
          }

          return undefined;
        }
      }
    }
  },
  server: {
    host: "0.0.0.0",
    port: 1420,
    strictPort: true
  },
  preview: {
    host: "0.0.0.0",
    port: 1420,
    strictPort: true
  }
});
