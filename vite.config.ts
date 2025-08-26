import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      // Configuration optimisée pour Node 18
      optimizeDeps: {
        include: ['react', 'react-dom', 'frappe-charts'],
        exclude: [],
        force: true
      },
      build: {
        target: 'es2020',
        minify: 'esbuild',
        sourcemap: false,
        rollupOptions: {
          external: [],
          output: {
            manualChunks: {
              vendor: ['react', 'react-dom'],
              charts: ['frappe-charts']
            }
          }
        }
      },
      // Configuration TypeScript optimisée
      esbuild: {
        jsx: 'automatic'
      },
      // Configuration pour éviter les problèmes de build
      server: {
        port: 3000,
        host: true
      },
      preview: {
        port: 4173,
        host: true
      }
    };
});
