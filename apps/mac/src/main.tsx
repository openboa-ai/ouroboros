import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./ui/styles.css"
import "./app/app.css"
import { ThemeProvider } from "./ui/components/theme-provider"
import { TooltipProvider } from "./ui/primitives/tooltip"
import App from "./App"
createRoot(document.getElementById("root")!).render(<StrictMode><ThemeProvider defaultTheme="system" storageKey="ouroboros.theme"><TooltipProvider><App /></TooltipProvider></ThemeProvider></StrictMode>)
