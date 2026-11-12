import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the same build works at a domain root or under /<repo>/ on GitHub Pages.
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Soccer Whiteboard',
        short_name: 'Soccerboard',
        description: 'Drag the ball and see where every player should go, and why.',
        display: 'standalone',
        orientation: 'any',
        start_url: '.',
        scope: '.',
        background_color: '#14532d',
        theme_color: '#14532d',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'] },
    }),
  ],
  test: {
    include: ['tests/engine/**/*.spec.ts', 'tests/model/**/*.spec.ts'],
    environment: 'node',
  },
});
