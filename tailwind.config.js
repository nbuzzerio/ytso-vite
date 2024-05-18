/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
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
