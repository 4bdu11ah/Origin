import { defineConfig } from 'electron-vite'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    build: {
      outDir: 'dist/main',
      rollupOptions: {
        external: ['node-pty'],
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
          'pty-host': resolve(__dirname, 'src/main/pty-host.ts')
        }
      }
    }
  },
  preload: {
    build: {
      outDir: 'dist/preload'
    }
  },
  renderer: {
    root: 'src/renderer',
    build: {
      outDir: 'dist/renderer'
    },
    plugins: [react()]
  }
})
