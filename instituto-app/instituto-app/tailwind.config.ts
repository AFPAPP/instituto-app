import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        azul:      { DEFAULT: "#3E5C76", light: "#6B8294", dark: "#2C4158" },
        crema:     { DEFAULT: "#FAF3E8", dark: "#F0E6D3" },
        terracota: { DEFAULT: "#BC4A3C", light: "#D4706A", dark: "#8B3228" },
        gris:      { DEFAULT: "#F5F5F5", medio: "#E0E0E0", oscuro: "#9CA8B3" },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
