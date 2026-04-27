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
    chunkSizeWarningLimit: 1000,
    // Manual chunking: keep @react-pdf in its own chunk (already dynamic-imported
    // so the main bundle never blocks on it), and split the heavyweight Supabase
    // and Gemini SDKs into their own files so a tiny edit to App.jsx doesn't
    // invalidate the cached vendor bundles.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@react-pdf'))               return 'react-pdf';
          if (id.includes('@supabase/supabase-js'))    return 'supabase';
          if (id.includes('@google/generative-ai'))    return 'gemini';
          return undefined;
        },
      },
    },
  }
})
