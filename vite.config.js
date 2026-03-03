import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { VitePWA } from 'vite-plugin-pwa';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  base: '/book-meta-grabber/',
  root: '.',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script',
      // Generated PNGs (produced by: npm run generate-icons)
      includeAssets: [
        'apple-touch-icon-180x180.png',
        'pwa-64x64.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'maskable-icon-512x512.png',
        'favicon.ico',
      ],
      manifest: {
        name: 'Book Meta Grabber',
        short_name: 'BookMeta',
        description: 'Extract and enrich metadata from your book collection',
        start_url: '/book-meta-grabber/',
        scope: '/book-meta-grabber/',
        display: 'standalone',
        background_color: '#0a0a0f',
        theme_color: '#7C3AED',
        orientation: 'any',
        icons: [
          {
            src: 'pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png',
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Cache API responses for metadata lookups
        runtimeCaching: [
          {
            urlPattern:
              /^https:\/\/(books\.googleapis\.com|openlibrary\.org|itunes\.apple\.com)\/.*$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 86400 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    target: 'esnext',
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
    },
  },
  server: {
    port: 3000,
    host: true,
  },
});
