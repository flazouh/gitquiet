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
 * The verdict is `sameDocumentAfterPress`, and it has three outcomes rather
 * than two. True, exit 0, is a press answered the way the extension promises to
 * answer it: the address moved, the screen arrived, and the document the reader
 * was on is still the document. False with the landing address the one that was
 * pushed, exit 1, is the repair misfiring on a press that was working, which is
 * the fault this exists to catch. False anywhere else, exit 2, is GitHub moving
 * the session themselves and a run that measured nothing.
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

await rm(PROFILE, { recursive: true, force: true })
const session = await withExtension(REPO, EXTENSION)

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

/*
 * Guarded twice, because the moment worth catching is the one that breaks the
 * reading. While `location.replace` is tearing the document down there is a
 * window with no `documentElement` to ask, and an evaluate sent into it either
 * throws in the page or is rejected by the protocol. Both of those are the
 * answer: the document went.
 */
const readTheDocument = (): Promise<Sample> =>
  session
    .evaluate<Sample>(`(() => {
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

while (performance.now() - began < WATCHING) {
  const sample = await readTheDocument()

  const last = timeline[timeline.length - 1]
  if (last === undefined || JSON.stringify(last.sample) !== JSON.stringify(sample)) {
    timeline.push({ ms: Math.round(performance.now() - began), sample })
  }
  if (!sample.sameDocument) break
  await sleep(150)
}

/*
 * Where the replacement landed, asked once the new document has settled.
 *
 * The reading that catches a replacement is frequently taken mid-teardown, and
 * a window with no `documentElement` answers a sentinel rather than an address —
 * so the landing address, which is the whole of the classification below, is
 * exactly the thing the breaking reading cannot say.
 */
const landing = timeline[timeline.length - 1]?.sample.sameDocument === false
  ? await (async () => {
      await sleep(1_500)
      return readTheDocument()
    })()
  : undefined
if (landing !== undefined) {
  timeline.push({ ms: Math.round(performance.now() - began), sample: landing })
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

/*
 * Which of the two replacements this was, which the verdict above cannot tell
 * on its own and used to guess wrongly.
 *
 * The repair navigates to one address and one only: the address the press
 * pushed. Anything else is GitHub moving the session themselves, and on an
 * anonymous cold visit that is the sign-in wall — measured landing on `/login`
 * eleven seconds after a press that had already been answered. Read as the
 * repair firing, it accused this extension of a reload it had not made, over a
 * press the timeline above shows working.
 */
if (!sameDocumentAfterPress && end !== undefined && !end.sameDocument) {
  const before = timeline.findLast((one) => one.sample.sameDocument)?.sample

  if (end.path === PULLS) {
    console.log(
      before === undefined
        ? "The repair fired before a first reading."
        : `The repair fired while the document read shown=${before.shown ?? "—"} at=${
            before.at ?? "—"
          } gating=${before.gating} loading=${before.loading} — a screen still on its way.`
    )
  } else {
    // The press itself, which is answered or not before anybody navigates away.
    const answered = timeline.some(
      (one) => one.sample.sameDocument && one.sample.at === PULLS
    )
    console.log(
      `Inconclusive: GitHub moved this session to ${end.path}, which the repair never navigates to.\n` +
        (answered
          ? `The press itself was answered — the screen claimed ${PULLS} before the move.`
          : "The press had not been answered when the move happened, so nothing here is measured.")
    )
  }
}

session.stop()
/*
 * Two failing exits rather than one. A repair that misfired is the fault this
 * probe exists for; a session GitHub signed out from is a run that measured
 * nothing, and a caller that cannot tell them apart learns to ignore both.
 */
process.exit(
  sameDocumentAfterPress ? 0 : end !== undefined && end.path !== PULLS ? 2 : 1
)
