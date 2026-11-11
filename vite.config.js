import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        // libraries change rarely: separate, long-cacheable files; app code stays small
        manualChunks: {
          three: ['three'],
          post: ['postprocessing', 'n8ao'],
        },
      },
    },
  },
});
