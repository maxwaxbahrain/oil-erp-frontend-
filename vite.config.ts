import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const apiTarget = env.VITE_API_URL || 'http://localhost:8000'
  const buildVersion = process.env.RENDER_GIT_COMMIT || 'dev'

  return {
    appType: 'spa',
    define: {
      __APP_BUILD_VERSION__: JSON.stringify(buildVersion),
    },
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: {
      port: 5174,
      host: true,
      allowedHosts: true,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: true,
        },
      },
    },
    preview: {
      port: 5174,
      host: true,
      allowedHosts: true,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: true,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: undefined,
        },
      },
    },
  }
})
