import { build } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const app = fileURLToPath(new URL("../", import.meta.url)),
  sdk = path.resolve(app, "../../packages/company-ui-sdk");
await build({
  configFile: false,
  root: app,
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.join(app, "src") } },
  build: {
    outDir: path.join(sdk, "dist"),
    emptyOutDir: true,
    lib: {
      entry: path.join(sdk, "ui.ts"),
      formats: ["es"],
      fileName: "ui",
      cssFileName: "styles",
    },
    rollupOptions: { external: ["react", "react-dom", "react/jsx-runtime"] },
  },
});
fs.mkdirSync(path.join(sdk, "dist/brand"), { recursive: true });
fs.copyFileSync(
  path.join(app, "public/brand/MartianGrotesk-wdth-wght.ttf"),
  path.join(sdk, "dist/brand/MartianGrotesk-wdth-wght.ttf"),
);
console.log(
  "Public SDK built from the product UI source; no company package was compiled.",
);
