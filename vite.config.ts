import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Polyfill process.env.API_KEY for the frontend code
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3001', // Use explicit IPv4 to prevent ECONNREFUSED on some systems
          changeOrigin: true,
          secure: false,
        }
      }
    }
  };
});