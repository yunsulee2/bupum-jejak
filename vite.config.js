import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^three$/,
        replacement: fileURLToPath(new URL('./node_modules/three/src/Three.js', import.meta.url)),
      },
    ],
  },
  build: {
    manifest: true,
    rollupOptions: {
      output: {
        onlyExplicitManualChunks: true,
        manualChunks(id) {
          if (!id.includes('/node_modules/three/')) return undefined;
          if (id.includes('/examples/jsm/postprocessing/') || id.includes('/examples/jsm/shaders/')) {
            return 'three-postprocessing';
          }
          if (id.includes('/examples/jsm/')) return 'three-addons';
          return undefined;
        },
      },
    },
  },
});
