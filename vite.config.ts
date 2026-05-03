import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: "/",
  plugins: [react()],
  server: {
    watch: {
      usePolling: true,
      interval: 1000
    },
    hmr: {
      overlay: true
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/react')) return 'vendors'
          if (id.includes('node_modules/react-dom')) return 'vendors'
          if (id.includes('node_modules/react-router')) return 'vendors'
          if (id.includes('/src/db/')) return 'db'
          if (id.includes('Heatmap')) return 'charts'
        }
      }
    },
    sourcemap: true
  }
})
