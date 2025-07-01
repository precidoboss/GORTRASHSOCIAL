import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Ensure PostCSS is configured. Vite usually picks up postcss.config.js automatically,
  // but explicitly defining it here can sometimes help if there are issues.
  css: {
    postcss: './postcss.config.js',
  },
  // If index.html is in the root, no 'root' property is needed here,
  // or it can be explicitly set to '.' (current directory).
  // If you had it set to 'public', remove that.
  // root: '.', // This is the default, no need to explicitly set unless you moved it elsewhere
})
