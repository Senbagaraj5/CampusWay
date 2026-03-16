import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: '/',
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: {
        // Omitting host allows Vite to use window.location.hostname on the client device
        clientPort: 3000
      }
    },
    plugins: [react()],
    define: {
      'process.env': {}
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'map-vendor': ['leaflet', 'react-leaflet'],
            'ai-vendor': ['@google/genai'],
            'firebase-vendor': ['firebase/app', 'firebase/database'],
          }
        }
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
