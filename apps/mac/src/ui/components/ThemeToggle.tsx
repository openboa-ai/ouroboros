import { SunMoon } from "lucide-react";
import { Button } from "@/ui/primitives/button";
import { useTheme } from "./theme-provider";
/** One toggle behavior across the app and calibration, including an inherited system theme. */
export function ThemeToggle() {
  const { setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Toggle theme"
      onClick={() =>
        setTheme(
          document.documentElement.classList.contains("dark")
            ? "light"
            : "dark",
        )
      }
    >
      <SunMoon />
    </Button>
  );
}
