import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src/features/pwa",
      filename: "sw.ts",
      injectRegister: false,
      registerType: "prompt",
      scope: "/ytso/",
      // Keep normal Vite development free of persistent service workers.
      devOptions: { enabled: false },
      injectManifest: {
        globPatterns: ["**/*.{html,js,css,png,ico,webp}"],
        dontCacheBustURLsMatching: /assets\/.*-[\w-]+\./,
      },
      manifest: {
        id: "/ytso/",
        name: "YouTube Subscription Organizer",
        short_name: "YTSO",
        description:
          "Save YouTube channels, organize categories, and catch up on recent videos.",
        start_url: "/ytso/",
        scope: "/ytso/",
        display: "standalone",
        theme_color: "#101715",
        background_color: "#101715",
        lang: "en",
        icons: [
          {
            src: "/ytso/icons/pwa-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/ytso/icons/pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/ytso/icons/maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
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
