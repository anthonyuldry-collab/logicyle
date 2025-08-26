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
      // Configuration optimisée pour Node 18 avec gestion Rollup
      optimizeDeps: {
        include: ['react', 'react-dom', 'frappe-charts'],
        exclude: ['@rollup/rollup-linux-x64-gnu'],
        force: true
      },
      build: {
        target: 'es2020',
        minify: 'esbuild',
        sourcemap: false,
        rollupOptions: {
          external: ['@rollup/rollup-linux-x64-gnu'],
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
      },
      // Configuration spécifique pour éviter les erreurs Rollup
      plugins: [],
      // Forcer l'utilisation d'esbuild au lieu de Rollup si nécessaire
      build: {
        ...this.build,
        rollupOptions: {
          ...this.build?.rollupOptions,
          onwarn(warning, warn) {
            // Ignorer les avertissements sur les dépendances natives
            if (warning.code === 'UNRESOLVED_IMPORT' && 
                warning.message.includes('@rollup/rollup-linux-x64-gnu')) {
              return;
            }
            warn(warning);
          }
        }
      }
    };
});
