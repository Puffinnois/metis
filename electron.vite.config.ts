import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const shared = { '@shared': resolve('src/shared') }

export default defineConfig({
  main: {
    resolve: { alias: { ...shared, '@main': resolve('src/main') } },
    build: {
      rollupOptions: {
        external: ['node:sqlite'],
        // The stats database runs in a worker thread, bundled beside the main entry.
        input: {
          index: resolve('src/main/index.ts'),
          statsWorker: resolve('src/main/stats/worker.ts')
        }
      }
    }
  },
  preload: {
    resolve: { alias: shared }
  },
  renderer: {
    resolve: { alias: { ...shared, '@': resolve('src/renderer/src') } },
    plugins: [react(), tailwindcss()]
  }
})
