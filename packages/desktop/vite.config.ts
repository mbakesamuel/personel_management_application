// Shim so the shadcn CLI can detect Vite; the real build config lives in
// electron.vite.config.ts (renderer section mirrors these settings).
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const root = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: [
      {
        find: '@/',
        replacement: `${resolve(root, 'src/renderer/src')}/`,
      },
      {
        find: '@renderer/',
        replacement: `${resolve(root, 'src/renderer/src')}/`,
      },
    ],
  },
  plugins: [react(), tailwindcss()],
})
