import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

/**
 * Writes app.html, a copy of the built index.html: the app shell with no page's content. In
 * production the prerender step (scripts/prerender.ts) turns index.html into the home page, so
 * app-only routes and the service worker's page-load fallback need a shell of their own.
 */
function appShell(): Plugin {
  return {
    name: "app-shell",
    enforce: "post",
    generateBundle(_options, bundle) {
      const index = bundle["index.html"];
      if (index?.type !== "asset") throw new Error("[app-shell] no index.html in the bundle");
      this.emitFile({ type: "asset", fileName: "app.html", source: index.source });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    appShell(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "GetMeCollege — MHT-CET CAP Cutoffs",
        short_name: "GetMeCollege",
        description: "Past MHT-CET CAP closing ranks for every Maharashtra engineering college and branch, from the official CET Cell lists",
        start_url: "/",
        display: "standalone",
        background_color: "#f8fafc",
        theme_color: "#2563eb",
        orientation: "portrait-primary",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,svg,woff2}"],
        // the empty shell, not index.html: in production index.html is the prerendered home page
        navigateFallback: "app.html",
        // The app shell answers page loads, but not files: /sitemap.xml, /robots.txt and the like
        // must come from the server, or a returning visitor opening them sees the landing page
        navigateFallbackDenylist: [/^\/api\//, /\/[^/?]+\.[a-z0-9]+$/i],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /\/api\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
