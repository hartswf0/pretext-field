import { rename, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Glob } from 'bun'

const root = process.cwd()
const outdir = path.join(root, 'site')

// ── Step 1: Discover HTML entrypoints ────────────────────────────
const glob = new Glob('**/*.html')
const entrypoints: string[] = []
for await (const file of glob.scan(root)) {
  if (file.includes('node_modules') || file.includes('site/') || file.includes('dist/') || file.includes('cave-demos/')) continue
  entrypoints.push(file)
}
console.log(`[site:build] Found ${entrypoints.length} HTML entrypoints`)

// ── Step 2: Run bun build ────────────────────────────────────────
const result = Bun.spawnSync(
  ['bun', 'build', ...entrypoints, '--outdir', 'site'],
  { cwd: root, stdout: 'inherit', stderr: 'inherit' }
)
if (result.exitCode !== 0) {
  console.error('[site:build] ❌ bun build failed with exit code', result.exitCode)
  process.exit(result.exitCode)
}

// ── Step 3: Slug routing for GitHub Pages ────────────────────────
// Moving bat.html → bat/index.html adds one directory level,
// so all relative paths (../../foo.js) need an extra ../ prefix.
const siteGlob = new Glob('**/*.html')
for await (const file of siteGlob.scan(outdir)) {
  if (file.endsWith('index.html')) continue

  const oldPath = path.join(outdir, file)

  // Moving file.html → file/index.html adds one directory level.
  // Prepend ../ to every relative src/href so paths still resolve correctly.
  let html = await readFile(oldPath, 'utf-8')
  html = html.replace(/((?:src|href)=["'])(\.{1,2}\/)/g, (_match, prefix, relPath) => {
    return `${prefix}../${relPath}`
  })
  await writeFile(oldPath, html, 'utf-8')

  const slugDir = oldPath.replace(/\.html$/, '')
  const newPath = path.join(slugDir, 'index.html')

  await mkdir(slugDir, { recursive: true })
  await rename(oldPath, newPath)
}
console.log('[site:build] Static routing adapted for GitHub Pages')

// ── Step 4: Inject boot diagnostics into built HTML ──────────────
const bootScript = `<script>(function(){var p=document.title||location.pathname;console.log("[pretext] booting: "+p);var s=document.querySelector('script[type="module"][src]');if(s){s.onerror=function(e){console.error("[pretext] ❌ module failed to load: "+s.getAttribute("src"),e);var d=document.createElement("div");d.style.cssText="position:fixed;top:0;left:0;right:0;z-index:99999;background:#1a0000;color:#ff4444;font:14px/1.6 monospace;padding:12px 16px;border-bottom:2px solid #ff0000";d.innerHTML="<b>⚠ Script failed to load.</b> The module <code>"+s.getAttribute("src")+"</code> could not be loaded. If you are on GitHub Pages, the site may not have been built correctly.";document.body.prepend(d)}}})();</script>`

let injectedCount = 0
const builtGlob = new Glob('**/*.html')
for await (const file of builtGlob.scan(outdir)) {
  const filePath = path.join(outdir, file)
  const html = await readFile(filePath, 'utf-8')

  // Only inject into pages that have a module script
  if (!html.includes('type="module"')) continue

  // Inject the boot diagnostic right before </head>
  const injected = html.replace('</head>', bootScript + '</head>')
  if (injected !== html) {
    await writeFile(filePath, injected, 'utf-8')
    injectedCount++
  }
}
console.log(`[site:build] Injected boot diagnostics into ${injectedCount} pages`)

// ── Step 5: Post-build verification ──────────────────────────────
let staleCount = 0
const verifyGlob = new Glob('**/*.html')
for await (const file of verifyGlob.scan(outdir)) {
  const filePath = path.join(outdir, file)
  const html = await readFile(filePath, 'utf-8')

  // Check for stale .ts script references (not modulepreload, which are less critical)
  const staleMatches = html.match(/src=["'][^"']*\.ts["']/g)
  if (staleMatches) {
    console.warn(`[site:build] ⚠️  ${file}: stale .ts script ref → ${staleMatches.join(', ')}`)
    staleCount++
  }
}

// Count JS assets
const jsGlob = new Glob('*.js')
let jsCount = 0
for await (const _file of jsGlob.scan(outdir)) jsCount++

console.log(`[site:build] ✅ Build complete`)
console.log(`[site:build]    ${entrypoints.length} HTML entrypoints`)
console.log(`[site:build]    ${jsCount} JS bundles in site root`)
console.log(`[site:build]    ${injectedCount} pages with boot diagnostics`)
if (staleCount > 0) {
  console.warn(`[site:build]    ⚠️  ${staleCount} pages with stale .ts refs`)
} else {
  console.log(`[site:build]    ✅ No stale .ts script references`)
}
