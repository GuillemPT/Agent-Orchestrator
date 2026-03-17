import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const isWebMode = process.env.VITE_MODE === 'web';

export default defineConfig({
  plugins: [react()],
  root: 'src/renderer',
  base: './',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@domain': path.resolve(__dirname, './src/domain'),
      '@application': path.resolve(__dirname, './src/application'),
      '@infrastructure': path.resolve(__dirname, './src/infrastructure'),
      '@presentation': path.resolve(__dirname, './src/presentation'),
    },
  },
  server: {
    port: 3000,
    open: false,
    ...(isWebMode && {
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          // Skip proxy for source file requests (e.g. /api/index.ts)
          // so Vite can serve modules from src/renderer/api/
          bypass(req) {
            if (req.url && /\.\w+(\?|$)/.test(req.url)) {
              return req.url;
            }
          },
        },
      },
    }),
  },
});
