import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Port 5180 zamiast domyślnego 5173 — domyślny bywa zajęty w środowisku lokalnym.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5180,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3100',
        changeOrigin: true,
      },
    },
  },
});
