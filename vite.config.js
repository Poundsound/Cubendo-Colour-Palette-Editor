import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// For GitHub Pages, set base to the repository name so assets resolve under the subpath.
// In dev, use '/' so Vite dev server works normally.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'production' ? '/Cubendo-Colour-Palette-Editor/' : '/',
}))
