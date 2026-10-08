import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const DJANGO = 'http://127.0.0.1:8000'

// Le proxy remplace l'hôte par celui de Django (changeOrigin) ; on aligne l'en-tête Origin,
// sinon Django refuse les écritures (« Origin checking failed »), y compris depuis un téléphone
// sur le Wi-Fi. Le jeton CSRF (en-tête X-CSRFToken) reste vérifié. Développement uniquement :
// en production, le site et l'API sont servis sur le même domaine.
const versDjango = {
  target: DJANGO,
  changeOrigin: true,
  configure: (proxy) => {
    proxy.on('proxyReq', (requete) => {
      if (requete.getHeader('origin')) requete.setHeader('origin', DJANGO)
    })
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Rend le serveur accessible depuis un téléphone sur le même Wi-Fi.
    host: true,
    proxy: {
      '/api': versDjango,
      '/media': DJANGO,
    },
  },
})
