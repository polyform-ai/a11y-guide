import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const outdir = new URL('../extension/dist/', import.meta.url)
await rm(outdir, { recursive: true, force: true })
await mkdir(outdir, { recursive: true })

await build({
  entryPoints: {
    devtools: fileURLToPath(new URL('../extension/src/devtools.ts', import.meta.url)),
    panel: fileURLToPath(new URL('../extension/src/panel.ts', import.meta.url)),
    'page-scan': fileURLToPath(new URL('../extension/src/page-scan.ts', import.meta.url)),
  },
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'chrome120',
  outdir: fileURLToPath(outdir),
  minify: true,
  sourcemap: false,
})

await Promise.all(['manifest.json', 'devtools.html', 'panel.html', 'panel.css'].map((file) => {
  return cp(new URL(`../extension/static/${file}`, import.meta.url), new URL(file, outdir))
}))

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const manifestUrl = new URL('manifest.json', outdir)
const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'))
manifest.version = packageJson.version
await writeFile(manifestUrl, `${JSON.stringify(manifest, null, 2)}\n`)
