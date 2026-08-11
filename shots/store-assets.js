/**
 * Exports the store's own images from the page that draws them.
 *
 *     bun run assets
 *
 * which needs the site's dev server up. It photographs `site/assets.html`, one frame
 * at a time, clipping to each frame's own box, and writes:
 *
 *     site/public/store/icon-128.png       128 by 128, transparent
 *     site/public/store/promo-tile.png     440 by 280
 *     site/public/store/marquee.png        1400 by 560
 *     site/public/store/<view>.png         1280 by 800, product on the bed
 *     site/public/og.png                   1200 by 630, for the site itself
 *
 * Needs `site/public/shots/*@2x.png` already on disk (`bun run shots`). The banners
 * and framed screenshots read those files; they do not photograph the stage.
 *
 * At one device pixel per CSS pixel, unlike `shots/capture.js`. These are not
 * pictures of a screen that could be shown larger later; they are the deliverables,
 * at the only sizes Google accepts, and a 2x export would have to be reduced to fit
 * them. The shader renders internally at double density anyway — `minPixelRatio`
 * defaults to 2 — so the gradient is smooth without the frame being oversized.
 */

import { mkdirSync, writeFileSync } from "node:fs"

const SITE = "http://localhost:5173/assets.html"
const REPO = "/Users/alex/Documents/githubpro"
const STORE = `${REPO}/site/public/store`

/** Which frame is the site's rather than the store's, and where it goes instead. */
const ELSEWHERE = { "social-card": `${REPO}/site/public/og.png` }

const task = await useOrCreateTaskSpace("gitquiet store assets")

mkdirSync(STORE, { recursive: true })

await openOrReuseTab(SITE, { wait: true, timeout: 30 })
await gotoAndWait(SITE, { timeout: 30, settle: 2 })

/*
 * A viewport wide enough for the widest frame.
 *
 * The marquee is 1400 across. In a narrower window the frame is still 1400 wide in
 * layout, but the part past the edge is never painted, so `Page.captureScreenshot`
 * returns the right size with the right-hand third blank. Setting the metrics is
 * cheaper than reasoning about which frames fit.
 */
await cdp("Emulation.setDeviceMetricsOverride", {
  width: 1600,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false
})
await wait(1)

const frames = await js(String.raw`(() => {
  const found = [...document.querySelectorAll('[data-asset]')]
  return found.map((frame) => {
    const box = frame.getBoundingClientRect()
    return {
      name: frame.dataset.asset,
      width: Math.round(box.width),
      height: Math.round(box.height)
    }
  })
})()`)

if (frames.length === 0) {
  cliLog(`no frames at ${SITE} — start the site with \`bun run dev\` in site/`)
  throw new Error("no frames")
}

/**
 * The shader's canvas, and whether it has drawn.
 *
 * Every frame but one carries a WebGL canvas, and a capture taken before the first
 * draw is a picture of a transparent rectangle. `document.fonts.status` covers the
 * wordmark in the same wait, which is the other thing that arrives late.
 */
const drawn = () =>
  js(String.raw`(() => {
    if (document.fonts.status !== 'loaded') return { ready: false, why: 'fonts' }
    const canvases = [...document.querySelectorAll('canvas')]
    const blank = canvases.filter((canvas) => canvas.width === 0 || canvas.height === 0)
    if (blank.length > 0) return { ready: false, why: blank.length + ' canvas(es) unsized' }
    const images = [...document.images]
    const pending = images.filter((image) => !image.complete)
    if (pending.length > 0) return { ready: false, why: pending.length + ' image(s) loading' }
    const broken = images.filter((image) => image.complete && image.naturalWidth === 0)
    if (broken.length > 0) return { ready: false, why: broken.length + ' image(s) broken' }
    return { ready: true, why: 'drawn', canvases: canvases.length, images: images.length }
  })()`)

const deadline = Date.now() + 15_000
let seen = await drawn()
while (!seen.ready && Date.now() < deadline) {
  await wait(0.4)
  seen = await drawn()
}
if (!seen.ready) cliLog(`! the sheet was still ${seen.why}`)
await wait(1)

/**
 * The icon has to come out on nothing.
 *
 * A dark square baked into the file would be a dark square on a reader's light
 * toolbar, and Chrome's guidance is explicit that the image works on both. Turning
 * off the protocol's default background is not enough on its own, because the page
 * paints its own: both have to go, and only while this one frame is being taken.
 */
const withoutABackground = async (transparent) => {
  if (transparent) {
    await cdp("Emulation.setDefaultBackgroundColorOverride", {
      color: { r: 0, g: 0, b: 0, a: 0 }
    })
  } else {
    await cdp("Emulation.setDefaultBackgroundColorOverride", {})
  }

  await js(
    `(() => {
      const shown = ${transparent ? "true" : "false"}
      document.documentElement.style.background = shown ? 'transparent' : ''
      document.body.style.background = shown ? 'transparent' : ''
      for (const held of document.querySelectorAll('#sheet > div')) {
        held.style.background = shown ? 'transparent' : ''
      }
      return true
    })()`
  )
}

for (const frame of frames) {
  const transparent = frame.name === "icon-128"
  if (transparent) await withoutABackground(true)

  // Read again rather than reused: turning the page's background off changes no
  // geometry, but scrolling the frame into view does, and the clip is in page
  // coordinates.
  const box = await js(
    `(() => {
      const frame = document.querySelector('[data-asset="${frame.name}"]')
      frame.scrollIntoView({ block: 'center' })
      const at = frame.getBoundingClientRect()
      return { x: at.x + window.scrollX, y: at.y + window.scrollY, width: at.width, height: at.height }
    })()`
  )
  await wait(0.3)

  const shot = await cdp("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    clip: {
      x: Math.round(box.x),
      y: Math.round(box.y),
      width: Math.round(box.width),
      height: Math.round(box.height),
      scale: 1
    }
  })

  if (transparent) await withoutABackground(false)

  const at = ELSEWHERE[frame.name] ?? `${STORE}/${frame.name}.png`
  writeFileSync(at, Buffer.from(shot.data, "base64"))
  cliLog(`  ${frame.name}  ${frame.width}x${frame.height}`)
}

await cdp("Emulation.clearDeviceMetricsOverride")
cliLog(`\n${frames.length} asset(s) exported`)
await completeTaskSpace(task.id, { keep: false })
