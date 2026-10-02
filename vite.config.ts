import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      manifest: {
        name: 'A Town Called Intervale',
        short_name: 'Intervale',
        description: 'Technical Spike — internal build',
        start_url: '/',
        display: 'standalone',
        background_color: '#F4E7D3',
        theme_color: '#2D2926',
      },
    }),
  ],
});
