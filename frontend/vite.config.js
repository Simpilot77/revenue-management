import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/app/',
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      // Proxy für Lodgify API (umgeht CORS im Dev-Server)
      '/lodgify-proxy': {
        target: 'https://api.lodgify.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/lodgify-proxy/, ''),
      },
    },
  },
});
