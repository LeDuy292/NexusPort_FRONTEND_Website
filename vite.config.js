import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // TypeScript Node Core (:4000) — KHÔNG trỏ sang JS backend (:3001).
      // Các route của node-core được mount tại /api/v1, nên phải giữ prefix /v1
      // để containerService và các service dùng nodeApiClient không bị lỗi 404.
      '/node-api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/node-api/, '/api/v1'),
      },
      // Chuyển tiếp mọi request /api/* sang backend Express :3001
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})

