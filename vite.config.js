import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Khi dev: Vite chạy ở cổng 5173 và proxy mọi request /api sang backend (cổng 8000).
// Khi build: tạo ra dist/ để backend phục vụ trên cùng một cổng.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
    },
    // Backend ghi file JSON trong data/ khi chạy. Không để Vite reload trang mỗi lần ghi.
    watch: {
      ignored: ['**/data/**'],
    },
  },
  build: {
    outDir: 'dist',
  },
})
