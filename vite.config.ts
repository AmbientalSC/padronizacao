import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode, command }) => {
    const env = loadEnv(mode, '.', '');
    
    // Para GitHub Pages, sempre usar o base path /padronizacao/ no build
    const base = command === 'build' ? '/padronizacao/' : '/';
    
    return {
      base,
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: false,
        // Garantir que os assets sejam referenciados corretamente
        rollupOptions: {
          output: {
            assetFileNames: 'assets/[name].[hash].[ext]'
          }
        }
      }
    };
});
