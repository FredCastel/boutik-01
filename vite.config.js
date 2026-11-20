import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// BASE = sous-chemin GitHub Pages (ex: /boutik/), défini dans le workflow
export default defineConfig({
  base: process.env.BASE || '/',
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Boutik',
        short_name: 'Boutik',
        description: 'Gestion des bons de commande et paiements',
        theme_color: '#6b3e26',
        background_color: '#fffaf5',
        display: 'standalone',
        lang: 'fr',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ]
})
