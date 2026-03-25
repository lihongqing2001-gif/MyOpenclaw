import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR === 'true'
        ? false
        : {
            port: Number(process.env.OPENCLAW_WEB_HMR_PORT || 24679),
          },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
  };
});
