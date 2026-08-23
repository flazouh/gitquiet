/**
 * Records how long the reader waits for a page they have already seen.
 *
 *     echo /path/to/chrome-mv3 > /tmp/gq-probe-build.txt
 *     ego-browser nodejs < scripts/probe-back-memory.js
 *
 * The question is the one Alex asked: why is Back not instant. Every navigation of
 * ours closes the screen and stands a new one up, so the way back read the working
 * set again before it could draw anything. `src/ui/lastDrawn.ts` keeps what was
 * drawn, and this measures what that is worth.
 *
 * The walk leaves for a page the extension does not draw and comes back, five
 * times. Leaving is `pushState`, which is what `goTo` does with an address, and
 * coming back is the back button itself. It does not walk into a pull request:
 * arriving at one of a few thousand changed files blocks the renderer for minutes
 * — on both builds, so it is not what this is about — and which pull request the
 * working set lists changes from one run to the next.
 *
 * Every observation is a `MutationObserver` batch rather than a frame, for the
 * reason `probe-flicker-dom.js` gives: `requestAnimationFrame` is throttled in a
 * tab nobody is looking at, and a task space is exactly that tab. The walk is
 * driven from inside the page for the same kind of reason: the renderer stops
 * answering while a screen is standing up, and a walk driven from out here stops
 * with it.
 *
 * Do not believe a reading taken in the first seconds after `Extensions.loadUnpacked`
 * with an uncached reload. Two alarming numbers came out of that window and neither
 * survived: a pull request of a few thousand files appeared to wedge the renderer for
 * minutes, and a cold arrival at one appeared to take nine seconds. Measured again on
 * a browser that had been sitting still, the same pull request answers throughout and
 * the same arrival takes 2.2 to 3.0 seconds. The wait below is there for that reason.
 *
 * The build is named in a file rather than in the environment, because the heredoc
 * runs in ego's own Node and cannot see a variable set on this shell's command.
 * Whichever build is named, the other is uninstalled first: two copies of one
 * extension both answer every navigation, and the reading is then of two
 * interfaces racing.
 */

import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

const HERE = "https://github.com/pulls"
const AWAY = "/flazouh/perry-proof-qa"
const MINE = "/Users/alex/Documents/githubpro/.output/chrome-mv3"
const NAMED = "/tmp/gq-probe-build.txt"
const ROUNDS = 5

const asked = (() => {
  try {
    return readFileSync(NAMED, "utf8").trim()
  } catch {
    return ""
  }
})()
const BUILD = asked === "" ? MINE : asked
const OTHER = BUILD === MINE ? "/Users/alex/gq-baseline/.output/chrome-mv3" : MINE

/** The id the browser gives an unpacked build, which is a function of its path. */
const idOf = (path) =>
  [...createHash("sha256").update(path, "utf8").digest("hex").slice(0, 32)]
    .map((nibble) => String.fromCharCode(97 + parseInt(nibble, 16)))
    .join("")

const task = await useOrCreateTaskSpace("qa back memory")
cliLog(`task space ${task.id}`)

for (const path of [OTHER, `${BUILD}-dev`, `${OTHER}-dev`]) {
  try {
    await cdp("Extensions.uninstall", { id: idOf(path) }, null)
    cliLog(`removed ${path}`)
  } catch {
    // Not installed, which is the ordinary case.
  }
}

const { id } = await cdp("Extensions.loadUnpacked", { path: BUILD }, null)
cliLog(`installed ${BUILD} as ${id}`)

await openOrReuseTab(HERE, { wait: true, timeout: 60 })
await cdp("Page.reload", { ignoreCache: true }).catch(() => cliLog("reload timed out, carrying on"))
await wait(10)

/** How long each leg of the walk is given before the next one starts. */
const LEG = 4000

const WALKER = String.raw`(() => {
  const started = performance.now()
  const log = []
  const at = () => Math.round(performance.now() - started)

  const digest = () => {
    const root = document.getElementById("gitquiet-root")
    if (root === null) return { root: "gone" }
    const text = (root.innerText || "").replace(/\s+/g, " ").trim()
    return { for: root.getAttribute("data-gitquiet-for"), chars: text.length }
  }

  let last = ""
  const drawn = () => {
    const now = digest()
    const key = JSON.stringify(now)
    if (key === last) return
    last = key
    log.push({ at: at(), ...now })
  }

  new MutationObserver(drawn).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  })
  drawn()

  const steps = []
  for (let round = 1; round <= ` + ROUNDS + String.raw`; round += 1) {
    steps.push(["away", () => history.pushState(null, "", "` + AWAY + String.raw`")])
    steps.push(["back " + round, () => history.back()])
  }

  let next = 0
  const tick = () => {
    if (next >= steps.length) {
      log.push({ at: at(), mark: "done" })
      return
    }
    const [what, act] = steps[next++]
    log.push({ at: at(), mark: what })
    act()
    setTimeout(tick, ` + LEG + String.raw`)
  }
  setTimeout(tick, 800)

  window.__back = { read: () => log }
  return "walking"
})()`

cliLog(await js(WALKER))

let log = null
for (let round = 0; round < 40; round += 1) {
  await wait(3)
  const said = await Promise.race([
    js(String.raw`JSON.stringify(window.__back?.read() ?? null)`),
    new Promise((rest) => setTimeout(() => rest(null), 4000))
  ]).catch(() => null)
  if (typeof said !== "string") continue
  const now = JSON.parse(said)
  if (now === null) throw new Error("the document was replaced: the walk was not a soft navigation")
  if (now.some((step) => step.mark === "done")) {
    log = now
    break
  }
}
if (log === null) throw new Error("the walk never finished")

cliLog("\n===== " + BUILD + " =====")
cliLog(JSON.stringify(log))

/*
 * What the reader waited, per leg: from the press to the first frame carrying the
 * list rather than an empty container. Six hundred characters is well past every
 * wait this interface draws and well under the list itself.
 */
const WHOLE = 600
const waits = []
for (let i = 0; i < log.length; i += 1) {
  const step = log[i]
  if (step.mark === undefined || !step.mark.startsWith("back")) continue
  const painted = log.slice(i + 1).find((later) => (later.chars ?? 0) > WHOLE)
  if (painted !== undefined) waits.push(painted.at - step.at)
}
waits.sort((one, two) => one - two)
cliLog("\n===== waits =====")
cliLog(`${waits.join("ms, ")}ms`)
cliLog(`median ${waits[Math.floor(waits.length / 2)]}ms of ${waits.length}`)
