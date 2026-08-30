/**
 * What Railway runs. `serve` cannot send www to the apex, and it answers a trailing
 * slash with the same file at a second address.
 *
 * Without `-s`, `serve` already maps `/welcome` to `welcome.html` and `/privacy` to
 * `privacy.html`. This file keeps that, then adds the two redirects the live site
 * was missing: `www.gitquiet.com` to `https://gitquiet.com`, and a trailing slash
 * (except `/`) to the same path without it.
 */
import { stat } from "node:fs/promises"
import { extname, join, resolve, sep } from "node:path"

const ROOT = join(import.meta.dir, "dist")
const APEX = "https://gitquiet.com"
const PORT = Number(process.env.PORT ?? 3000)

const MIME: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".woff2": "font/woff2"
}

const inside = (held: string): string | undefined => {
  const next = resolve(held)
  const root = resolve(ROOT)
  if (next === root) return next
  const prefix = root.endsWith(sep) ? root : root + sep
  return next.startsWith(prefix) ? next : undefined
}

const fileAt = async (held: string): Promise<Response | undefined> => {
  const path = inside(held)
  if (path === undefined) return
  try {
    const info = await stat(path)
    if (!info.isFile()) return
    const type = MIME[extname(path)] ?? "application/octet-stream"
    return new Response(Bun.file(path), { headers: { "Content-Type": type } })
  } catch {
    return
  }
}

const pageAt = async (pathname: string): Promise<Response | undefined> => {
  const decoded = decodeURIComponent(pathname)
  if (decoded.includes("\0") || decoded.includes("..")) return

  const exact = await fileAt(join(ROOT, decoded))
  if (exact !== undefined) return exact

  if (decoded === "/" || decoded === "") return fileAt(join(ROOT, "index.html"))

  const asHtml = await fileAt(join(ROOT, `${decoded}.html`))
  if (asHtml !== undefined) return asHtml

  return fileAt(join(ROOT, decoded, "index.html"))
}

const hostOf = (request: Request): string =>
  (request.headers.get("host") ?? "").split(":")[0]?.toLowerCase() ?? ""

Bun.serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url)
    const host = hostOf(request)
    const slash = url.pathname.length > 1 && url.pathname.endsWith("/")
    const path = slash ? url.pathname.slice(0, -1) : url.pathname

    if (host === "www.gitquiet.com") {
      return Response.redirect(`${APEX}${path}${url.search}`, 301)
    }

    if (slash) {
      return Response.redirect(`${path}${url.search}`, 301)
    }

    const page = await pageAt(url.pathname)
    if (page !== undefined) return page
    return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } })
  }
})

console.log(`gitquiet site on ${PORT}`)
