import { defineConfig } from 'vite'
import { resolve } from 'path'
import { readdirSync } from 'fs'

// Automatically discover all HTML files in demos/
const demoEntries: Record<string, string> = {}
for (const file of readdirSync(resolve(__dirname, 'demos'))) {
  if (file.endsWith('.html')) {
    const name = file.replace('.html', '')
    demoEntries[`demos/${name}`] = resolve(__dirname, 'demos', file)
  }
}

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        ...demoEntries,
      },
    },
  },
})
