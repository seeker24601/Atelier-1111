import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const API = 'http://127.0.0.1:8788'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    strictPort: true,
    // Rust's build output churns (and locks files) during a desktop build; watching
    // it crashes the dev server on Windows.
    watch: { ignored: ['**/src-tauri/target/**'] },
    proxy: {
      '/api': { target: API, changeOrigin: true },
      '/files': { target: API, changeOrigin: true },
    },
  },
})
