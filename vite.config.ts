import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'favicon.png', 'apple-touch-icon.png', 'orca-logo.svg'],
        manifest: {
          id: '/',
          name: 'أوركا للشحن السريع والخدمات اللوجستية',
          short_name: 'أوركا للشحن',
          description: 'تطبيق أوركا الشامل للشحن واللوجستيات والصناديق المالية',
          theme_color: '#0f172a',
          background_color: '#0f172a',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          skipWaiting: true,
          clientsClaim: true,
          cleanupOutdatedCaches: true,
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          // Zero-Browser-Cache: Do not pre-cache application bundle/html files
          globPatterns: [],
          runtimeCaching: [],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      chunkSizeWarningLimit: 4000,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-ocr': ['tesseract.js'],
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: {
        ignored: [
          '**/vps-data/**',
          '**/vps-data/*',
          '**/*.log',
          '**/orca-database.json',
          '**/.git/**',
          '**/node_modules/**',
          '**/dist/**',
        ],
      },
    },
  };
});
