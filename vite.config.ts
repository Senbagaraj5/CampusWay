import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      'process.env': {
        API_KEY: env.VITE_GOOGLE_MAPS_API_KEY || env.GEMINI_API_KEY,
        GEMINI_API_KEY: env.GEMINI_API_KEY,
        GOOGLE_MAPS_API_KEY: env.VITE_GOOGLE_MAPS_API_KEY,
        REACT_APP_API_URL: env.REACT_APP_API_URL
      }
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
