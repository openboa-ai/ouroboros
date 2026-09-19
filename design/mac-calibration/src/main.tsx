import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "@/ui/styles.css"
import App from "./App"
import { ThemeProvider } from "@/ui/components/theme-provider"
createRoot(document.getElementById("root")!).render(<StrictMode><ThemeProvider defaultTheme="light" storageKey="ouroboros-calibration-theme"><App /></ThemeProvider></StrictMode>)
