import { defineConfig, createLogger } from 'vite'
import react from '@vitejs/plugin-react'

// Custom logger that silences proxy/connection errors when backend is offline
const logger = createLogger()
const originalError = logger.error.bind(logger)
const originalWarn = logger.warn.bind(logger)

logger.error = (msg, options) => {
  if (msg.includes('ECONNREFUSED') || msg.includes('proxy error') || msg.includes('ws proxy')) return
  originalError(msg, options)
}
logger.warn = (msg, options) => {
  if (msg.includes('ECONNREFUSED') || msg.includes('proxy error') || msg.includes('ws proxy')) return
  originalWarn(msg, options)
}

export default defineConfig({
  customLogger: logger,
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', () => {}) // swallow http-proxy errors
        },
      },
      '/ws': {
        target: 'http://localhost:8080',
        ws: true,
        configure: (proxy) => {
          proxy.on('error', () => {}) // swallow ws errors
        },
      },
    },
  },
})
