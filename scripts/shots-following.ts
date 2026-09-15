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
 * A line the same name is *used* on, which is a different picture.
 *
 * Shift on the place a name is written has nothing to show — the reader is
 * already looking at it. A Peek is a Writing drawn under a use of it, so the
 * photograph has to be taken from a use.
 */
const USED = argued("--used") ?? "198"
/**
 * The name to Peek, where it is not the same one the card was opened for.
 *
 * On a commit the hunk is a dozen lines and the name written in it is often
 * used nowhere else inside them, so the Peek is taken from a different name
 * that *is* a use — the call that hunk happens to contain.
 */
const PEEK_WORD = argued("--peek-word") ?? WORD
/**
 * The file to open before anything is photographed.
 *
 * The pane draws one file at a time, and which one is whatever the list has
 * selected — on a commit, the first. Every picture taken before this existed
 * was a picture of `index.d.ts` while the gesture was being made against
 * `index.js` in a container the reader could not see. On a pull request the
 * address does this; on a commit there is nothing to address, so the row is
 * pressed the way a reader presses it.
 */
const OPEN = argued("--open")
const EXTENSION = `${import.meta.dir}/../.output/chrome-mv3`
const OUT = `${import.meta.dir}/../.output/shots-following`

/**
 * Puts an element on the screen, whatever is actually doing the scrolling.
 *
 * Three things had to be true at once and none of them was obvious. Every file
 * of a commit is drawn at once and stacked, so the file being photographed is
 * usually below the fold. `scrollIntoView` inside a shadow root moves the rows
 * within their own box. And the document does not scroll here at all — an
 * element inside it does — so `window.scrollBy` moves nothing. The first eight
 * pictures taken were all of the file above the one the gesture was made
 * against, which is a QA harness reporting on a screen nobody was looking at.
 *
 * So: walk up from the element, out through every shadow root, collecting
 * whatever can scroll, and move each one until the element is in the middle of
 * it. Outermost last, because moving a parent moves the child.
 */
const ON_SCREEN = `
  const putOnScreen = async (el) => {
    const sleep = (ms) => new Promise((go) => setTimeout(go, ms))
    // The browser's own, repeatedly, rather than arithmetic on scrollTop.
    // Which box actually scrolls differs by screen — the document on a file
    // page, an element inside it on a commit — and a shadow root sits between
    // the row and all of them. scrollIntoView knows all of that; the arithmetic
    // did not, and answered with a coordinate 2,720 pixels below a window 813
    // tall, which is a mouse press sent into nothing.
    for (let tries = 0; tries < 6; tries++) {
      el.scrollIntoView({ block: "center", behavior: "instant" })
      await sleep(250)
      const seen = el.getBoundingClientRect()
      if (seen.top > 80 && seen.bottom < window.innerHeight - 80) return true
    }
    return false
  }
`


/**
 * The token on a line, taken from the half of the file that has it.
 *
 * A diff numbers both halves, so a line number matches twice: the line as it
 * was and the line as it is. `querySelector` answers with the first, which is
 * the deletion — and a name added by the change is not in the code it replaced.
 * The commit that photographs this has `const limitedFunction` on the new line
 * 120 and `return (...arguments_)` on the old one, and the probe read the old
 * one and reported that the name was never drawn.
 */
const TOKEN_IN = `
  const tokenIn = (root, line, word) => {
    for (const row of root.querySelectorAll('[data-line="' + line + '"]')) {
      const token = [...row.querySelectorAll("span")].find(
        (one) => (one.textContent || "").trim() === word
      )
      if (token) return token
    }
    return null
  }
`

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

/**
 * The file the pictures are of, reached the way a reader reaches it.
 *
 * `s` is Next, which is how somebody reads a commit: the screen draws one file
 * at a time and the key moves to the following one. Pressed until the line this
 * probe photographs is on the screen — see the note in the block itself for why
 * the name of the file is the wrong thing to look for.
 */
if (OPEN !== undefined) {
  /*
   * Shown, rather than named.
   *
   * The check used to read the text around the drawing and look for the file's
   * name in it, which the list on the left has for every file whether it is
   * drawn or not — so it answered "no" for eight presses and gave up, and the
   * heading it printed was of a file nobody asked for. What is actually wanted
   * is narrower and exact: the line this probe photographs, with the word on
   * it, inside a container that is on the screen.
   *
   * It matters more here than it looks. A press is sent at a coordinate, and a
   * token in a file the screen is not showing has a coordinate like any other —
   * so the whole gesture was made against empty space, underlined nothing, and
   * read as a feature that does not work in a diff.
   */
  const drawnHere = () =>
    session.evaluate<boolean>(`(() => {
      for (const one of document.querySelectorAll("diffs-container")) {
        const root = one.shadowRoot
        if (!root) continue
        const box = one.getBoundingClientRect()
        if (box.height <= 0 || box.width <= 0 || box.bottom < 0 || box.top > window.innerHeight) continue
        for (const row of root.querySelectorAll('[data-line="' + ${JSON.stringify(WRITTEN)} + '"]')) {
          const has = [...row.querySelectorAll("span")].some(
            (one) => (one.textContent || "").trim() === ${JSON.stringify(WORD)}
          )
          if (has) return true
        }
      }
      return false
    })()`)

  let opened = await drawnHere()
  for (let tries = 0; tries < 12 && !opened; tries++) {
    // `s` is Next, which is how somebody reads a commit — and it is the only
    // way that works from out here. Pressing the row in the list did not: the
    // tree is nested and `querySelectorAll` answers in document order, so the
    // first thing whose text began "index.js" was a wrapper with no handler on
    // it, clicked happily, selecting nothing.
    await key({ key: "s", code: "KeyS", text: "s" })
    await sleep(1200)
    opened = await drawnHere()
  }
  await sleep(800)
  await shot("0-opened")
  console.log(`opened ${OPEN}: ${opened}`)
}

/** Where the name is on the screen, with the row scrolled to the middle first. */
const spot = await session.evaluate<{ x: number; y: number } | null>(`(async () => {
  const sleep = (ms) => new Promise((go) => setTimeout(go, ms))
  ${ON_SCREEN}
  ${TOKEN_IN}

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

  // The one on the line that was asked for, not the first one in the file.
  // A name is usually used before it is written, so "the first span with this
  // text" is a use — and a press on a use goes somewhere, which is a different
  // picture from the one being taken here.
  const token = tokenIn(shadow, ${JSON.stringify(WRITTEN)}, ${JSON.stringify(WORD)})
  if (!token) return null
  await putOnScreen(token)
  window.__gqToken = token
  const at = token.getBoundingClientRect()
  return { x: Math.round(at.left + at.width / 2), y: Math.round(at.top + at.height / 2) }
})()`)

if (spot === null) {
  console.log("the name was never drawn")
  session.stop()
  process.exit(1)
}

console.log(`the name is at ${spot.x},${spot.y}`)


/** The same lookup, for any line the name appears on. */
const spotFor = (line: string) =>
  session.evaluate<{ x: number; y: number } | null>(`(async () => {
    const sleep = (ms) => new Promise((go) => setTimeout(go, ms))
    ${ON_SCREEN}
    ${TOKEN_IN}
    for (const one of document.querySelectorAll("diffs-container")) {
      const root = one.shadowRoot
      if (!root) continue
      const token = tokenIn(root, ${JSON.stringify(line)}, ${JSON.stringify(PEEK_WORD)})
      if (!token) continue
      await putOnScreen(token)
      const at = token.getBoundingClientRect()
      return { x: Math.round(at.left + at.width / 2), y: Math.round(at.top + at.height / 2) }
    }
    return null
  })()`)

// 1. The key held over a name, which underlines it and does nothing else.
await session.tab.send("Input.dispatchKeyEvent", {
  type: "rawKeyDown",
  key: "Meta",
  code: "MetaLeft",
  modifiers: META
})
await mouse("mouseMoved", spot.x, spot.y, META)

/*
 * Waited for rather than slept through.
 *
 * The first question of a visit is the slowest — a worker to wake, a document
 * to open, a grammar to arrive — and on a large repository it has taken over
 * two seconds. A fixed second and a half photographed a name that had not
 * underlined yet and then pressed it, which asks a Ledger that cannot answer
 * yet and gets the correct answer of nothing. The picture was of a working
 * feature doing nothing, which is the worst kind of picture to publish.
 */
const underlinedIn = await session.evaluate<number | null>(`(async () => {
  const sleep = (ms) => new Promise((go) => setTimeout(go, ms))
  const token = window.__gqToken
  if (!token) return null
  const started = performance.now()
  for (let waited = 0; waited < 20000; waited += 50) {
    if ((token.style.textDecoration || "") !== "") return Math.round(performance.now() - started)
    await sleep(50)
  }
  return null
})()`)
console.log(`  underlined after ${underlinedIn}ms`)
await sleep(400)
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
  ${TOKEN_IN}
  for (const one of document.querySelectorAll("diffs-container")) {
    const root = one.shadowRoot
    if (!root) continue
    const token = tokenIn(root, ${JSON.stringify(USED)}, ${JSON.stringify(WORD)})
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
  // Shift and a press is also how a browser extends a text selection, so the
  // first picture of this came back as half the file in blue with the Peek
  // somewhere underneath. The selection is the browser's own; it is cleared for
  // the photograph rather than pretended away.
  const peeking = await session.evaluate<unknown>(`(() => {
    window.getSelection()?.removeAllRanges()
    const rows = [...document.querySelectorAll("div")].filter((one) => (one.textContent || "").includes("line "))
    return rows.length
  })()`)
  console.log("  selection cleared,", peeking, "candidate rows")
  await sleep(400)
  await shot("4-peek")
}

/*
 * 5. The uses, reached by the letter rather than by the press.
 *
 * `u` is the one of the three letters that belongs to a diff: the outline and
 * Go to File are bound on the file page and nowhere else, and photographing
 * them here produced four identical pictures of a diff with nothing in it.
 */
await session.tab.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Meta", code: "MetaLeft" })
await key({ key: "Escape", code: "Escape" })
await sleep(800)
// Found again rather than reused: the Peek added a row to the file, so every
// line below it has moved, and the coordinate from before the Peek now points
// at whatever slid into its place.
const again = (await spotFor(WRITTEN)) ?? spot
await mouse("mouseMoved", again.x, again.y, 0)
await sleep(600)
await key({ key: "u", code: "KeyU", text: "u" })
await sleep(1800)
await shot("5-uses-by-key")

/*
 * 6. A step along the trail.
 *
 * The preview is a drawing of its own, so a name inside it is followable: the
 * panel pushes a step and the head names the way back. Found in the last
 * container on the page, which is the preview — the file's own came first.
 */
const stepped = await session.evaluate<string | false>(`(async () => {
  const sleep = (ms) => new Promise((go) => setTimeout(go, ms))
  const all = [...document.querySelectorAll("diffs-container")]
  const preview = all[all.length - 1]
  const root = preview && preview.shadowRoot
  if (!root) return false
  const token = [...root.querySelectorAll("[data-line] span")].find((one) => (one.textContent || "").trim() === ${JSON.stringify(argued("--step") ?? "limitedFunction")})
  if (!token) return false

  /*
   * Dispatched on the token rather than sent as a mouse event at a coordinate.
   *
   * A CDP press hit-tests for real, and through a shadow root inside a drawing
   * inside a row inside another drawing it finds something other than the token
   * whose middle the coordinate is. Noted in the header of this file; this is
   * the second place it bites.
   */
  const at = token.getBoundingClientRect()
  const where = {
    bubbles: true, composed: true, cancelable: true,
    clientX: at.left + at.width / 2, clientY: at.top + at.height / 2,
    metaKey: true, pointerId: 1, isPrimary: true, pointerType: "mouse"
  }
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Meta", bubbles: true }))
  token.dispatchEvent(new PointerEvent("pointerover", where))
  token.dispatchEvent(new PointerEvent("pointermove", where))
  await sleep(700)
  token.dispatchEvent(new PointerEvent("pointerdown", where))
  token.dispatchEvent(new PointerEvent("pointerup", where))
  token.dispatchEvent(new MouseEvent("click", where))
  await sleep(1500)
  const panel = document.querySelector("[aria-label^='Uses of']")
  return JSON.stringify({
    tokens: root.querySelectorAll("[data-line] span").length,
    head: (panel ? panel.querySelector("h2") : null)?.textContent ?? null,
    containers: all.length
  })
})()`)

if (stepped === false) {
  console.log("  6-trail skipped: no name to follow in the preview")
} else {
  console.log("  after the step:", stepped)
  await sleep(1200)
  await shot("6-trail")
}

console.log("problems:", JSON.stringify(session.problems().map((p) => (p.split("\n")[0] ?? "").slice(0, 120))))
session.stop()
