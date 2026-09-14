/**
 * A picture of each thing Following puts on the screen.
 *
 * Not a test — a set of photographs, taken on a live pull request through the
 * built extension, so what is shown is what a reader sees and not a mock of it.
 *
 * The input is Chrome's own, not synthesised in the page. A `new KeyboardEvent`
 * dispatched at a document opens nothing here: the letters are read off a real
 * keydown against whatever has focus, and a made-up one arrives with no focus
 * and no key. The first run of this photographed four identical screens and
 * called them the outline, the peek and two other things.
 *
 *     bun run build && GITQUIET_CDP_PROFILE=... bun scripts/shots-following.ts
 */
import { mkdir, rm } from "node:fs/promises"
import { withExtension } from "./chrome"

const argued = (flag: string): string | undefined => {
  const at = Bun.argv.indexOf(flag)
  return at === -1 ? undefined : Bun.argv[at + 1]
}

const PAGE =
  argued("--page") ??
  "https://github.com/flazouh/gitquiet/pull/74/files#src/ledger/writings.ts:R161"
const WORD = argued("--word") ?? "kindOf"
const WRITTEN = argued("--written") ?? "161"
/**
 * A *use* of the same name, which is where Peek belongs.
 *
 * Peeking the place a name is written has nothing to show — the reader is
 * already looking at it. The first run of this photographed exactly that and
 * called the empty screen a Peek.
 */
const USED = argued("--used") ?? "198"
const EXTENSION = `${import.meta.dir}/../.output/chrome-mv3`
const OUT = `${import.meta.dir}/../.output/shots-following`

/** Chrome's own numbering, which is a bitmask and not a list. */
const META = 4
const SHIFT = 8

await rm(OUT, { recursive: true, force: true })
await mkdir(OUT, { recursive: true })

const session = await withExtension(PAGE, EXTENSION)
const sleep = (ms: number) => new Promise((go) => setTimeout(go, ms))

const shot = async (name: string) => {
  const picture = await session.tab.send<{ data: string }>("Page.captureScreenshot", {
    format: "png"
  })
  await Bun.write(`${OUT}/${name}.png`, Buffer.from(picture.data, "base64"))
  console.log(`  ${name}`)
}

const key = async (
  what: { readonly key: string; readonly code: string; readonly text?: string },
  modifiers = 0
) => {
  for (const type of ["keyDown", "keyUp"] as const) {
    await session.tab.send("Input.dispatchKeyEvent", {
      type: type === "keyDown" && what.text !== undefined ? "keyDown" : type,
      key: what.key,
      code: what.code,
      modifiers,
      ...(type === "keyDown" && what.text !== undefined ? { text: what.text } : {})
    })
  }
}

const mouse = async (type: string, x: number, y: number, modifiers: number) =>
  session.tab.send("Input.dispatchMouseEvent", {
    type,
    x,
    y,
    modifiers,
    button: type === "mouseMoved" ? "none" : "left",
    clickCount: type === "mouseMoved" ? 0 : 1
  })

/** Where the name is on the screen, with the row scrolled to the middle first. */
const spot = await session.evaluate<{ x: number; y: number } | null>(`(async () => {
  const sleep = (ms) => new Promise((go) => setTimeout(go, ms))

  const pane = async () => {
    for (let tries = 0; tries < 80; tries++) {
      for (const one of document.querySelectorAll("diffs-container")) {
        const root = one.shadowRoot
        if (!root) continue
        const row = root.querySelector('[data-line="' + ${JSON.stringify(WRITTEN)} + '"]')
        if (row && [...root.querySelectorAll("[data-line] span")].some((s) => (s.textContent || "").trim() === ${JSON.stringify(WORD)})) return root
      }
      await sleep(250)
    }
    return null
  }

  const shadow = await pane()
  if (!shadow) return null

  // Long enough that the grammar and the file have both arrived, which is what
  // a reader moving a pointer takes anyway.
  await sleep(2500)

  const token = [...shadow.querySelectorAll("[data-line] span")].find((one) => (one.textContent || "").trim() === ${JSON.stringify(WORD)})
  if (!token) return null
  token.scrollIntoView({ block: "center", behavior: "instant" })
  await sleep(400)

  const at = token.getBoundingClientRect()
  return { x: Math.round(at.left + at.width / 2), y: Math.round(at.top + at.height / 2) }
})()`)

if (spot === null) {
  console.log("the name was never drawn")
  session.stop()
  process.exit(1)
}

console.log(`the name is at ${spot.x},${spot.y}`)

// 1. The key held over a name, which underlines it and does nothing else.
await session.tab.send("Input.dispatchKeyEvent", {
  type: "rawKeyDown",
  key: "Meta",
  code: "MetaLeft",
  modifiers: META
})
await mouse("mouseMoved", spot.x, spot.y, META)
await sleep(1500)
await shot("1-underline")

// 2. The press, which on a Writing opens its uses rather than moving anybody.
await mouse("mousePressed", spot.x, spot.y, META)
await mouse("mouseReleased", spot.x, spot.y, META)
await sleep(1500)
await shot("2-uses-in-this-file")

// 3. The same card once the whole repository has been read, which arrives late.
await sleep(9000)
await shot("3-uses-elsewhere")

// 4. The press with Shift on a use, which Peeks: the Writing drawn under it.
await key({ key: "Escape", code: "Escape" })
await sleep(800)

const used = await session.evaluate<{ x: number; y: number } | null>(`(async () => {
  const sleep = (ms) => new Promise((go) => setTimeout(go, ms))
  for (const one of document.querySelectorAll("diffs-container")) {
    const root = one.shadowRoot
    if (!root) continue
    const row = root.querySelector('[data-line="' + ${JSON.stringify(USED)} + '"]')
    if (!row) continue
    const token = [...row.querySelectorAll("span")].find((s) => (s.textContent || "").trim() === ${JSON.stringify(WORD)})
    if (!token) continue
    token.scrollIntoView({ block: "center", behavior: "instant" })
    await sleep(400)
    const at = token.getBoundingClientRect()
    return { x: Math.round(at.left + at.width / 2), y: Math.round(at.top + at.height / 2) }
  }
  return null
})()`)

if (used === null) {
  console.log("  4-peek skipped: no use of the name was drawn")
} else {
  await mouse("mouseMoved", used.x, used.y, META | SHIFT)
  await sleep(600)
  await mouse("mousePressed", used.x, used.y, META | SHIFT)
  await mouse("mouseReleased", used.x, used.y, META | SHIFT)
  await sleep(2000)
  await shot("4-peek")
}

// 5. and 6. The letters, with the key let go of first.
await session.tab.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Meta", code: "MetaLeft" })
await key({ key: "Escape", code: "Escape" })
await sleep(600)
await key({ key: "o", code: "KeyO", text: "o" })
await sleep(1500)
await shot("5-outline")

await key({ key: "Escape", code: "Escape" })
await sleep(600)
await key({ key: "t", code: "KeyT", text: "t" })
await sleep(1500)
await shot("6-go-to-file")

await key({ key: "Escape", code: "Escape" })
await sleep(600)
await mouse("mouseMoved", spot.x, spot.y, META)
await sleep(300)
await key({ key: "u", code: "KeyU", text: "u" }, META)
await sleep(1500)
await shot("7-uses-by-key")

console.log("problems:", JSON.stringify(session.problems().map((p) => p.split("\n")[0].slice(0, 120))))
session.stop()
