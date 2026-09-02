/**
 * How many times a screen redraws itself while the reader watches a traversal.
 *
 *     bun run build && bun scripts/probe-traversal-paints.ts
 *
 * Recorded off a screen capture first, at 120 frames a second: pressing Back from
 * a pull request onto the list, the page arrived in four paints across a hundred
 * milliseconds — the description alone, then the changed-files toolbar, then the
 * file tree, then the diff. This is that reading taken from inside the document,
 * where each of those paints is a React commit and can be named rather than
 * guessed at from pixels.
 *
 * Three things are written down, all of them off the document itself:
 *
 *   - every mutation batch under `#gitquiet-root`, which is one commit apiece,
 *     with how much of the screen existed after it;
 *   - every CSS animation that starts, which says whether the entrance is being
 *     replayed for a page the reader is returning to rather than arriving at;
 *   - whether the surface was held, which is what keeps a traversal from showing
 *     a frame of nothing.
 *
 * Nothing here uses `requestAnimationFrame`. This window is not the foreground
 * window for most of the run, so its frame clock is throttled and a reading taken
 * off it measures the throttle. A mutation batch is not throttled and is the
 * thing being counted anyway.
 *
 * In a Chrome of its own, on a port and a profile of its own, because the
 * reader's browser has its own copy of this extension installed and two copies
 * answer every event: run with both live, every read failed outright.
 *
 * Which leaves the one thing this still needs and cannot make for itself. A cold
 * profile is signed out, and signed out there is nothing to measure: GitHub
 * answers as if a public pull request does not exist, and the screen says so
 * rather than drawing a card. So the profile has to carry a session. Point
 * GITQUIET_CDP_PROFILE at a Chrome profile directory that is already signed in
 * to github.com, with Chrome closed while this runs, and the screens draw.
 *
 *     GITQUIET_CDP_PROFILE=~/some-signed-in-profile bun scripts/probe-traversal-paints.ts
 */
import { rm } from "node:fs/promises"

const EXTENSION = `${import.meta.dir}/../.output/chrome-mv3`

/**
 * Set before `chrome.ts` is loaded, which is why the import below is dynamic: a
 * static import is evaluated ahead of every statement in this file, and that
 * module reads both of these at the top of itself.
 */
const PROFILE = process.env["GITQUIET_CDP_PROFILE"] ?? "/tmp/gitquiet-traversal-profile"
process.env["GITQUIET_CDP_PORT"] ??= "9333"
process.env["GITQUIET_CDP_PROFILE"] = PROFILE

const { withExtension } = await import("./chrome")

/** A public pull request with enough files on it to have a tree and a diff. */
const PULL = "https://github.com/honojs/hono/pull/4200"

/** Long enough for a screen to arrive and settle, and no longer. */
const SETTLING = 8_000

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** One thing that happened to the document, as the recorder writes it down. */
type Moment = {
  readonly at: number
  readonly what: "commit" | "animation" | "held" | "address"
  readonly said: string
}

const RECORDER = `
  (() => {
    const seen = []
    globalThis.__gitquietSeen = seen
    const from = performance.now()
    const since = () => Math.round(performance.now() - from)

    const size = () => {
      const standing = document.getElementById("gitquiet-root")
      return standing === null ? 0 : standing.querySelectorAll("*").length
    }

    let last = -1
    const commit = () => {
      const now = size()
      if (now === last) return
      last = now
      seen.push({ at: since(), what: "commit", said: String(now) })
    }

    new MutationObserver(commit).observe(document.documentElement, {
      childList: true,
      subtree: true
    })

    document.addEventListener(
      "animationstart",
      (event) => {
        seen.push({ at: since(), what: "animation", said: event.animationName })
      },
      true
    )

    let held = false
    new MutationObserver(() => {
      const now = document.querySelector("[data-gitquiet-leaving]") !== null
      if (now === held) return
      held = now
      seen.push({ at: since(), what: "held", said: now ? "surface held" : "hold released" })
    }).observe(document.documentElement, {
      attributes: true,
      subtree: true,
      attributeFilter: ["data-gitquiet-leaving"]
    })

    addEventListener("popstate", () => {
      seen.push({ at: since(), what: "address", said: location.pathname })
    })
    return true
  })()
`

const session = await (async () => {
  // Only the throwaway one. A signed-in profile handed in is the reader's and is
  // not this script's to empty.
  if (PROFILE.startsWith("/tmp/")) await rm(PROFILE, { recursive: true, force: true })
  return withExtension(PULL, EXTENSION)
})()

const look = () =>
  session.evaluate<Record<string, unknown>>(`
    (() => {
      const root = document.getElementById("gitquiet-root")
      return {
        path: location.pathname,
        shown: document.documentElement.getAttribute("data-gitquiet-shown"),
        roots: document.querySelectorAll("#gitquiet-root").length,
        nodes: root === null ? 0 : root.querySelectorAll("*").length,
        words: (root?.textContent ?? "").slice(0, 120)
      }
    })()
  `)

const report = (title: string, moments: ReadonlyArray<Moment>): void => {
  console.log(`\n${title}`)
  for (const moment of moments) {
    console.log(`  ${String(moment.at).padStart(5)}ms  ${moment.what.padEnd(9)} ${moment.said}`)
  }
  const commits = moments.filter((moment) => moment.what === "commit")
  const span = commits.length < 2 ? 0 : (commits.at(-1)?.at ?? 0) - (commits.at(0)?.at ?? 0)
  console.log(`  → ${commits.length} commits across ${span}ms`)
}

const collect = () => session.evaluate<ReadonlyArray<Moment>>("globalThis.__gitquietSeen ?? []")

await sleep(SETTLING)
console.log(`On arrival: ${JSON.stringify(await look())}`)

/** A link of ours to somewhere else of ours, which is what a traversal needs behind it. */
const wentTo = await session.evaluate<string | null>(`
  (() => {
    const root = document.getElementById("gitquiet-root")
    if (root === null) return null
    const away = [...root.querySelectorAll("a[href]")].find((link) => {
      const href = link.getAttribute("href") ?? ""
      return /\\/(commits|files|pull\\/\\d+$)/.test(href) && !href.includes(location.pathname)
    })
    if (away === undefined) return null
    const going = away.getAttribute("href")
    away.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))
    away.click()
    return going
  })()
`)

if (wentTo === null) {
  const state = await look()
  if (String(state["words"] ?? "").includes("signed out")) {
    console.log("Signed out, so there is nothing to measure. See the note at the top of this file.")
    session.stop()
    process.exit(1)
  }
  console.log("Nothing of ours to press. The screen did not draw, or drew nothing linking away.")
  console.log(JSON.stringify(await look(), null, 1))
  await session.screenshot(`${import.meta.dir}/../.output/probe-arrival.png`)
  console.log(session.problems().slice(0, 6).join("\n"))
  session.stop()
  process.exit(1)
}

console.log(`Pressed to ${wentTo}`)
await sleep(SETTLING)
console.log(`After the press: ${JSON.stringify(await look())}`)

// Installed only now, so what it records is the traversal and nothing before it.
await session.evaluate<boolean>(RECORDER)
await session.evaluate<void>("history.back()")
await sleep(SETTLING)
report("Back, onto the pull request", await collect())
console.log(`  now: ${JSON.stringify(await look())}`)

await session.evaluate<boolean>(RECORDER)
await session.evaluate<void>("history.forward()")
await sleep(SETTLING)
report("Forward, away again", await collect())
console.log(`  now: ${JSON.stringify(await look())}`)

const problems = session.problems()
if (problems.length > 0) console.log(`\nErrors on the page:\n  ${problems.slice(0, 6).join("\n  ")}`)

session.stop()
