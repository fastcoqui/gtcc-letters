import { defineConfig } from 'vite';

export default defineConfig({
  base: '/gtcc-letters/',
  build: {
    outDir: 'dist',
    sourcemap: false,
    modulePreload: false,
    chunkSizeWarningLimit: 1200,
  },
});
