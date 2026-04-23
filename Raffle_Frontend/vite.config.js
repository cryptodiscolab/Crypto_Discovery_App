import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { visualizer } from "rollup-plugin-visualizer";

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Detect environment
const isLocalDev = process.env.NODE_ENV === 'development' && !process.env.VERCEL && !process.env.CI;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), visualizer({
    open: false,
    gzipSize: true,
    brotliSize: true,
    filename: "stats.html"
  })],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      'react/jsx-runtime': path.resolve(__dirname, 'node_modules/react/jsx-runtime'),
      'react/jsx-dev-runtime': path.resolve(__dirname, 'node_modules/react/jsx-dev-runtime'),
      'react-dom/client': path.resolve(__dirname, 'node_modules/react-dom/client'),
      'react-is': path.resolve(__dirname, 'node_modules/react-is'),
      'lucide-react': path.resolve(__dirname, './node_modules/lucide-react'),
    },
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom/client', 'react-is', 'lucide-react'],
  },
  define: {
    'process.env': {},
    'global': 'globalThis',
    'Buffer': ['buffer', 'Buffer'], // Vite 5+ automated polyfill hint or manual injection
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: false,
    cssCodeSplit: true,
    rollupOptions: {
      treeshake: false, // Disabled to fix Li.Fi AST parsing error (even with lazy loading)
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-web3': ['wagmi', 'viem', '@rainbow-me/rainbowkit'],
          'vendor-ui': ['lucide-react', 'react-hot-toast']
        },
      },
      onwarn(warning, warn) {
        if (warning.code === 'CIRCULAR_DEPENDENCY') return;
        if (warning.code === 'EVAL') return;
        if (warning.message?.includes('/*#__PURE__*/')) return;
        warn(warning);
      }
    },
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true
    }
  },
  server: {
    watch: isLocalDev ? {
      ignored: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
    } : undefined,
    hmr: {
      overlay: true,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  optimizeDeps: {
    include: ['wagmi', 'viem', '@rainbow-me/rainbowkit', '@pigment-css/react', '@lifi/sdk'],
    esbuildOptions: {
      target: 'esnext',
    }
  }
});
