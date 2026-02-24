import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'ios-app',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'ios-app/index.html'),
    },
  },
  server: {
    port: 3000,
    host: true,
  },
});
