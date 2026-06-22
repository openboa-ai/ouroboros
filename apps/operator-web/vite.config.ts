import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 5173);
const chartingDependencyMarkers = [
  "/node_modules/recharts/",
  "/node_modules/victory-vendor/",
  "/node_modules/d3-",
  "/node_modules/@reduxjs/toolkit/",
  "/node_modules/@standard-schema/",
  "/node_modules/decimal.js-light/",
  "/node_modules/es-toolkit/",
  "/node_modules/eventemitter3/",
  "/node_modules/immer/",
  "/node_modules/internmap/",
  "/node_modules/react-is/",
  "/node_modules/react-redux/",
  "/node_modules/redux/",
  "/node_modules/reselect/",
  "/node_modules/tiny-invariant/",
  "/node_modules/use-sync-external-store/"
];

function isChartingDependency(id: string): boolean {
  return chartingDependencyMarkers.some((marker) => id.includes(marker));
}

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (isChartingDependency(id)) {
            return "operator-charting";
          }
          if (id.includes("/node_modules/")) {
            return "operator-vendor";
          }
        }
      }
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  server: {
    host,
    port
  }
});
