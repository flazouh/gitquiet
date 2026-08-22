import { mkdirSync, writeFileSync } from "node:fs"
import { connect, findChrome } from "./chrome"

/**
 * Photographs the stage's views with a headless Chrome, for looking at rather
 * than for the store.
 *
 *     bun run qa                     every view, into .output/qa
 *     bun run qa --view working-set  one view
 *     bun run qa --view a,b          a handful
 *
 * `shots/capture.js` does this job for the store images and does it through ego,
 * which is a browser this machine may not have. This one drives whatever
 * `findChrome` finds — CHROME_PATH included — so the same pictures come out of a
 * container that has nothing installed but a Chromium. That is the whole point:
 * a change made anywhere can be looked at here, without github.com and without
 * a display.
 *
 * The stage is started if it is not already up, and left as it was found: a
 * stage this script started is stopped on the way out, one that was already
 * running is left running.
 *
 * The pictures are taken at 1x rather than the store's 2x, because these are
 * for a reviewer's eyes and a diff of them, not for a listing. Faces load from
 * github.com and will be grey circles wherever that host is unreachable; the
 * capture does not wait on them, for the reason `capture.js` gives.
 */

const argumentAfter = (flag: string): string | undefined => {
  const at = Bun.argv.indexOf(flag)
  return at === -1 ? undefined : Bun.argv[at + 1]
}

const STAGE = "http://localhost:5199"
const OUT = argumentAfter("--out") ?? ".output/qa"
const ONLY = argumentAfter("--view")?.split(",")
const PORT = 9333
const SETTLE_SECONDS = 20

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// `.catch` rather than `try`, as `chrome.ts` puts it: the lint rule reserves those for Effect.
const stageAnswers = (): Promise<boolean> =>
  fetch(STAGE, { signal: AbortSignal.timeout(1000) })
    .then((answer) => answer.ok)
    .catch(() => false)

const startStageIfDown = async (): Promise<(() => void) | null> => {
  if (await stageAnswers()) return null
  const vite = Bun.spawn(["bunx", "vite", "--config", "shots/vite.config.ts"], {
    stdout: "ignore",
    stderr: "ignore"
  })
  for (let attempt = 0; attempt < 120; attempt++) {
    if (await stageAnswers()) return () => vite.kill()
    await sleep(250)
  }
  vite.kill()
  throw new Error(`the stage never answered at ${STAGE}`)
}

const stopStage = await startStageIfDown()

const chrome = Bun.spawn(
  [
    findChrome(),
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=/tmp/gitquiet-qa-profile`,
    // The new headless, which is a real Chrome without a window rather than the
    // separate renderer the old flag named. A container has no display to give.
    "--headless=new",
    // The sandbox cannot set itself up under root, which is what a container
    // usually runs this as, and there is nothing here to sandbox against: the
    // only pages visited are this repository's own stage.
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--window-size=1440,900",
    "about:blank"
  ],
  { stdout: "ignore", stderr: "ignore" }
)

const version = async (): Promise<{ webSocketDebuggerUrl: string }> => {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      return (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()) as {
        webSocketDebuggerUrl: string
      }
    } catch {
      await sleep(250)
    }
  }
  throw new Error("Chrome never opened its debugging port")
}

const browser = await connect((await version()).webSocketDebuggerUrl)
const created = await browser.send<{ targetId: string }>("Target.createTarget", {
  url: "about:blank"
})
const target = (
  (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()) as ReadonlyArray<{
    id: string
    webSocketDebuggerUrl: string
  }>
).find((entry) => entry.id === created.targetId)
if (target === undefined) throw new Error("The page target vanished")

const tab = await connect(target.webSocketDebuggerUrl)
await tab.send("Page.enable")
await tab.send("Runtime.enable")

const js = async <A,>(expression: string): Promise<A> => {
  const answer = await tab.send<{ result: { value: A } }>("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true
  })
  return answer.result.value
}

const goto = async (url: string): Promise<void> => {
  const loaded = tab.once("Page.loadEventFired")
  await tab.send("Page.navigate", { url })
  await loaded
  await sleep(500)
}

type Staged = {
  readonly name: string
  readonly width: number
  readonly height: number
  readonly ready?: string
}

await goto(`${STAGE}/`)
const views = await js<ReadonlyArray<Staged> | null>("window.__views ?? null")
if (views === null) throw new Error(`the stage at ${STAGE} did not say what its views are`)

const wanted = ONLY === undefined ? views : views.filter((view) => ONLY.includes(view.name))
if (wanted.length === 0) {
  throw new Error(`no view named ${ONLY?.join(", ")} — there are: ${views.map((v) => v.name).join(", ")}`)
}

/** The stage's own drawn-gate, word for word from `shots/capture.js`. */
const drawn = (want: string | null) =>
  js<{ ready: boolean; why: string }>(
    String.raw`((want) => {
    const stage = document.querySelector('[data-view]')
    if (stage === null || stage.childElementCount === 0) return { ready: false, why: 'not mounted' }
    if (document.fonts.status !== 'loaded') return { ready: false, why: 'fonts' }

    const images = [...document.images]
    const pending = images.filter((image) => !image.complete).length
    if (pending > 0) return { ready: false, why: pending + ' image(s)' }

    const text = (stage.innerText ?? '').trim()
    if (text.length < 20) return { ready: false, why: 'almost no text' }

    const somewhere = (within, selector) => {
      if (within.querySelector(selector) !== null) return true
      for (const node of within.querySelectorAll('*')) {
        if (node.shadowRoot && somewhere(node.shadowRoot, selector)) return true
      }
      return false
    }

    if (want && !somewhere(stage, want)) return { ready: false, why: 'waiting for ' + want }

    return { ready: true, why: 'drawn' }
  })(` + JSON.stringify(want ?? null) + `)`
  )

const settled = async (want: string | null) => {
  const deadline = Date.now() + SETTLE_SECONDS * 1000
  let seen = await drawn(want)
  while (!seen.ready && Date.now() < deadline) {
    await sleep(400)
    seen = await drawn(want)
  }
  return seen
}

/** Two frames, for the reason `capture.js` gives: settled state, unpainted raster. */
const painted = () =>
  js(
    String.raw`new Promise((done) =>
    requestAnimationFrame(() => requestAnimationFrame(() => done(true)))
  )`
  )

mkdirSync(OUT, { recursive: true })

for (const view of wanted) {
  await tab.send("Emulation.setDeviceMetricsOverride", {
    width: view.width,
    height: view.height,
    deviceScaleFactor: 1,
    mobile: false
  })
  await goto(`${STAGE}/?view=${view.name}`)

  const seen = await settled(view.ready ?? null)
  if (!seen.ready) console.log(`  ! ${view.name} was still ${seen.why}`)

  await painted()
  await sleep(600)

  const shot = await tab.send<{ data: string }>("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
    clip: { x: 0, y: 0, width: view.width, height: view.height, scale: 1 }
  })
  writeFileSync(`${OUT}/${view.name}.png`, Buffer.from(shot.data, "base64"))
  console.log(`  ${view.name}  ${view.width}x${view.height}`)
}

console.log(`\n${wanted.length} view(s) photographed into ${OUT}`)

tab.close()
browser.close()
chrome.kill()
stopStage?.()
