import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

const normalizeBasePath = (basePath?: string) => {
  const normalizedBasePath = basePath?.trim()

  if (!normalizedBasePath || normalizedBasePath === '/' || normalizedBasePath === './') {
    return normalizedBasePath || '/'
  }

  return `/${normalizedBasePath.replace(/^\/+|\/+$/g, '')}/`
}

// https://vite.dev/config/
export default defineConfig({
  base: normalizeBasePath(process.env.VITE_BASE_PATH),
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
