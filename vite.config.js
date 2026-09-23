import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset URLs so the build works under GitHub Pages' /<repo-name>/ subpath
  base: './',
  // In dev, forward /api/* requests to the Express server so the
  // frontend can call fetch('/api/words') without CORS setup.
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
