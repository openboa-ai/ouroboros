import { fileURLToPath,URL } from "node:url"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"
export default defineConfig({plugins:[react(),tailwindcss()],publicDir:"../../apps/mac/public",resolve:{alias:{"@":fileURLToPath(new URL("../../apps/mac/src",import.meta.url))},dedupe:["react","react-dom"]},server:{fs:{allow:["../.."]}}})
