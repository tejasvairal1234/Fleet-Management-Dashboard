import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    hmr: {
      // Auto-adapt HMR WebSocket to whichever port the dev server is served on (5173, 5174, etc.)
      protocol: 'ws',
    },
    proxy: {
      // Proxy REST API calls to backend in dev
      '/robots': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
      '/ingest': 'http://localhost:3000',
      '/config': 'http://localhost:3000',
    },
  },
})
