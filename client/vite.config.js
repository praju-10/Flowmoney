import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// FlowMoney is a static, installable web app (PWA). Data is stored on the device, so there is no API server to proxy to.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'FlowMoney',
        short_name: 'FlowMoney',
        description: 'Private personal finance. Your data stays on this device.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#070c18',
        theme_color: '#070c18',
        categories: ['finance', 'productivity'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Cache everything (incl. the SQLite .wasm) so the app opens offline.
        globPatterns: ['**/*.{js,css,html,svg,png,wasm,webmanifest}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
  // The shared finance code lives in ../server/src and is imported directly.
  server: { host: '127.0.0.1', port: 5173, fs: { allow: ['..'] } },
  build: { target: 'es2020' },
});
