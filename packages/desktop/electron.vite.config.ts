import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const root = dirname(fileURLToPath(import.meta.url))
const sharedSrc = resolve(root, '../shared/src/index.ts')

export default defineConfig({
  main: {
    envPrefix: ['VITE_', 'MAIN_VITE_', 'SERVER_', 'AUTH_'],
    resolve: {
      alias: {
        '@perf-appraisal-app/shared': sharedSrc,
      },
    },
    plugins: [
      externalizeDepsPlugin({
        exclude: ['@perf-appraisal-app/shared'],
      }),
    ],
  },
  preload: {
    resolve: {
      alias: {
        '@perf-appraisal-app/shared': sharedSrc,
      },
    },
    plugins: [
      externalizeDepsPlugin({
        exclude: ['@perf-appraisal-app/shared'],
      }),
    ],
  },
  renderer: {
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
        {
          find: '@perf-appraisal-app/shared',
          replacement: sharedSrc,
        },
      ],
    },
    plugins: [react(), tailwindcss()],
  },
})
