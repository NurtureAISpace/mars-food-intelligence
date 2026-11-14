/// <reference types="vitest" />
import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Build label shown in the app footer ("build 1a2b3c4 · 2026-11-15 10:42"), so a demo can tell which build is open.
function buildLabel(): string {
  let hash = 'nogit'
  try {
    hash = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    /* not a git checkout */
  }
  const t = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `build ${hash} · ${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())} ${p(t.getHours())}:${p(t.getMinutes())}`
}

// Same backend proxy as frontend/ (FastAPI on 127.0.0.1:8001); used by both `npm run dev` (3001) and `npm run preview` (4173).
// host: true = listen on the LAN too (judges' phones); the backend itself stays on 127.0.0.1.
const proxy = {
  '/api': {
    target: 'http://127.0.0.1:8001',
    changeOrigin: true,
  },
}

export default defineConfig(({ command }) => ({
  define: {
    __APP_BUILD__: JSON.stringify(command === 'build' ? buildLabel() : 'dev server (not the demo build)'),
  },
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
    port: 4173, // LAN demo: phones open http://<PC-IP>:4173 (QR on the dashboard Crew screen)
    strictPort: true,
    host: true,
    proxy,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}))
