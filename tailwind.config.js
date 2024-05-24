/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      animation: {
        open: "menuOpen .7s ease-out forwards",
        close: "menuClose 1s ease-in-out forwards",
      },
      keyframes: {
        menuOpen: {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        menuClose: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
      colors: {
        dark: "#111",
        light: "#ddd",
        accent: {
          dark: "#195749",
          light: "#35b598",
        },
      },
    },
  },
  plugins: [],
};
