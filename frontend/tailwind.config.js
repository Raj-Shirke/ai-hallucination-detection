/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        hubtown: {
          bg: "#090a0c", // Ultra-deep charcoal canvas
          surface: "#111216", // Card background
          border: "#23252e", // Crisp structural divider
          gold: "#c5a880", // Luxury champagne/gold accent
          goldHover: "#b5976f",
          muted: "#80828d", // Subdued secondary typography
        },
      },
      letterSpacing: {
        widest: ".2em",
        ultra: ".28em",
      },
    },
  },
  plugins: [],
};
