import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode, command }) => {
    const env = loadEnv(mode, '.', '');
    
    // Para desenvolvimento: sempre usar /
    // Para build: usar /padronizacao/ se for para GitHub Pages
    const base = command === 'build' && process.env.GITHUB_ACTIONS ? '/padronizacao/' : '/';
    
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
