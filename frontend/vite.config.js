import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Date de la version, heure de Libreville : affichée dans le pied de page pour
// vérifier d'un coup d'œil qu'une mise en ligne est bien arrivée.
// (UTC+1 calculé à la main : pas de dépendance aux fuseaux horaires du serveur de build)
const t = new Date(Date.now() + 60 * 60 * 1000)
const pad = (n) => String(n).padStart(2, '0')
const BUILD_TIME = `${pad(t.getUTCDate())}/${pad(t.getUTCMonth() + 1)} à ${pad(t.getUTCHours())}h${pad(t.getUTCMinutes())}`

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { __BUILD_TIME__: JSON.stringify(BUILD_TIME) },
  server: {
    host: true,
    proxy: {
      '/api': 'http://localhost:5000',
      '/uploads': 'http://localhost:5000',
    },
  },
})
