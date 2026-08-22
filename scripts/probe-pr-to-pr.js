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

/**
 * The pull request to press from, when it has to be a particular one.
 *
 * Empty by default, which takes the first of the reader's own that carries a
 * link to another. Size decides this measurement more than anything else does: a
 * small pull request is readable in 618ms and a stacked one of forty thousand
 * characters takes three times that, so a run against whichever came first can
 * disagree with the benchmark by a factor of three and both are right.
 */
const FROM = "1999"

const task = await useOrCreateTaskSpace("probe pr to pr")
await takeOverTaskSpace(task.id)

const focus = async () => {
  await cdp("Emulation.setFocusEmulationEnabled", { enabled: true })
  await cdp("Page.bringToFront")
}

/**
 * Leaves the freshly built copy of this on and every other copy of it off, in
 * this task space.
 *
 * Every measurement is worthless without it, and it has to happen here rather
 * than in a script of its own: a space is its own browser, so a switch flipped
 * in one is not flipped in the next. A copy from the store cannot be uninstalled
 * at all — "extension is not an unpacked extension" — and two copies switched on
 * sweep each other's root off the page, which is a blank page rather than a slow
 * one. Both were measured and reported before this existed.
 */
const leaveOneCopy = async (path) => {
  const { id: mine } = await cdp("Extensions.loadUnpacked", { path }, null)

  const READ_THEM = String.raw`(() => {
    const manager = document.querySelector("extensions-manager")
    const list = manager?.shadowRoot?.querySelector("extensions-item-list")
    if (list == null) return JSON.stringify({ trouble: "their extensions page will not answer" })
    return JSON.stringify([...list.shadowRoot.querySelectorAll("extensions-item")].map((item) => ({
      id: item.id,
      name: item.shadowRoot.querySelector("#name")?.textContent?.trim(),
      on: item.shadowRoot.querySelector("#enableToggle")?.getAttribute("aria-pressed") === "true"
    })))
  })()`

  const listThem = async () => {
    await gotoAndWait("chrome://extensions/", { timeout: 60, settle: 2 })
    await wait(2)
    const answer = JSON.parse(await js(READ_THEM))
    if (answer.trouble !== undefined) throw new Error(answer.trouble)
    return answer
  }

  // By name, because an unpacked id is derived from its path: a build in a
  // worktree has another one, and a list written by id leaves it running.
  for (const one of await listThem()) {
    if (!/gitquiet/i.test(one.name ?? "")) continue
    if (one.on === (one.id === mine)) continue
    await js(String.raw`(() => {
      const manager = document.querySelector("extensions-manager")
      const list = manager?.shadowRoot?.querySelector("extensions-item-list")
      const item = list?.shadowRoot?.querySelector("extensions-item#" + ${JSON.stringify(one.id)})
      item?.shadowRoot?.querySelector("#enableToggle")?.click()
      return true
    })()`)
    await wait(1)
  }

  return mine
}

/** Every copy of anything serving the page in front of us. */
const servingHere = async () =>
  JSON.parse(
    await js(String.raw`(() => {
      const ids = new Set()
      for (const node of document.querySelectorAll("[src],[href]")) {
        const found = String(node.getAttribute("src") || node.getAttribute("href") || "")
          .match(/chrome-extension:\/\/([a-z]{32})/)
        if (found !== null) ids.add(found[1])
      }
      return JSON.stringify([...ids])
    })()`)
  )

const mine = await leaveOneCopy(EXTENSION)
cliLog(`the build under test is ${mine}`)

/*
 * A moment for the switches to settle, and a second go at the first navigation.
 * Chrome is starting and stopping extensions as those switches are flipped, and a
 * navigation asked for during that has timed out at the transport twice.
 */
await wait(8)
await cdp("Emulation.setFocusEmulationEnabled", { enabled: true })
await cdp("Page.bringToFront")

const land = async (where, how) => {
  try {
    await gotoAndWait(where, how)
  } catch (trouble) {
    cliLog(`${where} would not answer, trying again: ${String(trouble)}`)
    await wait(8)
    try {
      await gotoAndWait(where, how)
    } catch {
      await wait(15)
      await gotoAndWait(where, how)
    }
  }
}

await land(OPEN_PULLS, { timeout: 60, settle: 3 })
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
    window.__probe.wall = Date.now()
    document.documentElement.removeAttribute("data-gq-trace")
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

  /*
   * Who spent it, which a long task cannot say. Their profiler is not reachable
   * from here, and this is the part of it that matters: every script that ran
   * inside a slow frame, with the function and the file it came from.
   */
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        for (const script of entry.scripts ?? []) {
          if (script.duration < 8) continue
          say("script", {
            ms: Math.round(script.duration),
            fn: script.sourceFunctionName || script.invoker || "(anonymous)",
            url: String(script.sourceURL || "").split("/").slice(-1)[0].slice(0, 40)
          })
        }
      }
    }).observe({ type: "long-animation-frame", buffered: true })
  } catch (trouble) {
    // Older Chrome, where the timeline above is all there is.
  }

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
for (const number of FROM === "" ? found.numbers : [FROM]) {
  await land(`https://github.com/${found.repo}/pull/${number}`, { timeout: 60, settle: 4 })
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
const serving = await servingHere()
cliLog(`serving this page: ${JSON.stringify(serving)}`)
if (serving.length !== 1 || serving[0] !== mine) {
  cliLog(`This is not the build under test (${mine}). Run scripts/one-copy.js and try again.`)
  await completeTaskSpace(task.id, { keep: false })
  throw new Error("the wrong copy is answering")
}

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
    mark.fn !== undefined
      ? `${mark.ms}ms  ${mark.fn}  ${mark.url}`
      : mark.ms !== undefined
      ? `${mark.ms}ms ${mark.url ?? ""}`
      : mark.to !== undefined
        ? mark.to
        : ""
  cliLog(`${String(mark.at).padStart(6)}ms  ${mark.what.padEnd(10)}${extra}`)
}

/*
 * The extension's own timeline, which it writes into the document element
 * because nothing else crosses from its world into this one.
 */
const trail = JSON.parse(
  await js(String.raw`JSON.stringify({
    said: document.documentElement.getAttribute("data-gq-trace"),
    from: window.__probe?.wall ?? null
  })`)
)
if (trail.said !== null && trail.from !== null) {
  cliLog("\nwhat the extension says it did\n")
  for (const step of String(trail.said).split("|").filter(Boolean)) {
    const [what, when] = step.split("@")
    cliLog(`${String(Number(when) - trail.from).padStart(6)}ms  ${what}`)
  }
}

const blocked = marks
  .filter((mark) => mark.what === "long task")
  .reduce((total, mark) => total + mark.ms, 0)
cliLog(`\nmain thread blocked for ${blocked}ms in total`)

const mark_is_script = (one) => one.what === "script"
const byName = new Map()
for (const mark of marks.filter((one) => mark_is_script(one))) {
  const key = `${mark.fn}  ${mark.url}`
  byName.set(key, (byName.get(key) ?? 0) + mark.ms)
}
if (byName.size > 0) {
  cliLog("\nwhere it went, by script, milliseconds\n")
  for (const [key, ms] of [...byName].sort((left, right) => right[1] - left[1]).slice(0, 20)) {
    cliLog(`${String(ms).padStart(6)}ms  ${key}`)
  }
}

await completeTaskSpace(task.id, { keep: false })
