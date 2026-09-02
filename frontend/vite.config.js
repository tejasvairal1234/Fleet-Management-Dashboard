import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy REST API calls to backend in dev
      '/robots': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
      '/ingest': 'http://localhost:3000',
      '/config': 'http://localhost:3000',
    },
  },
})
