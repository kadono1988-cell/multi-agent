import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Workaround for Windows Japanese path issues (chokidar / rollup encoding)
  server: {
    fs: { strict: false }
  },
  build: {
    // Avoid rollup issues with non-ASCII paths by writing to a local-safe cache dir
    chunkSizeWarningLimit: 1000
  }
})
