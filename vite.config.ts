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
      // Configuration pour Node 20+
      optimizeDeps: {
        include: ['react', 'react-dom', 'frappe-charts'],
        exclude: []
      },
      build: {
        target: 'es2022',
        minify: 'esbuild',
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
      // Configuration TypeScript simplifiée
      esbuild: {
        jsx: 'automatic'
      }
    };
});
