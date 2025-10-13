import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// For GitHub Pages hosted at https://<user>.github.io/<repo>/ we need a base path.
// We default to './' which works for both root and subfolder deployments with relative assets.
export default defineConfig(() => ({
  plugins: [react()],
  base: './',
}))
