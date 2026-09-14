/**
 * Whether a reader pointing at a name sees anything.
 *
 * Every live check so far has been a message: `chrome.runtime.sendMessage`, an
 * answer, a comparison. That proves the Ledger and proves nothing about the
 * thing a reader actually does — hold a key, move a pointer, see an underline.
 * The renderer's token events, the mark on the element, the card beside it: none
 * of it has ever been exercised by a pointer on a real page.
 *
 *     bun run build && bun scripts/probe-pointer.ts
 *
 * Signed out, on a public repository's own file, which is a page GitHub serves
 * to anybody and this extension draws.
 */
import { withExtension } from "./chrome"

const PAGE = "https://github.com/sindresorhus/p-limit/blob/main/index.js"
const EXTENSION = `${import.meta.dir}/../.output/chrome-mv3`

const session = await withExtension(PAGE, EXTENSION)

const sleep = (ms: number) => new Promise((go) => setTimeout(go, ms))

try {
  /*
   * Waited for rather than guessed at.
   *
   * The pane draws when the file lands, which is a request whose timing is
   * GitHub's — and a probe that slept six seconds and asked once reported an
   * empty screen as a broken feature. Twice.
   */
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

  const drawn = await session.evaluate<{
    root: boolean
    container: boolean
    tokens: number
    lines: number
  }>(`
    (() => {
      const root = document.querySelector("#gitquiet-root")
      const host = document.querySelector("diffs-container")
      const shadow = host && host.shadowRoot
      return {
        root: root !== null,
        container: host !== null,
        tokens: shadow ? shadow.querySelectorAll("[data-line] span").length : 0,
        lines: shadow ? shadow.querySelectorAll("[data-line]").length : 0
      }
    })()
  `)

  /*
   * A name to point at, and the pointer events the renderer listens for.
   *
   * Its own interaction manager binds these per token, so what is dispatched
   * has to be what it binds: pointer events that bubble and compose, on the
   * element itself.
   */
  /*
   * A name to point at, and the pointer events the renderer listens for.
   *
   * Several names, not one. The first version of this took the first word of
   * four letters or more and pointed at `import` — a keyword, which correctly
   * has no Writing and correctly underlines nothing. A probe that cannot tell
   * "the feature is broken" from "that word is not a name" is measuring its own
   * choice of word.
   */
  const pointed = await session.evaluate<{
    tried: ReadonlyArray<string>
    underlined: string | null
    decoration: string | null
    cursor: string | null
    card: string | null
  }>(`
    (async () => {
      const KEYWORDS = new Set(["import", "export", "const", "return", "from", "async", "await",
        "function", "class", "this", "null", "true", "false", "throw", "catch", "typeof", "void",
        "else", "default", "while", "break", "continue", "case", "switch", "delete", "static"])

      const host = document.querySelector("diffs-container")
      const shadow = host && host.shadowRoot
      if (!shadow) return { tried: [], underlined: null, decoration: null, cursor: null, card: null }

      const spans = [...shadow.querySelectorAll("[data-line] span")]
      const names = spans.filter((one) => {
        const text = (one.textContent || "").trim()
        // Double backslash: this whole expression is a template literal, and a
        // lone \\w in one collapses to a plain w. Written singly, the page ran
        // /^[A-Za-z_$][w$]{2,}$/ — which matches almost no name there is, and
        // reported a working feature as a dead one twice over.
        return /^[A-Za-z_$][\\w$]{2,}$/.test(text) && !KEYWORDS.has(text)
      })

      const tried = []
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Meta", bubbles: true }))

      for (const token of names.slice(0, 14)) {
        const text = (token.textContent || "").trim()
        tried.push(text)

        const at = token.getBoundingClientRect()
        const where = {
          bubbles: true,
          composed: true,
          cancelable: true,
          clientX: at.left + at.width / 2,
          clientY: at.top + at.height / 2,
          metaKey: true,
          pointerId: 1,
          isPrimary: true,
          pointerType: "mouse"
        }
        token.dispatchEvent(new PointerEvent("pointerover", where))
        token.dispatchEvent(new PointerEvent("pointermove", where))
        token.dispatchEvent(new MouseEvent("mousemove", where))

        await new Promise((go) => setTimeout(go, 400))

        if ((token.style.textDecoration || "") !== "") {
          // The underline is set the moment the answer lands; the card is a
          // render after it. Asked in the same breath, the first version of this
          // reported a card that was on its way as a card that never came.
          await new Promise((go) => setTimeout(go, 1200))

          const card = [...document.body.querySelectorAll("div")]
            .map((one) => one.textContent || "")
            .find((said) => said.includes("Sure") || said.includes("Types") || said.includes("Likely"))

          return {
            tried,
            underlined: text,
            decoration: token.style.textDecoration,
            cursor: token.style.cursor || "",
            card: card === undefined ? null : card.slice(0, 90)
          }
        }
      }

      return { tried, underlined: null, decoration: null, cursor: null, card: null }
    })()
  `)

  console.log(
    JSON.stringify({ drawn, pointed, problems: session.problems().slice(0, 2) }, null, 2)
  )
} finally {
  session.stop()
}
