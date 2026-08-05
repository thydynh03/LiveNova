import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: false,
  },
  envPrefix: ['VITE_', 'WAILS_'],
  build: {
    // WebView2 on Windows; both it and WebKit elsewhere are evergreen.
    target: ['es2021', 'chrome100', 'safari13'],
    minify: !process.env.WAILS_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.WAILS_DEBUG,
  },
});
