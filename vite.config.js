import { defineConfig } from 'vite';
import { resolve } from 'path';

// Stub out Capacitor native plugins so Vite dev-server doesn't fail.
// At runtime these are loaded via dynamic import() with try/catch fallback.
const capacitorExternals = [
  '@capawesome/capacitor-file-picker',
  '@capacitor/preferences',
  '@capacitor/browser',
  '@capacitor/filesystem',
];

function capacitorStubPlugin() {
  return {
    name: 'capacitor-stub',
    resolveId(id) {
      if (capacitorExternals.includes(id)) return id;
    },
    load(id) {
      if (capacitorExternals.includes(id)) return 'export default {}';
    },
  };
}

export default defineConfig({
  root: '.',
  plugins: [capacitorStubPlugin()],
  build: {
    target: 'esnext',
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
      external: capacitorExternals,
    },
  },
  server: {
    port: 3000,
    host: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
