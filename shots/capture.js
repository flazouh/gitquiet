/**
 * Photographs every view on the stage.
 *
 *     bun run shots
 *
 * which starts the stage first and then runs this. The stage has to be up: this
 * drives a browser and does not build anything.
 *
 * Two pictures used to come from one render: a @2x for the landing page and a
 * 1x into `site/public/store/` for the listing. The listing shots are framed on
 * the bed now by `bun run assets`, which reads the @2x files, so this script only
 * writes:
 *
 *   site/public/shots/<name>@2x.png    2560 by 1600, for the landing page and assets
 *
 * Run `bun run assets` after this when the store PNGs need refreshing.
 *
 * Run through ego rather than Chrome for Testing, which is what `scripts/chrome.ts`
 * drives for `verify:live`. That file has to load an unpacked extension into a
 * throwaway profile; this one only needs a viewport and a clip, and ego is the
 * browser this repository's other tooling already talks to.
 */

import { mkdirSync, writeFileSync } from "node:fs"

const STAGE = "http://localhost:5199"
/*
 * The checkout this was run from, substituted by the `bun run` script.
 *
 * It was hard-coded to the main checkout, so a run inside a git worktree
 * photographed the worktree's screens and wrote them over the main tree's
 * assets. The worktree's own `site/public` stayed untouched and the run still
 * reported success, which is a quiet way to lose an afternoon.
 *
 * ego's runtime cannot work the path out for itself: it reads this from stdin
 * with a cwd of `/` and forwards none of `PWD`, `INIT_CWD` or `OLDPWD`. So the
 * package script seds it in, and a direct `ego-browser nodejs < shots/...`
 * fails loudly on the placeholder rather than writing somewhere unexpected.
 */
const REPO = "__REPO__"
if (REPO.startsWith("__")) {
  throw new Error("run this through `bun run shots` / `bun run assets`, which fills in the checkout path")
}
const RETINA = `${REPO}/site/public/shots`

/**
 * How long a view is given to finish drawing itself.
 *
 * Generous, because one of them is not waiting on a read at all: the pull request
 * view fetches the diff engine, which is four and a half megabytes of Shiki, and a
 * capture taken before it lands is a photograph of an empty file pane.
 */
const SETTLE_SECONDS = 20

const task = await useOrCreateTaskSpace("gitquiet store screenshots")

mkdirSync(RETINA, { recursive: true })

/*
 * Opened and then navigated, rather than only opened.
 *
 * `openOrReuseTab` reuses a tab that is already on this address without reloading
 * it, which is normally the point of it. Here it meant the list was read off
 * whatever bundle the last run left in that tab, so a view added since then was
 * invisible and the loop quietly photographed the wrong set.
 */
await openOrReuseTab(STAGE, { wait: true, timeout: 30 })
await gotoAndWait(`${STAGE}/`, { timeout: 30, settle: 2 })

const views = await js(String.raw`window.__views ?? null`)
if (views === null) {
  cliLog(`the stage did not answer at ${STAGE} — start it with \`bun run shots:dev\``)
  throw new Error("no stage")
}
cliLog(`${views.length} view(s) to photograph`)

/**
 * Everything that makes a capture early rather than wrong.
 *
 * Faces come from github.com and the diff engine comes from `/diff-engine.js`, so a
 * view can be fully mounted and still be a picture of grey boxes. `complete` on
 * every image covers a face that failed as well as one that arrived, which is right:
 * a face GitHub will not serve is never going to arrive, and waiting the full twenty
 * seconds for it would make every capture slow to protect one that cannot be fixed.
 */
const drawn = (want) =>
  js(String.raw`((want) => {
    const stage = document.querySelector('[data-view]')
    if (stage === null || stage.childElementCount === 0) return { ready: false, why: 'not mounted' }
    if (document.fonts.status !== 'loaded') return { ready: false, why: 'fonts' }

    const images = [...document.images]
    const pending = images.filter((image) => !image.complete).length
    if (pending > 0) return { ready: false, why: pending + ' image(s)' }

    const text = (stage.innerText ?? '').trim()
    if (text.length < 20) return { ready: false, why: 'almost no text' }

    /*
     * The view's own word for "the thing worth photographing is here", looked for
     * through shadow roots as well as in the light DOM. See View.ready.
     *
     * Piercing rather than a plain querySelector, because the one thing this gate
     * exists for is behind a boundary: the diff engine draws into a shadow root of
     * its own, so a code cell is never a descendant of anything the document itself
     * can reach. Written as a plain search, the gate reported every diff view as
     * still waiting while the screens were in fact fine.
     *
     * No backticks in here. This whole function is a template literal in the file
     * you are reading, and one of those ends it early.
     */
    const somewhere = (within, selector) => {
      if (within.querySelector(selector) !== null) return true
      for (const node of within.querySelectorAll('*')) {
        if (node.shadowRoot && somewhere(node.shadowRoot, selector)) return true
      }
      return false
    }

    if (want && !somewhere(stage, want)) return { ready: false, why: 'waiting for ' + want }

    return { ready: true, why: 'drawn', characters: text.length }
  })(` + JSON.stringify(want ?? null) + `)`)

const settled = async (want) => {
  const deadline = Date.now() + SETTLE_SECONDS * 1000
  let seen = await drawn(want)
  while (!seen.ready && Date.now() < deadline) {
    await wait(0.4)
    seen = await drawn(want)
  }
  return seen
}

/**
 * Two animation frames, asked for and then waited for.
 *
 * A flag on the window rather than a promise handed back, because `js` reads the value
 * an expression evaluates to and does not wait on a promise: returning one timed out
 * every time. So the frames are asked for in one call and the answer is read in the
 * next, which is the same handshake and survives the boundary.
 */
const painted = async () => {
  await js(String.raw`(() => {
    window.__painted = false
    requestAnimationFrame(() => requestAnimationFrame(() => { window.__painted = true }))
    return true
  })()`)

  for (let tries = 0; tries < 25; tries += 1) {
    if (await js(String.raw`window.__painted === true`)) return true
    await wait(0.1)
  }
  return false
}

/**
 * Every image told to load now rather than when it is scrolled to.
 *
 * `Standing` marks the contributor faces `loading="lazy"`, which is right on a page a
 * reader scrolls and wrong for a photograph. Inside the repository home's header the
 * row is clipped, Chrome never decides the eight faces are near enough to fetch, and
 * the capture waited out its full deadline and then took a picture of eight grey
 * circles. Asked eagerly they arrive in well under a second.
 *
 * Said before the gate rather than after, so the wait on `image.complete` is a wait on
 * a request that has actually been made.
 */
const eagerly = () =>
  js(String.raw`(() => {
    let asked = 0
    for (const image of document.images) {
      if (image.loading !== 'lazy') continue
      image.loading = 'eager'
      // Reassigned, because changing the attribute on an element the browser has
      // already decided not to fetch does not on its own start the fetch.
      image.src = image.src
      asked += 1
    }
    return asked
  })()`)

const shoot = async (view, density, into, suffix) => {
  await cdp("Emulation.setDeviceMetricsOverride", {
    width: view.width,
    height: view.height,
    deviceScaleFactor: density,
    mobile: false
  })
  await gotoAndWait(`${STAGE}/?view=${view.name}`, { timeout: 30, settle: 1 })
  await eagerly()

  const seen = await settled(view.ready)
  if (!seen.ready) cliLog(`  ! ${view.name} at ${density}x was still ${seen.why}`)

  /*
   * A settled screen and a painted one are not the same frame.
   *
   * Everything above waits on state, and state was never the problem: the diff pane
   * was captured blank three times while the element behind it measured 590 by 1286
   * with its text in place and its computed opacity at 1. What had not happened was
   * the raster. The pane is a scroll container taller than the viewport, and Chrome
   * is entitled to leave a layer it has not been asked to show unpainted.
   *
   * So the browser is asked. Two frames, because the first is the one that schedules
   * the work and the second is the one that has it, and then a beat on top for the
   * tiles. `fromSurface` takes the picture off the compositor's own surface rather
   * than from the renderer, which is the difference between photographing what is on
   * the screen and photographing what the renderer thinks is.
   */
  await painted()
  await wait(1.2)

  const shot = await cdp("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
    clip: { x: 0, y: 0, width: view.width, height: view.height, scale: 1 }
  })

  const at = `${into}/${view.name}${suffix}.png`
  writeFileSync(at, Buffer.from(shot.data, "base64"))
  return at
}

for (const view of views) {
  await shoot(view, 2, RETINA, "@2x")
  cliLog(`  ${view.name}  ${view.width}x${view.height}`)
}

/*
 * The manifest, written beside the pictures.
 *
 * The landing page needs a caption under each screenshot, and a caption typed out
 * again in the site's own source is one that goes stale the first time a view is
 * renamed or reworded. `views.tsx` is where a view says what it is, so the page reads
 * the list this loop was driven by and nothing has to be kept in step by hand. A view
 * added to the registry appears on the page having been photographed, both from one
 * array.
 */
writeFileSync(
  `${REPO}/site/src/shots.ts`,
  [
    "/* Written by shots/capture.js. Do not edit: a view's name and caption belong to",
    "   shots/views.tsx, and this file is regenerated every time the pictures are. */",
    "",
    "export type Shot = {",
    "  readonly name: string",
    "  readonly caption: string",
    "  readonly width: number",
    "  readonly height: number",
    "}",
    "",
    `export const SHOTS: ReadonlyArray<Shot> = ${JSON.stringify(
      views.map(({ name, caption, width, height }) => ({ name, caption, width, height })),
      null,
      2
    )}`,
    ""
  ].join("\n")
)

await cdp("Emulation.clearDeviceMetricsOverride")
cliLog(`\n${views.length} view(s) photographed into site/public`)
await completeTaskSpace(task.id, { keep: false })
