import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/book-meta-grabber/',
  root: '.',
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
