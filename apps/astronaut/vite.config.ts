/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Same backend proxy as frontend/ (FastAPI on 127.0.0.1:8001); used by both `npm run dev` and `npm run preview`.
const proxy = {
  '/api': {
    target: 'http://127.0.0.1:8001',
    changeOrigin: true,
  },
}

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'bg/space.jpg', 'fonts/inter-latin-var.woff2'],
      manifest: {
        name: 'NurtureAI Astronaut',
        short_name: 'Astronaut',
        description: 'Offline-first daily health check-in for crew members.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#020617',
        theme_color: '#020617',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        // Precache the app shell only. API data lives in IndexedDB (see src/db.ts), never in the SW cache.
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,woff2,webmanifest}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  server: {
    port: 3001,
    strictPort: true,
    host: true,
    proxy,
  },
  preview: {
    port: 3001,
    strictPort: true,
    host: true,
    proxy,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
