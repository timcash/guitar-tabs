import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.VITE_SITE_BASE_PATH || '/',
  server: {
    port: 5174,
    proxy: {
      '/api/codex': {
        target: 'http://127.0.0.1:4176',
        changeOrigin: false
      },
      '/codex-bridge': {
        target: 'ws://127.0.0.1:4176',
        ws: true
      }
    }
  },
  preview: {
    port: 5174
  }
});
