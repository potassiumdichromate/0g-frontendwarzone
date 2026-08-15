import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Vite plugin: redirect @noble/hashes/utils.js → @noble/hashes/utils
// Works regardless of installed version (older versions only export ./utils not ./utils.js)
const nobleHashesCompat = {
  name: 'noble-hashes-compat',
  enforce: 'pre',
  resolveId(id: string) {
    if (id === '@noble/hashes/utils.js') {
      return { id: '@noble/hashes/utils', external: false }
    }
  },
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [
    nobleHashesCompat,
    react(),
    nodePolyfills({
      include: ['buffer', 'crypto', 'stream', 'util'],
      globals: {
        Buffer: true,
        process: true,
      },
    }),
  ],
  css: {
    postcss: './postcss.config.js',
  },
  resolve: {
    alias: [
      { find: /^@noble\/hashes\/utils\.js$/, replacement: '@noble/hashes/utils' },
      { find: '@', replacement: path.resolve(__dirname, './src') },
      { find: 'crypto', replacement: 'crypto-browserify' },
      { find: 'stream', replacement: 'stream-browserify' },
      { find: 'util', replacement: 'util' },
      { find: 'http', replacement: 'stream-http' },
      { find: 'https', replacement: 'https-browserify' },
      { find: 'os', replacement: 'os-browserify/browser' },
      { find: 'path', replacement: 'path-browserify' },
    ],
    dedupe: ['@noble/hashes'],
  },
  define: {
    'process.env': {},
    global: 'globalThis',
  },
  server: {
    port: 3000,
    open: true,
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2020',
      define: {
        global: 'globalThis',
      },
    },
  },
  build: {
    commonjsOptions: {
      // Required for @noble/hashes and WalletConnect CJS interop on Rollup 4
      transformMixedEsModules: true,
    },
  },
});
