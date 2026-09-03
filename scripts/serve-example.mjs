import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const types = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
])

createServer(async (request, response) => {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
  const relative = pathname === '/' ? 'examples/ecommerce.html' : pathname.slice(1)
  const file = resolve(root, relative)
  if (file !== root && !file.startsWith(`${root}${sep}`)) {
    response.writeHead(403).end('Forbidden')
    return
  }
  try {
    response.writeHead(200, { 'content-type': types.get(extname(file)) ?? 'application/octet-stream' })
    response.end(await readFile(file))
  } catch {
    response.writeHead(404).end('Not found')
  }
}).listen(4173, '127.0.0.1', () => {
  console.log('Commerce agent-view example: http://127.0.0.1:4173/')
})
