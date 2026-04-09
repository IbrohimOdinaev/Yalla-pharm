import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    screens: {
      xs: "375px",
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    extend: {
      colors: {
        primary: "#0058bc",
        "primary-container": "#0070eb",
        secondary: "#006b57",
        tertiary: "#705d00",
        surface: "#faf8ff",
        "surface-container": "#eaedff",
        "surface-container-low": "#f2f3ff",
        "surface-container-high": "#e3e7fb",
        "surface-container-highest": "#dee2f5",
        "surface-container-lowest": "#ffffff",
        "on-surface": "#161b29",
        "on-surface-variant": "#414755",
        outline: "#717786"
      },
      boxShadow: {
        glass: "0 8px 30px rgba(22, 27, 41, 0.08)",
        card: "0 6px 24px rgba(22, 27, 41, 0.06)"
      },
      borderRadius: {
        xl2: "1.25rem"
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
