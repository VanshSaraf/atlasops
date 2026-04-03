import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eefbf8",
          100: "#d4f5ec",
          200: "#ace9da",
          300: "#79d8c0",
          400: "#48bda3",
          500: "#2e9e87",
          600: "#237f6d",
          700: "#1e6659",
          800: "#1d5148",
          900: "#1a443d",
          950: "#0c2723",
        },
        accent: {
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
          800: "#9a3412",
          900: "#7c2d12",
          950: "#431407",
        },
        surface: {
          DEFAULT: "#0b1214",
          raised: "#101a1d",
          overlay: "#162328",
          border: "#26363b",
        },
        ink: {
          50: "#f5f7f7",
          100: "#e7ecec",
          200: "#d2dbdb",
          300: "#aabbbb",
          400: "#819999",
          500: "#617777",
          600: "#4d5e5e",
          700: "#3d4a4a",
          800: "#293333",
          900: "#161e1e",
        },
      },
      fontFamily: {
        sans: [
          '"Plus Jakarta Sans"',
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        mono: ['"IBM Plex Mono"', '"JetBrains Mono"', "monospace"],
        display: ['"Sora"', '"Plus Jakarta Sans"', "system-ui", "sans-serif"],
      },
      animation: {
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "fade-in": "fadeIn 0.5s ease-out",
        "slide-up": "slideUp 0.5s ease-out",
        float: "float 6s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
