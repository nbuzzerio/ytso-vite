import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/ytso/",
  server: {
    proxy: {
      "/ytso/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
