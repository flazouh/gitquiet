/**
 * Whether a legitimate press survives the repair in `goTo`, on live github.com.
 *
 *     bun run build && bun scripts/probe-back-live.ts
 *
 * The repair exists for an address over a page nobody drew: push, wait, and if
 * no screen has arrived, load the address properly. What this probe measures is
 * the other side of that bargain — a press whose screen is coming, only slowly.
 * Signed out, on a cold profile, with the network held to something like a bad
 * hotel connection, the screen for a big repository's pull request list can
 * still be on its way when the deadline fires. The repair then full-loads a
 * document the reader was about to get for free, and the load throws away every
 * live screen this document was holding for Back.
 *
 * The verdict is `sameDocumentAfterPress`. True is a press answered the way the
 * extension promises to answer it: the address moved, the screen arrived, and
 * the document the reader was on is still the document. False is the repair
 * misfiring on a press that was working.
 *
 * Live and signed out on purpose. Signed-in profiles are warm in every way that
 * matters — GitHub's API answers faster, the service worker has caches — and
 * the misfire only shows where arrival is slow. Each run spends a handful of
 * unauthenticated API requests, which are limited to sixty an hour per address,
 * so runs are not free: keep them to what a question needs.
 */
import { rm } from "node:fs/promises"
import { withExtension } from "./chrome"

const REPO = "https://github.com/microsoft/vscode"
const PULLS = "/microsoft/vscode/pulls"
const EXTENSION = `${import.meta.dir}/../.output/chrome-mv3`

/** Cold means cold: the same profile twice is a service worker already warm. */
const PROFILE = "/tmp/gitquiet-csp-profile"

/**
 * Long enough to see every deadline in the chain speak: the repair's first
 * check at 1.5s, its patience past that, the gate's give-up at 8s.
 */
const WATCHING = 14_000

/** One reading of the document, as the shell's own marks tell the story. */
type Sample = {
  /** Whether the document of the press is still the document. */
  readonly sameDocument: boolean
  readonly path: string
  /** Which screen has the page, off `data-gitquiet-shown`. */
  readonly shown: string | null
  /** Which address that screen has drawn, off `data-gitquiet-at`. */
  readonly at: string | null
  /** Whether a takeover is still on its way. */
  readonly gating: boolean
  /** Whether a screen is standing and visibly still reading. */
  readonly loading: boolean
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const session = await (async () => {
  await rm(PROFILE, { recursive: true, force: true })
  return withExtension(REPO, EXTENSION)
})()

const arrived = await session.evaluate<boolean>(`
  document.querySelector("#gitquiet-root a[href]") !== null
`)
if (!arrived) {
  console.error("The repository screen never stood, so there is nothing to press.")
  session.stop()
  process.exit(1)
}

/*
 * Slowed only now, so the slowness lands on the arrival being measured rather
 * than on the page the press starts from. The numbers are a bad connection and
 * not a broken one: the read finishes, just not inside the first deadline.
 */
await session.tab.send("Network.enable")
await session.tab.send("Network.emulateNetworkConditions", {
  offline: false,
  latency: 800,
  downloadThroughput: 60_000,
  uploadThroughput: 30_000
})
/*
 * And the machine as well as the wire. The screen arriving is a content script
 * with a React tree to build, and on a fast laptop it stands long before the
 * deadline whatever the network does. The misfire this probe reproduces was
 * found on a machine that had neither the cache nor the cycles, so both are
 * taken away.
 */
await session.tab.send("Emulation.setCPUThrottlingRate", { rate: 14 })

/*
 * The token that answers the whole question. It lives on the window of the
 * document the press was made in, so a soft navigation keeps it and a document
 * load — the repair, and only the repair, on this route — destroys it.
 */
await session.evaluate("window.__probeBackLive = true")

const pressed = await session.evaluate<boolean>(`(() => {
  const ours = document.querySelector("#gitquiet-root, #gitquiet-bar")
  const link = [...document.querySelectorAll("#gitquiet-root a, #gitquiet-bar a")]
    .find((a) => a.pathname === ${JSON.stringify(PULLS)})
  if (ours === null || link === undefined) return false

  for (const type of ["pointerdown", "mousedown", "mouseup", "click"]) {
    link.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0 }))
  }
  return true
})()`)
if (!pressed) {
  console.error(`No link to ${PULLS} on the screen, so the press cannot be made.`)
  session.stop()
  process.exit(1)
}

const began = performance.now()
const timeline: Array<{ readonly ms: number; readonly sample: Sample }> = []

while (performance.now() - began < WATCHING) {
  /*
   * Guarded twice, because the moment worth catching is the one that breaks the
   * reading. While `location.replace` is tearing the document down there is a
   * window with no `documentElement` to ask, and an evaluate sent into it either
   * throws in the page or is rejected by the protocol. Both of those are the
   * answer: the document went.
   */
  const sample = await session.evaluate<Sample>(`(() => {
    try {
      return JSON.stringify({
        sameDocument: window.__probeBackLive === true,
        path: location.pathname,
        shown: document.documentElement.getAttribute("data-gitquiet-shown"),
        at: document.documentElement.getAttribute("data-gitquiet-at"),
        gating: document.documentElement.hasAttribute("data-gitquiet-gating"),
        loading: document.querySelector("#gitquiet-root [data-gitquiet-loading]") !== null
      })
    } catch {
      return JSON.stringify({
        sameDocument: false, path: location.pathname,
        shown: null, at: null, gating: false, loading: false
      })
    }
  })()`)
    .then((raw) => JSON.parse(raw as unknown as string) as Sample)
    .catch(() => ({
      sameDocument: false,
      path: "(unreadable while replacing)",
      shown: null,
      at: null,
      gating: false,
      loading: false
    }))

  const last = timeline[timeline.length - 1]
  if (last === undefined || JSON.stringify(last.sample) !== JSON.stringify(sample)) {
    timeline.push({ ms: Math.round(performance.now() - began), sample })
  }
  if (!sample.sameDocument) break
  await sleep(150)
}

for (const { ms, sample } of timeline) {
  console.log(
    `${String(ms).padStart(6)}ms  ${sample.sameDocument ? "same document" : "REPLACED     "}` +
      `  path=${sample.path}  shown=${sample.shown ?? "—"}  at=${sample.at ?? "—"}` +
      `  gating=${sample.gating}  loading=${sample.loading}`
  )
}

const end = timeline[timeline.length - 1]?.sample
const sameDocumentAfterPress =
  end !== undefined && end.sameDocument && end.path === PULLS

console.log(`\nsameDocumentAfterPress: ${sameDocumentAfterPress}`)
if (!sameDocumentAfterPress && end !== undefined && !end.sameDocument) {
  const before = timeline[timeline.length - 2]?.sample
  console.log(
    before === undefined
      ? "The document was replaced before a first reading."
      : `The repair fired while the document read shown=${before.shown ?? "—"} at=${
          before.at ?? "—"
        } gating=${before.gating} loading=${before.loading} — a screen still on its way.`
  )
}

session.stop()
process.exit(sameDocumentAfterPress ? 0 : 1)
