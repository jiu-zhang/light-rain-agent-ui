import { resolve } from 'path'
import { readFileSync } from 'fs'
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import { DEFAULT_BACKEND_PORT } from './src/shared/constants'

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version)
    },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [vue()],
    build: {
      rollupOptions: {
        output: {
          // 稳定第三方依赖单独分包，主 chunk 只留应用代码，利于 CDN/缓存与首屏加载
          manualChunks: {
            vendor: ['axios', 'pinia', 'vue-router', 'marked', 'dompurify', 'highlight.js']
          }
        }
      }
    },
    server: {
      proxy: {
        '/api': {
          target: `http://localhost:${DEFAULT_BACKEND_PORT}`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '')
        }
      }
    }
  }
})
