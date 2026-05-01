import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

const rootDir = fileURLToPath(new URL('.', import.meta.url))
const indexHtmlPath = fileURLToPath(new URL('./index.html', import.meta.url))
const playerViewerHtmlPath = fileURLToPath(new URL('./tools/pv.html', import.meta.url))
const playerViewerFpHtmlPath = fileURLToPath(new URL('./tools/pv-fp.html', import.meta.url))

function rewriteToolPath(url: string | undefined): string | undefined {
  if (!url) return url
  if (url === '/tools/pv' || url.startsWith('/tools/pv?')) {
    return url.replace('/tools/pv', '/tools/pv.html')
  }
  if (url === '/tools/pv-fp' || url.startsWith('/tools/pv-fp?')) {
    return url.replace('/tools/pv-fp', '/tools/pv-fp.html')
  }
  return url
}

export default defineConfig({
  root: rootDir,
  plugins: [
    {
      name: 'player-viewer-rewrite',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          req.url = rewriteToolPath(req.url)
          next()
        })
      },
      configurePreviewServer(server) {
        server.middlewares.use((req, _res, next) => {
          req.url = rewriteToolPath(req.url)
          next()
        })
      },
    },
  ],
  build: {
    rollupOptions: {
      input: {
        main: indexHtmlPath,
        playerViewer: playerViewerHtmlPath,
        playerViewerFp: playerViewerFpHtmlPath,
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
  },
})
