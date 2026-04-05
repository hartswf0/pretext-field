import { rm } from 'node:fs/promises'
import { Glob } from 'bun'

const root = process.cwd()
const outdir = Bun.fileURLToPath(new URL('./site', import.meta.url))

// Find all HTML files
const glob = new Glob('**/*.html')
const entrypoints = []
for await (const file of glob.scan(root)) {
  if (file.includes('node_modules') || file.includes('site/') || file.includes('dist/')) continue
  entrypoints.push(file)
}

console.log('Building ' + entrypoints.length + ' HTML files...')

const result = Bun.spawnSync(
  ['bun', 'build', ...entrypoints, '--outdir', 'site'],
  {
    cwd: root,
    stdout: 'inherit',
    stderr: 'inherit',
  },
)

if (result.exitCode !== 0) {
  process.exit(result.exitCode)
}
