import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// La consola corre en el puerto 5173; la API de la plataforma en el 4000.
// Proxy: lo que la consola pida a /api/... Vite lo reenvia a la API (evita bloqueos CORS).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        rewrite: (ruta) => ruta.replace(/^\/api/, ''),
      },
    },
  },
});
