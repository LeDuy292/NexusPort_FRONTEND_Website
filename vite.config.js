import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // C# owns Booking/Gate/Identity; match before the broader Express prefix.
      '/api/v1': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      // Chuyển tiếp /api/* sang Backend Express (:3001)
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // TypeScript Node Core (:4000) nếu có
      '/node-api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/node-api/, '/api/v1'),
      },
    },
  },
})
