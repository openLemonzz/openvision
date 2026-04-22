import fs from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const supabaseAuthEntry = fs.existsSync(path.resolve(__dirname, './node_modules/@supabase/auth-js/src/index.ts'))
  ? path.resolve(__dirname, './node_modules/@supabase/auth-js/src/index.ts')
  : path.resolve(__dirname, '../node_modules/@supabase/auth-js/src/index.ts');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@supabase/auth-js': supabaseAuthEntry,
      'lucide-react': path.resolve(__dirname, './icon-shim.tsx'),
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
  },
  server: {
    port: 4174,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
});
