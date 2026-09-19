import { fileURLToPath, URL } from "node:url"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"
export default defineConfig({plugins:[react(),tailwindcss()],resolve:{alias:{"@":fileURLToPath(new URL("./src",import.meta.url))},dedupe:["react","react-dom"]},clearScreen:false,server:{host:"127.0.0.1",port:1420,strictPort:true},envPrefix:["VITE_"],build:{target:"es2022"}})
