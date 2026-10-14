import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl = env.VITE_API_URL ? env.VITE_API_URL.replace(/\/api\/?$/, '') : 'http://localhost:3001'

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        // Chuyển tiếp /api/* sang Backend Express (:3001)
        '/api': {
          target: backendUrl,
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
  }
})

