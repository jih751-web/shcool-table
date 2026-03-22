import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: '울릉중학교 시간표',
        short_name: '울중시간표',
        description: '울릉중학교 지능형 시간표 관리 시스템',
        theme_color: '#4f46e5',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        navigateFallback: '/index.html',
        navigateFallbackAllowlist: [/^(?!\/__).*/]
      }
    })
  ],
  base: '/',
  build: {
    assetsDir: 'assets',
    sourcemap: false,
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // Vercel dev 또는 local Node 서버 타겟
        changeOrigin: true,
        secure: false,
      }
    }
  },
})
