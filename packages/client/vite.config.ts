import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    extensions: ['.mts', '.ts', '.tsx', '.mjs', '.js', '.jsx', '.json'],
    alias: {
      '@shit-head-palace/engine': path.resolve(
        __dirname,
        '../engine/src/index.ts',
      ),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3456',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:3456',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3456',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
