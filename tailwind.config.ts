import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        shell: {
          950: "#060b12",
          900: "#0b111a",
          850: "#101825",
          800: "#142033"
        },
        ink: {
          50: "#f6f8fb",
          200: "#cdd7e5",
          300: "#9eb0c7",
          500: "#6f8297"
        },
        accent: {
          teal: "#31d0aa",
          amber: "#f2b84b",
          red: "#f46d6d",
          blue: "#67a6ff"
        }
      },
      boxShadow: {
        panel: "0 18px 60px rgba(0, 0, 0, 0.24)"
      },
      borderRadius: {
        xl: "1.25rem",
        "2xl": "1.75rem"
      }
    }
  },
  plugins: []
};

export default config;
