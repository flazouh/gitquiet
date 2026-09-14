/**
 * Following, done the way a reader does it, and filmed.
 *
 *     bun run build && bun scripts/qa-following.ts
 *
 * Two faults were reported from real use and neither could have been found by a
 * message: holding Command underlined a name only after a wait, and pressing one
 * did nothing at all. Both are about what happens between a hand and a screen,
 * so this is a hand and a screen — pointer events on a real page, timed, with
 * every frame recorded.
 *
 * Writes `.output/qa/following.mp4` and the frames beside it.
 */
import { mkdir, rm } from "node:fs/promises"
import { withExtension } from "./chrome"

/**
 * Where the checking happens, and why it is a commit rather than a pull request.
 *
 * A pull request is the case this feature exists for, and it is the one case
 * this cannot reach — but not because GitHub hides one. A public pull request
 * is served to anybody who asks; what cannot be done signed out is *ours*. The
 * gateway reads their internal `/_graphql` with the session cookie and a nonce
 * minted per page, so a visit with no session reaches its sign-in card and no
 * diff is ever drawn. An `gh` OAuth token does not help: that route does not
 * take one, and anonymous GraphQL is rate limited to zero.
 *
 * A commit is the same diff pane, the same renderer, the same token events and
 * the same lazily-fetched file — drawn from a payload that answers to nobody.
 *
 * `--page` takes any address, so a reader with a session can point this at a
 * real pull request:
 *
 *     bun scripts/qa-following.ts --page https://github.com/owner/repo/pull/1/files
 */
const argued = (flag: string): string | undefined => {
  const at = Bun.argv.indexOf(flag)
  return at === -1 ? undefined : Bun.argv[at + 1]
}

const PAGE =
  argued("--page") ??
  "https://github.com/sindresorhus/p-limit/blob/main/index.js"

/** The name to hold the key over, and the one to press. */
const HOLD = argued("--hold") ?? "pLimit"
const PRESS = argued("--press") ?? "validateConcurrency"
/** The line that name is written on, for checking the press arrived. */
const WRITTEN = Number(argued("--written") ?? 128)
/**
 * How long to let the screen stand before reaching for the key.
 *
 * The pane opens the Ledger's door as soon as it draws — a worker to wake, a
 * document to open, a runtime to compile, a megabyte and a half of grammar —
 * none of which is a question about a name and none of which should wait for
 * one. A probe that holds the key the instant a row appears is a reader faster
 * than any reader, and measures the door rather than the answer. Zero keeps
 * that measurement; a second or two is what a hand actually takes.
 */
const SETTLE = Number(argued("--settle") ?? 0)
const EXTENSION = `${import.meta.dir}/../.output/chrome-mv3`
const OUT = `${import.meta.dir}/../.output/qa`

const sleep = (ms: number) => new Promise((go) => setTimeout(go, ms))

await rm(`${OUT}/frames`, { recursive: true, force: true })
await mkdir(`${OUT}/frames`, { recursive: true })

const session = await withExtension(PAGE, EXTENSION)

/**
 * The film: a frame every hundred milliseconds for as long as this is running.
 *
 * A screenshot in a loop rather than `Page.startScreencast`, which answered with
 * no frames at all here. Ten a second is enough to watch a wait and cheap enough
 * not to become one.
 */
let frames = 0
let filming = true

const film = async (): Promise<void> => {
  while (filming) {
    const shot = await session.tab
      .send<{ data: string }>("Page.captureScreenshot", { format: "png" })
      .catch(() => null)
    if (shot !== null) {
      frames += 1
      await Bun.write(
        `${OUT}/frames/${String(frames).padStart(5, "0")}.png`,
        Buffer.from(shot.data, "base64")
      )
    }
    await sleep(100)
  }
}

try {
  for (let tries = 0; tries < 30; tries++) {
    const ready = await session.evaluate<boolean>(`
      (() => {
        const host = document.querySelector("diffs-container")
        return !!(host && host.shadowRoot && host.shadowRoot.querySelector("[data-line] span"))
      })()
    `)
    if (ready) break
    await sleep(1000)
  }

  const rolling = film()
  await sleep(700)

  /*
   * Hold the key over a name, and time the underline.
   *
   * The reported fault is a wait, so what is measured is how long a reader
   * looks at a word that has not underlined yet.
   */
  const held = await session.evaluate<{
    word: string | null
    underlineMs: number | null
    decoration: string | null
  }>(`
    (async () => {
      /*
       * Found again here rather than trusted from a check a moment ago.
       *
       * The pane redraws — a file arriving, a knob moving — and the element
       * this held a moment ago is not the one on the screen now. Trusting the
       * earlier check crashed the run rather than reporting anything.
       */
      const waitForPane = async () => {
        for (let tries = 0; tries < 40; tries++) {
          for (const one of document.querySelectorAll("diffs-container")) {
            const root = one.shadowRoot
            if (!root) continue
            // The pane holding the file this name is written in, rather than
            // whichever container is first. A commit draws one per file, they
            // are alike from outside, and the path is nowhere near them — so
            // every run of this measured a declaration file while reporting a
            // line number from another, and called the feature broken.
            const row = root.querySelector('[data-line="' + ${WRITTEN} + '"]')
            if (row && [...root.querySelectorAll("[data-line] span")].some((s) => (s.textContent || "").trim() === ${JSON.stringify(HOLD)})) {
              return root
            }
          }
          await new Promise((go) => setTimeout(go, 250))
        }
        return null
      }
      const shadow = await waitForPane()
      if (!shadow) return { word: null, underlineMs: null, decoration: null }
      await new Promise((go) => setTimeout(go, ${SETTLE}))
      const spans = [...shadow.querySelectorAll("[data-line] span")]
      const token = spans.find((one) => (one.textContent || "").trim() === ${JSON.stringify(HOLD)})
      if (!token) return { word: null, underlineMs: null, decoration: null }

      const at = token.getBoundingClientRect()
      const where = {
        bubbles: true, composed: true, cancelable: true,
        clientX: at.left + at.width / 2, clientY: at.top + at.height / 2,
        metaKey: true, pointerId: 1, isPrimary: true, pointerType: "mouse"
      }

      const started = performance.now()
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Meta", bubbles: true }))
      token.dispatchEvent(new PointerEvent("pointerover", where))
      token.dispatchEvent(new PointerEvent("pointermove", where))

      for (let waited = 0; waited < 14000; waited += 50) {
        if ((token.style.textDecoration || "") !== "") {
          return {
            word: token.textContent,
            underlineMs: Math.round(performance.now() - started),
            decoration: token.style.textDecoration
          }
        }
        await new Promise((go) => setTimeout(go, 50))
      }
      return { word: token.textContent, underlineMs: null, decoration: null }
    })()
  `)

  await sleep(900)

  /*
   * The same act again, on a different name.
   *
   * The first hold pays for whatever was not ready. The second is what holding
   * the key costs once a reader is reading, which is the number that decides
   * whether this feels like an underline or like a wait.
   */
  const again = await session.evaluate<{ word: string | null; underlineMs: number | null }>(`
    (async () => {
      /*
       * Found again here rather than trusted from a check a moment ago.
       *
       * The pane redraws — a file arriving, a knob moving — and the element
       * this held a moment ago is not the one on the screen now. Trusting the
       * earlier check crashed the run rather than reporting anything.
       */
      const waitForPane = async () => {
        for (let tries = 0; tries < 40; tries++) {
          for (const one of document.querySelectorAll("diffs-container")) {
            const root = one.shadowRoot
            if (!root) continue
            // The pane holding the file this name is written in, rather than
            // whichever container is first. A commit draws one per file, they
            // are alike from outside, and the path is nowhere near them — so
            // every run of this measured a declaration file while reporting a
            // line number from another, and called the feature broken.
            const row = root.querySelector('[data-line="' + ${WRITTEN} + '"]')
            if (row && [...root.querySelectorAll("[data-line] span")].some((s) => (s.textContent || "").trim() === ${JSON.stringify(HOLD)})) {
              return root
            }
          }
          await new Promise((go) => setTimeout(go, 250))
        }
        return null
      }
      const shadow = await waitForPane()
      if (!shadow) return { word: null, underlineMs: null, decoration: null }
      const spans = [...shadow.querySelectorAll("[data-line] span")]
      const token = spans.find((one) => (one.textContent || "").trim() === ${JSON.stringify(HOLD)})
      if (!token) return { word: null, underlineMs: null }

      const at = token.getBoundingClientRect()
      const where = {
        bubbles: true, composed: true, cancelable: true,
        clientX: at.left + at.width / 2, clientY: at.top + at.height / 2,
        metaKey: true, pointerId: 1, isPrimary: true, pointerType: "mouse"
      }
      const started = performance.now()
      token.dispatchEvent(new PointerEvent("pointerover", where))
      token.dispatchEvent(new PointerEvent("pointermove", where))

      for (let waited = 0; waited < 6000; waited += 25) {
        if ((token.style.textDecoration || "") !== "") {
          return { word: token.textContent, underlineMs: Math.round(performance.now() - started) }
        }
        await new Promise((go) => setTimeout(go, 25))
      }
      return { word: token.textContent, underlineMs: null }
    })()
  `)

  await sleep(900)

  /*
   * Then press it, and see whether anything moved.
   *
   * `pLimit` is used further down the file than it is written, so following it
   * scrolls — and a scroll is the thing the reported fault says never happened.
   */
  const pressed = await session.evaluate<{
    word: string | null
    from: number
    to: number
    moved: boolean
    definitionInView: boolean
    stillUnderlined?: boolean
    listOpened?: boolean
    definitionIsInDom?: boolean
    scrollerHeight?: number
    scrollerVisible?: number
    scrollerTag?: string
  }>(`
    (async () => {
      /*
       * Found again here rather than trusted from a check a moment ago.
       *
       * The pane redraws — a file arriving, a knob moving — and the element
       * this held a moment ago is not the one on the screen now. Trusting the
       * earlier check crashed the run rather than reporting anything.
       */
      const waitForPane = async () => {
        for (let tries = 0; tries < 40; tries++) {
          for (const one of document.querySelectorAll("diffs-container")) {
            const root = one.shadowRoot
            if (!root) continue
            // The pane holding the file this name is written in, rather than
            // whichever container is first. A commit draws one per file, they
            // are alike from outside, and the path is nowhere near them — so
            // every run of this measured a declaration file while reporting a
            // line number from another, and called the feature broken.
            const row = root.querySelector('[data-line="' + ${WRITTEN} + '"]')
            if (row && [...root.querySelectorAll("[data-line] span")].some((s) => (s.textContent || "").trim() === ${JSON.stringify(HOLD)})) {
              return root
            }
          }
          await new Promise((go) => setTimeout(go, 250))
        }
        return null
      }
      const shadow = await waitForPane()
      if (!shadow) return { word: null, underlineMs: null, decoration: null }
      const spans = [...shadow.querySelectorAll("[data-line] span")]
      // A use of the name rather than where it is written: a press on a use is
      // the one that goes somewhere.
      // A name written far below where it is used, so a Follow has somewhere to
      // go and a reader watching the film can see it arrive.
      const token = spans.find((one) => (one.textContent || "").trim() === ${JSON.stringify(PRESS)})
      if (!token) return { word: null, from: 0, to: 0, moved: false, definitionInView: false }

      /*
       * The pane's own scroller, not the window's.
       *
       * scrollIntoView scrolls whatever box the row is inside, and the file is
       * inside one. Measured on the window, a scroll that happened perfectly
       * reads as nothing having happened — which is what the first run of this
       * reported.
       */
      const scroller = (() => {
        let up = token.parentElement
        while (up) {
          if (up.scrollHeight > up.clientHeight + 40) return up
          up = up.parentElement
        }
        return document.scrollingElement
      })()

      /*
       * The page's own scroller, which is what a Follow moves.
       *
       * The name is used near the top and written near the bottom, so a press
       * has two thousand pixels to travel and a reader can see whether it
       * arrived. An earlier version pressed a name written near the top with
       * the page already there, and measured a working press as nothing
       * happening.
       */
      const from = scroller.scrollTop

      // Measured after the scroll, because the word has moved.
      const at = token.getBoundingClientRect()
      const where = {
        bubbles: true, composed: true, cancelable: true,
        clientX: at.left + at.width / 2, clientY: at.top + at.height / 2,
        metaKey: true, button: 0, buttons: 1, pointerId: 1, isPrimary: true, pointerType: "mouse"
      }

      token.dispatchEvent(new PointerEvent("pointerover", where))
      token.dispatchEvent(new PointerEvent("pointermove", where))
      await new Promise((go) => setTimeout(go, 900))
      token.dispatchEvent(new PointerEvent("pointerdown", where))
      token.dispatchEvent(new PointerEvent("pointerup", where))
      token.dispatchEvent(new MouseEvent("click", where))

      await new Promise((go) => setTimeout(go, 1800))

      // Where the pressed name is written.
      const definition = shadow.querySelector('[data-line="' + ${WRITTEN} + '"]')
      const box = definition && definition.getBoundingClientRect()
      return {
        word: token.textContent,
        from,
        to: scroller.scrollTop,
        moved: Math.abs(scroller.scrollTop - from) > 20,
        definitionInView: !!(box && box.top > -10 && box.bottom < window.innerHeight + 10),
        /*
         * Whether the press was received at all, which is a different question
         * from whether anything moved.
         *
         * A press clears the underline it was made on and either scrolls or
         * opens the list. Without asking, "the pane did not move" covers both a
         * press that did nothing and a press whose answer was already on screen.
         */
        stillUnderlined: (token.style.textDecoration || "") !== "",
        listOpened: document.querySelector("dialog[open]") !== null,
        definitionIsInDom: definition !== null,
        scrollerHeight: scroller.scrollHeight,
        scrollerVisible: scroller.clientHeight,
        scrollerTag: scroller.tagName + "." + (scroller.className || "").slice(0, 24)
      }
    })()
  `)

  await sleep(1500)
  filming = false
  await rolling

  console.log(
    JSON.stringify({ held, again, pressed, frames, problems: session.problems().slice(0, 4) }, null, 2)
  )
} finally {
  session.stop()
}
