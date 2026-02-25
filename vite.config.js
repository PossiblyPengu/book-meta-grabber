import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'ios-app',
  build: {
    target: 'esnext',
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'ios-app/index.html'),
      external: ['@capawesome/capacitor-file-picker'],
    },
  },
  server: {
    port: 3000,
    host: true,
  },
});
