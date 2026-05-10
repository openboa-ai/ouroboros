import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 5173);

export default defineConfig({
  plugins: [react()],
  server: {
    host,
    port
  }
});
