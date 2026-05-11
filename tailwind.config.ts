import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        tr: {
          bg: "rgb(var(--tr-bg) / <alpha-value>)",
          panel: "rgb(var(--tr-panel) / <alpha-value>)",
          card: "rgb(var(--tr-card) / <alpha-value>)",
          accent: "#7c3aed",
          text: "rgb(var(--tr-text) / <alpha-value>)",
          muted: "rgb(var(--tr-muted) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
