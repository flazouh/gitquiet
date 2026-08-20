/**
 * Where the second before the address goes, on a press from one pull request to
 * another.
 *
 *     bun run build && ego-browser nodejs < scripts/probe-pr-to-pr.js
 *
 * The benchmark says this move reaches a readable page in 2,180ms and moves the
 * address at 990ms, against 128ms for the same destination pressed from the list.
 * The address is pushed by the click handler itself, so a second spent before it
 * is a second the main thread was not free, or an event that never came.
 *
 * So this records the press's own events, the push, and every long task with its
 * duration, rather than sampling what the page looks like.
 */

const EXTENSION = "/Users/alex/Documents/githubpro/.output/chrome-mv3"
const OPEN_PULLS = "https://github.com/pulls"

const task = await useOrCreateTaskSpace("probe pr to pr")
await takeOverTaskSpace(task.id)

const focus = async () => {
  await cdp("Emulation.setFocusEmulationEnabled", { enabled: true })
  await cdp("Page.bringToFront")
}

const copiesHere = async () => {
  const fromPage = await js(String.raw`(() => {
    const ids = new Set()
    for (const node of document.querySelectorAll("[src],[href]")) {
      const found = String(node.getAttribute("src") || node.getAttribute("href") || "")
        .match(/chrome-extension:\/\/([a-z]{32})/)
      if (found !== null) ids.add(found[1])
    }
    return [...ids]
  })()`)
  const { targetInfos = [] } = await cdp("Target.getTargets", {}, null)
  const fromTargets = targetInfos
    .map((info) => (String(info.url || "").match(/^chrome-extension:\/\/([a-z]+)/) || [])[1])
    .filter(Boolean)
  return [...new Set([...fromPage, ...fromTargets])]
}

await gotoAndWait(OPEN_PULLS, { timeout: 60, settle: 3 })
await focus()

for (const id of await copiesHere()) {
  try {
    await cdp("Extensions.uninstall", { id }, null)
  } catch {
    // Already gone, which is the state this wants.
  }
}
await cdp("Extensions.loadUnpacked", { path: EXTENSION }, null)
await focus()

await gotoAndWait(OPEN_PULLS, { timeout: 60, settle: 3 })
await wait(3)

const lookForPulls = () => js(String.raw`(() => {
  const seen = new Map()
  for (const link of document.querySelectorAll('a[href*="/pull/"]')) {
    const parts = (link.getAttribute("href") || "").match(/^\/([^/]+\/[^/]+)\/pull\/(\d+)/)
    if (parts === null) continue
    const numbers = seen.get(parts[1]) ?? []
    if (!numbers.includes(parts[2])) numbers.push(parts[2])
    seen.set(parts[1], numbers)
  }
  const best = [...seen].sort((left, right) => right[1].length - left[1].length)[0]
  return best === undefined ? null : { repo: best[0], numbers: best[1].slice(0, 6) }
})()`)

let found = null
for (let look = 0; look < 6 && found === null; look++) {
  found = await lookForPulls()
  if (found === null) await wait(2)
}
if (found === null) {
  cliLog("Nothing to press: their list would not answer.")
  await completeTaskSpace(task.id, { keep: false })
  throw new Error("no pull request to press")
}


/**
 * The press as the page experiences it: its own events, its own push, and the
 * work in between.
 *
 * Long tasks are the point. A press whose handler pushes the address on the same
 * turn cannot move the address a second late unless the turn itself is a second
 * long, or the turn never came.
 */
const RECORDER = String.raw`(() => {
  const marks = []
  window.__probe = { marks, started: null }
  const at = () => Math.round(performance.now() - window.__probe.started)
  const say = (what, extra) => {
    if (window.__probe.started === null) return
    marks.push({ at: at(), what, ...extra })
  }

  const root = () => document.querySelector("#gitquiet-root")
  const look = () => ({
    chars: root() === null ? -1 : root().textContent.length,
    loading: root() === null ? -1 : root().querySelectorAll("[data-gitquiet-loading]").length,
    shown: document.documentElement.getAttribute("data-gitquiet-shown"),
    drawnAt: document.documentElement.getAttribute("data-gitquiet-at"),
    path: location.pathname
  })

  document.addEventListener("pointerdown", () => {
    if (window.__probe.started !== null) return
    window.__probe.started = performance.now()
    marks.push({ at: 0, what: "pointerdown", ...look() })
  }, { capture: true })

  for (const name of ["pointerup", "click", "mousedown", "mouseup"]) {
    document.addEventListener(name, () => say(name), { capture: true })
  }

  const pushed = history.pushState.bind(history)
  history.pushState = (state, title, url) => {
    say("pushState", { to: String(url) })
    return pushed(state, title, url)
  }
  const replaced = history.replaceState.bind(history)
  history.replaceState = (state, title, url) => {
    say("replaceState", { to: String(url) })
    return replaced(state, title, url)
  }

  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      say("long task", { ms: Math.round(entry.duration) })
    }
  }).observe({ entryTypes: ["longtask"] })

  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (window.__probe.started === null) continue
      if (entry.duration < 40) continue
      const name = String(entry.name)
      if (!name.includes("github.com") && !name.includes("chrome-extension")) continue
      say("request", { ms: Math.round(entry.duration), url: name.slice(-70) })
    }
  }).observe({ entryTypes: ["resource"] })

  let was = null
  const ticking = setInterval(() => {
    const now = look()
    const said = JSON.stringify(now)
    if (said === was) return
    was = said
    say("page", now)
  }, 16)
  setTimeout(() => clearInterval(ticking), 12000)
  return true
})()`

/*
 * Looked for until it is there. The root goes up before the read behind it comes
 * back, so a single look a moment too early reports a page with no links on it.
 */
/*
 * Looked for on more than one pull request. Only a stacked one carries links to
 * its neighbours, and which pull request is first on the reader's list changes by
 * the hour: the first candidate tried here held exactly one link, to itself.
 */
const lookForSpot = (number) => js(String.raw`(() => {
  const root = document.querySelector("#gitquiet-root")
  if (root === null) return null
  const link = [...root.querySelectorAll('a[href*="/pull/"]')]
    .filter((a) => !a.pathname.endsWith("/" + ${JSON.stringify(number)}))
    .find((a) => {
      const box = a.getBoundingClientRect()
      return box.width > 4 && box.height > 4 && box.top >= 0 && box.top < innerHeight - 40
    })
  if (link === undefined) return null
  const box = link.getBoundingClientRect()
  return {
    x: Math.round(box.left + box.width / 2),
    y: Math.round(box.top + box.height / 2),
    to: link.pathname
  }
})()`)

let spot = null
let from = null
for (const number of found.numbers) {
  await gotoAndWait(`https://github.com/${found.repo}/pull/${number}`, { timeout: 60, settle: 4 })
  try {
    await waitForElement("#gitquiet-root", { timeout: 20 })
  } catch {
    continue
  }
  for (let look = 0; look < 8 && spot === null; look++) {
    spot = await lookForSpot(number)
    if (spot === null) await wait(1)
  }
  if (spot !== null) {
    from = number
    break
  }
  cliLog(`#${number} carries no link to another pull request, trying the next`)
}

if (spot === null) {
  const said = await js(String.raw`(() => {
    const root = document.querySelector("#gitquiet-root")
    if (root === null) return JSON.stringify({ root: "missing", where: location.pathname })
    return JSON.stringify({
      where: location.pathname,
      chars: root.textContent.length,
      shown: document.documentElement.getAttribute("data-gitquiet-shown"),
      anchors: root.querySelectorAll("a").length,
      pulls: root.querySelectorAll('a[href*="/pull/"]').length,
      text: root.textContent.slice(0, 200)
    })
  })()`)
  cliLog(`No link of ours to press on this pull request: ${said}`)
  await completeTaskSpace(task.id, { keep: false })
  throw new Error("no link to press")
}

/*
 * Which copy is drawing this, asked here rather than at the start. A copy the
 * reader has installed from the store attaches on navigation, so a page checked
 * before the navigation looks clean and the press is answered by a build that is
 * not the one under test.
 */
const serving = await js(String.raw`(() => {
  const ids = new Set()
  for (const node of document.querySelectorAll("[src],[href]")) {
    const found = String(node.getAttribute("src") || node.getAttribute("href") || "")
      .match(/chrome-extension:\/\/([a-z]{32})/)
    if (found !== null) ids.add(found[1])
  }
  return JSON.stringify([...ids])
})()`)
cliLog(`serving this page: ${serving}`)

await hover([spot.x, spot.y])
await wait(2)
await js(RECORDER)
await click([spot.x, spot.y])
await wait(9)

const marks = JSON.parse(await js(String.raw`JSON.stringify(window.__probe?.marks ?? [])`))

cliLog(`pressed #${from} to ${spot.to}\n`)
let lastPage = null
for (const mark of marks) {
  if (mark.what === "page") {
    const said = `${mark.path} chars ${mark.chars} loading ${mark.loading} at ${mark.drawnAt}`
    if (said === lastPage) continue
    lastPage = said
    cliLog(`${String(mark.at).padStart(6)}ms  page      ${said}`)
    continue
  }
  const extra =
    mark.ms !== undefined
      ? `${mark.ms}ms ${mark.url ?? ""}`
      : mark.to !== undefined
        ? mark.to
        : ""
  cliLog(`${String(mark.at).padStart(6)}ms  ${mark.what.padEnd(10)}${extra}`)
}

const blocked = marks
  .filter((mark) => mark.what === "long task")
  .reduce((total, mark) => total + mark.ms, 0)
cliLog(`\nmain thread blocked for ${blocked}ms in total`)

await completeTaskSpace(task.id, { keep: false })
