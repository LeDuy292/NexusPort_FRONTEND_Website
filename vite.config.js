import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // TypeScript Node Core (:4000)
      '/node-api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/node-api/, '/api/v1'),
      },
      // Chuyển tiếp mọi request /api/* sang Node Core :4000
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})

