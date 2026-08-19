/**
 * Times every move a reader makes between screens, from the press to a page
 * they can read.
 *
 *     bun run build && ego-browser nodejs < scripts/benchmark-transitions.js
 *
 * The other benchmarks here each measure one route. This one walks the whole
 * graph, because a slow transition is never found by measuring the one you
 * already suspect: the press between two pull requests was reported as a hang,
 * and the press it was compared against turned out to be slower.
 *
 * Three rules, each of which has produced a wrong answer in this repository:
 *
 * 1. Load the built extension, not the one the dev server is writing. A rebuild
 *    lands mid-run, the content script is injected again, and one press in five
 *    comes back two seconds slow for a reason that is not in the code.
 * 2. Leave exactly one copy installed. Two copies each sweep the other's root
 *    off the page, and the reader gets a blank page rather than a slow one.
 * 3. Start the clock on the page's own press event. A clock started by the
 *    script that asked for a press counts the pointer's travel as latency, and
 *    that alone reported 1,535ms for a press that took 297ms.
 *
 * And one about GitHub rather than about the measurement: a full run is a few
 * hundred requests with your own session, and they will throttle you for it.
 * Every route comes back 503, the interface says the pull request could not be
 * read, and a run made in that state reports numbers that describe the throttle.
 * So the run stops when GitHub stops answering, and waits between presses.
 */

const EXTENSION = "/Users/alex/Documents/githubpro/.output/chrome-mv3"

/**
 * Where to look for something to press, rather than a repository named here.
 *
 * Pull request numbers rot. This script was written against three of them and
 * every one was merged within the day; the run that followed reported 404s as
 * transitions and a repository that plainly worked as "Page not found". So the
 * pull requests come from the reader's own list of them, at run time.
 */
const OPEN_PULLS = "https://github.com/pulls"

/**
 * Where to start when that list will not answer, which happens.
 *
 * GitHub times out their own list pages on a repository with enough pull
 * requests open — their unicorn, on `/pulls` and on the repository's own tab,
 * while every pull request page in the same repository answers in full. A run
 * blocked on the list measures nothing, so put any pull request here and the rest
 * are read off the stack strip on it.
 *
 * Empty by default, and it belongs empty: a pull request number written into this
 * file rots within the day, which is the reason the discovery above exists at all.
 * Fill it in for the run you are doing and take it out again.
 */
const START = ""

/** Enough presses to have a median that is not one unlucky run. */
const RUNS = 3

/**
 * How long to leave GitHub alone between presses.
 *
 * Each press is fourteen requests or so with the reader's own session, and a run
 * makes a few hundred. Without this the run trips their throttle about two thirds
 * of the way through and measures it for the rest.
 */
const BREATHE = 3

/**
 * The moves, each one a page to start on and a link to press on it.
 *
 * `find` runs in the page and hands back the middle of a link to press. It
 * looks only inside our own root: GitHub's own anchors are still in the
 * document at zero by zero on every page this takes over, and pressing one goes
 * nowhere at all.
 */
const movesFor = (repo, number) => [
  {
    name: "list to pull request",
    from: `https://github.com/${repo}/pulls`,
    find: `[...root.querySelectorAll('a[href*="/pull/"]')]`
  },
  {
    name: "pull request to pull request",
    from: `https://github.com/${repo}/pull/${number}`,
    find: `[...root.querySelectorAll('a[href*="/pull/"]')].filter((a) => !a.href.endsWith("/${number}"))`
  },
  {
    name: "pull request to the list",
    from: `https://github.com/${repo}/pull/${number}`,
    find: `[...root.querySelectorAll('a[href$="/pulls"]')]`
  },
  {
    name: "list to issues",
    from: `https://github.com/${repo}/pulls`,
    find: `[...root.querySelectorAll('a[href*="/issues"]')]`
  },
  {
    name: "home to a pull request",
    from: "https://github.com/",
    find: `[...root.querySelectorAll('a[href*="/pull/"]')]`
  }
]

const task = await useOrCreateTaskSpace("benchmark transitions")
await takeOverTaskSpace(task.id)

const focus = async () => {
  await cdp("Emulation.setFocusEmulationEnabled", { enabled: true })
  await cdp("Page.bringToFront")
}

/** Every extension serving files into this page, however it got installed. */
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

/**
 * What the page reports about itself, sampled rather than observed.
 *
 * A mutation observer coalesces a removal and an insertion made in one React
 * commit into a single callback, so a blank window between the two is invisible
 * to it. A sample every 16ms cannot miss one that a reader can see.
 */
const SAMPLER = String.raw`(() => {
  window.__moves = { marks: [], started: null }
  const say = (what, extra) => {
    if (window.__moves.started === null) return
    window.__moves.marks.push({ at: Math.round(performance.now() - window.__moves.started), what, ...extra })
  }

  const look = () => {
    const root = document.querySelector("#gitquiet-root")
    return {
      chars: root === null ? -1 : root.textContent.length,
      loading: root === null ? -1 : root.querySelectorAll("[data-gitquiet-loading]").length,
      shown: document.documentElement.getAttribute("data-gitquiet-shown"),
      path: location.pathname
    }
  }

  let was = null
  const ticking = setInterval(() => {
    const now = look()
    const said = JSON.stringify(now)
    if (said === was) return
    was = said
    say("change", now)
  }, 16)

  // The page's own press, which is the only honest zero.
  document.addEventListener("pointerdown", () => {
    if (window.__moves.started !== null) return
    window.__moves.started = performance.now()
    was = JSON.stringify(look())
    window.__moves.marks.push({ at: 0, what: "press", ...look() })
  }, { capture: true })

  setTimeout(() => clearInterval(ticking), 15000)
  return true
})()`

/**
 * When the reader could read the page they asked for.
 *
 * The address alone is not it: the address moves the instant the press is
 * answered, a whole screen before anything is drawn. Nor is the first change,
 * which on most of these is the old screen losing a panel. It is the first
 * moment the root holds the new page and has stopped saying it is loading.
 */
const readable = (marks) => {
  const first = marks[0]
  if (first === undefined) return {}
  const moved = marks.find((m) => m.path !== first.path)
  const drawn = marks.find(
    (m) => m.path !== first.path && m.chars > 1000 && m.chars !== first.chars && m.loading === 0
  )
  const blank = marks.filter((m) => m.chars < 500)
  const last = marks.at(-1)
  return {
    address: moved?.at,
    drawn: drawn?.at,
    settled: last?.at,
    blank: blank.length === 0 ? undefined : blank.at(-1).at - blank[0].at + 16
  }
}

const median = (numbers) => {
  const had = numbers.filter((n) => typeof n === "number").sort((a, b) => a - b)
  return had.length === 0 ? undefined : had[Math.floor(had.length / 2)]
}

const show = (value) => (value === undefined ? "—" : `${value}ms`)

/**
 * Whether GitHub is still answering us, asked of the route every read starts with.
 *
 * Anything but 200 means the rest of this run would be timing their error page.
 * Both headers are needed: they answer 406 to these routes without the second.
 *
 * The status is worth reading out rather than reporting a stopped run as one
 * thing. A 5xx is their throttle and passes on its own if you leave it alone. A
 * 401 is the session, and waiting for that to pass is an hour spent on the one
 * cause that will not: single sign-on for the organisation has run out and only
 * the reader can renew it.
 */
const stillAnswering = async (at) => {
  const status = await js(String.raw`(async () => {
    try {
      const answer = await fetch(${JSON.stringify(`${at}/changes`)}, {
        headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
        credentials: "include"
      })
      return answer.status
    } catch { return 0 }
  })()`)
  if (status === 200) return null
  if (status === 401 || status === 403) {
    return `GitHub answered ${status}: this session has lost access to the repository. Sign in, or renew single sign-on for the organisation, and run this again`
  }
  return `GitHub answered ${status}: they are throttling this account. Leave them alone for a few minutes and run this again`
}

const once = async (move, rest) => {
  await wait(BREATHE)
  await gotoAndWait(move.from, { timeout: 60, settle: 4 })
  try {
    await waitForElement("#gitquiet-root", { timeout: 20 })
  } catch {
    return { skipped: "the interface never stood up" }
  }
  await wait(2)

  /*
   * Looked for until it is there, rather than once.
   *
   * The root goes up before the read behind it comes back, so on a cold copy of
   * the extension there is a second or two where our screen is standing and holds
   * no rows at all. Asked once, at whatever moment that is, the whole run reports
   * "no link of ours to press" and measures nothing — which is what it did, for
   * ten minutes, on a build that turned out to be fine.
   */
  const lookForSpot = async () => {
    for (let look = 0; look < 10; look++) {
      const found = await js(String.raw`(() => {
        const root = document.querySelector("#gitquiet-root")
        if (root === null) return null
        const links = ${move.find}
        const link = links.find((a) => {
          const box = a.getBoundingClientRect()
          return box.width > 4 && box.height > 4 && box.top >= 0 && box.top < innerHeight - 40
        })
        if (link === undefined) return null
        const box = link.getBoundingClientRect()
        return { x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2), to: link.pathname }
      })()`)
      if (found !== null) return found
      await wait(1)
    }
    return null
  }

  const spot = await lookForSpot()
  if (spot === null) return { skipped: "no link of ours to press" }

  await hover([spot.x, spot.y])
  if (rest > 0) await wait(rest)
  await js(SAMPLER)
  await click([spot.x, spot.y])

  /*
   * Waited out rather than waited for a fixed span.
   *
   * Eight seconds was the fixed span, and on a slow evening it threw away most of
   * a run: a press that becomes readable at 8.4s reports nothing at all, and a
   * table of dashes says the same thing whether the interface is slow or broken.
   * The cap is what keeps a press their router really did drop from holding the
   * whole run, and polling is what stops a fast press paying for the cap.
   */
  const marks = await (async () => {
    for (let waited = 0; waited < 20; waited += 0.25) {
      const seen = JSON.parse(await js(String.raw`JSON.stringify(window.__moves?.marks ?? [])`))
      if (seen.length > 0 && readable(seen).drawn !== undefined) return seen
      await wait(0.25)
    }
    return JSON.parse(await js(String.raw`JSON.stringify(window.__moves?.marks ?? [])`))
  })()

  // Gone means the press loaded a document rather than swapping a screen, which
  // takes the sampler with it. That is a result about the move, not a crash.
  if (marks.length === 0) return { skipped: "the press loaded a whole document" }
  return { to: spot.to, ...readable(marks) }
}

await gotoAndWait(OPEN_PULLS, { timeout: 60, settle: 3 })
await focus()

/*
 * Down to one copy before anything is read, rather than before anything is timed.
 *
 * `Extensions.loadUnpacked` persists in a task space, so a copy is left behind by
 * every run and they all answer every event. Two of them fight over `#gitquiet-root`
 * — each sees the other's tree as a stray, removes it, and unmounts — and what they
 * leave is an empty page. Cleaned up after the list was read, that empty page was
 * read as "this account has no pull requests open" and the run stopped on it.
 */
for (const id of await copiesHere()) {
  try {
    await cdp("Extensions.uninstall", { id }, null)
  } catch {
    // Already gone, which is the state this wants.
  }
}
const { id } = await cdp("Extensions.loadUnpacked", { path: EXTENSION }, null)
cliLog(`one copy installed: ${id}`)
await focus()

await gotoAndWait(OPEN_PULLS, { timeout: 60, settle: 3 })
await wait(3)

/**
 * The repository with the most pull requests open to the reader, and one of them.
 *
 * Asked more than once. Whichever copy of the interface is installed gates their
 * list while its own is being read, so a single look a few seconds in finds an
 * empty page and concludes the reader has no pull requests at all.
 */
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
  return best === undefined ? null : { repo: best[0], number: best[1][0], open: best[1].length }
})()`)

let found = null
for (let look = 0; look < 6 && found === null; look++) {
  found = await lookForPulls()
  if (found === null) await wait(2)
}

if (found === null && START !== "") {
  const named = START.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/)
  if (named !== null) {
    await gotoAndWait(START, { timeout: 60, settle: 4 })
    await wait(4)
    found = { repo: named[1], number: named[2], open: 0 }
    cliLog(`their list would not answer, so starting from ${START}`)
  }
}

if (found === null) {
  /*
   * Two things that are not an empty list, and both of them look like one here.
   *
   * Their unicorn is what being throttled looks like from a browser: a 503
   * dressed as an apology, on every page, for minutes at a time. Their sign-on
   * prompt is what an organisation's single sign-on looks like once it has run
   * out: the list draws, and every pull request behind that organisation is
   * missing from it.
   *
   * Both are worth naming, because the honest reading of an empty list is "you
   * have no pull requests" and that sends the next hour in the wrong direction.
   * It sent one there already.
   */
  const page = await js(String.raw`JSON.stringify({
    title: document.title,
    text: document.body.innerText.slice(0, 4000)
  })`)
  const { title, text } = JSON.parse(page)
  const cause =
    title.includes("Unicorn") || text.includes("No server is currently available")
      ? "GitHub is refusing this account: every page is their 503. Leave them alone for a few minutes and run this again."
      : /single sign-on/i.test(text)
        ? "GitHub is asking for single sign-on, so their list is hiding the pull requests behind that organisation. Renew it in the browser and run this again."
        : "No pull request open to this account, so there is nothing to press."
  cliLog(`Nothing measured. ${cause}`)
  await completeTaskSpace(task.id, { keep: false })
  throw new Error(cause)
}
cliLog(`pressing around ${found.repo}, ${found.open} open, starting at #${found.number}`)

const HERE = `https://github.com/${found.repo}/pull/${found.number}`
const MOVES = movesFor(found.repo, found.number)

const stopped = await stillAnswering(HERE)
if (stopped !== null) {
  cliLog(`Nothing measured. ${stopped}.`)
  await completeTaskSpace(task.id, { keep: false })
  throw new Error(stopped)
}

const table = []
walking: for (const move of MOVES) {
  for (const rest of [0, 1.2]) {
    const runs = []
    for (let run = 0; run < RUNS; run++) runs.push(await once(move, rest))

    const stoppedNow = await stillAnswering(HERE)
    if (stoppedNow !== null) {
      cliLog(`\nStopping here, part way through: everything below would be their error page.`)
      cliLog(stoppedNow)
      break walking
    }

    const skipped = runs.find((r) => r.skipped)
    if (skipped !== undefined && runs.every((r) => r.skipped)) {
      cliLog(`${move.name} (${rest > 0 ? "rested" : "cold"}): skipped, ${skipped.skipped}`)
      continue
    }
    const row = {
      name: `${move.name} ${rest > 0 ? "(rested 1.2s)" : "(cold)"}`,
      address: median(runs.map((r) => r.address)),
      drawn: median(runs.map((r) => r.drawn)),
      blank: median(runs.map((r) => r.blank)),
      // How many presses the middle number is actually the middle of. One or two of
      // three can be thrown away above, and a row reading "median of 3" that is one
      // sample is the kind of number somebody quotes in a comment for a year.
      of: runs.filter((r) => typeof r.drawn === "number").length
    }
    table.push(row)
    cliLog(
      `${row.name.padEnd(44)} address ${show(row.address).padStart(7)}   readable ${show(row.drawn).padStart(7)}   blank ${show(row.blank)}`
    )
  }
}

cliLog(`\n${"-".repeat(78)}`)
cliLog("Press to a readable page\n")
for (const row of table) {
  cliLog(
    `  ${row.name.padEnd(44)}${show(row.drawn).padStart(9)}   median of ${row.of}${row.of < RUNS ? ` (${RUNS - row.of} thrown away)` : ""}`
  )
}

await completeTaskSpace(task.id, { keep: false })
