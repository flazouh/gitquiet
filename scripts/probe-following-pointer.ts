/**
 * Whether holding the key over a name underlines it, for a real pointer.
 *
 * The distinction this exists for, which cost a QA pass to find: `qa-following`
 * and `following-in-the-console` both make the hover by dispatching a
 * `PointerEvent` at the token element. That skips hit-testing entirely — it
 * asks whether the handler works, not whether a hand can reach it. Both report
 * an underline in tens of milliseconds.
 *
 * Chrome's own input goes through the compositor, hit-tests against the layout,
 * and arrives at whatever is actually under that point. It is the only thing
 * here that answers the reader's question. `shots-following` already sends it
 * for the keyboard, for the same reason and written down in the same words.
 *
 * Both are measured, on the same token in the same run, so the answer is a
 * comparison rather than a number:
 *
 *     bun run build && bun scripts/probe-following-pointer.ts [--page URL] [--word NAME]
 */
import { PANES, withExtension } from "./chrome"

const argued = (flag: string): string | undefined => {
  const at = Bun.argv.indexOf(flag)
  return at === -1 ? undefined : Bun.argv[at + 1]
}

const PAGE = argued("--page") ?? "https://github.com/sindresorhus/p-limit/blob/main/index.js"
const WORD = argued("--word")
const EXTENSION = `${import.meta.dir}/../.output/chrome-mv3`
/** Command on a Mac, Control elsewhere; the interface takes either. See `held`. */
const META = 4

const sleep = (ms: number) => new Promise((go) => setTimeout(go, ms))

type Spot = {
  readonly word: string
  readonly x: number
  readonly y: number
  /** Whether that point actually lands on the token, which is the whole question. */
  readonly hits: boolean
}

const session = await withExtension(PAGE, EXTENSION)

const mouse = (type: string, x: number, y: number, modifiers: number) =>
  session.tab.send("Input.dispatchMouseEvent", {
    type,
    x,
    y,
    modifiers,
    button: "none",
    clickCount: 0
  })

/** Whether the token under the pointer wears an underline now. */
const underlined = (word: string) =>
  session.evaluate<boolean>(`
    (() => {
      ${PANES}
      for (const root of panes()) {
        for (const one of root.querySelectorAll("[data-line] span")) {
          if ((one.textContent || "").trim() !== ${JSON.stringify(word)}) continue
          if ((one.style.textDecoration || "") !== "") return true
          for (const inner of one.querySelectorAll("span")) {
            if ((inner.style.textDecoration || "") !== "") return true
          }
        }
      }
      return false
    })()
  `)

try {
  for (let tries = 0; tries < 40; tries++) {
    const ready = await session.evaluate<boolean>(`
      (() => { ${PANES} return panes().some((root) => root.querySelector("[data-line] span")) })()
    `)
    if (ready) break
    await sleep(1000)
  }
  // The door the pane opens as it draws — a worker, a document, a grammar — is
  // not a question about a name and should not be measured as one.
  await sleep(3000)

  /*
   * The name brought onto the screen before it is measured.
   *
   * Chrome's input is hit-tested against what is actually laid out, so a name
   * below the fold cannot be pointed at — and the first run of this reported
   * "no name was drawn" for a Python file whose name sits on line 124, which is
   * a probe answering about the viewport while appearing to answer about the
   * language.
   */
  const spot = await session.evaluate<Spot | null>(`
    (async () => {
      ${PANES}
      const bring = () => {
        for (const root of panes()) {
          for (const one of root.querySelectorAll("[data-line] span")) {
            if (one.children.length > 0) continue
            const word = (one.textContent || "").trim()
            ${WORD === undefined ? `if (false) continue` : `if (word !== ${JSON.stringify(WORD)}) continue`}
            const row = one.closest("[data-line]")
            if (row) row.scrollIntoView({ block: "center", behavior: "instant" })
            return true
          }
        }
        return false
      }
      bring()
      await new Promise((go) => setTimeout(go, 800))
      return (() => {
      const KEYWORD = new Set(["const","return","export","import","function","class","await","async","from","this","null","true","false","string","number","boolean","void","type","interface"])
      for (const root of panes()) {
        for (const one of root.querySelectorAll("[data-line] span")) {
          if (one.children.length > 0) continue
          const word = (one.textContent || "").trim()
          ${WORD === undefined
            ? `if (!/^[A-Za-z_$][A-Za-z0-9_$]{3,}$/.test(word) || KEYWORD.has(word)) continue`
            : `if (word !== ${JSON.stringify(WORD)}) continue`}
          const box = one.getBoundingClientRect()
          if (box.width <= 0 || box.top < 80 || box.bottom > innerHeight - 40) continue
          const x = Math.round(box.left + box.width / 2)
          const y = Math.round(box.top + box.height / 2)
          // The deepest element at that point, shadow roots and all, which is
          // what Chrome's own input will arrive at.
          let node = document.elementFromPoint(x, y)
          while (node && node.shadowRoot) {
            const inner = node.shadowRoot.elementFromPoint(x, y)
            if (!inner || inner === node) break
            node = inner
          }
          return { word, x, y, hits: node === one }
        }
      }
      return null
      })()
    })()
  `)

  if (spot === null) {
    console.log(JSON.stringify({ page: PAGE, problems: ["no name was drawn to hold the key over"] }, null, 2))
  } else {
    // Chrome's own, hit-tested: the key down, the pointer moved in from beside
    // the word so the move crosses into it, and the underline waited for.
    await session.tab.send("Input.dispatchKeyEvent", {
      type: "rawKeyDown",
      key: "Meta",
      code: "MetaLeft",
      modifiers: META
    })
    await mouse("mouseMoved", spot.x - 40, spot.y + 30, META)
    await sleep(200)
    await mouse("mouseMoved", spot.x, spot.y, META)

    let real: number | null = null
    for (let waited = 0; waited < 12_000; waited += 100) {
      if (await underlined(spot.word)) {
        real = waited
        break
      }
      await sleep(100)
    }
    await session.tab.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Meta", code: "MetaLeft" })
    await mouse("mouseMoved", 5, 5, 0)
    await sleep(600)

    // And the same name again, the way the other probes ask it.
    const synthetic = await session.evaluate<number | null>(`
      (async () => {
        ${PANES}
        let token = null
        for (const root of panes()) {
          for (const one of root.querySelectorAll("[data-line] span")) {
            if (one.children.length === 0 && (one.textContent || "").trim() === ${JSON.stringify(spot.word)}) { token = one; break }
          }
          if (token) break
        }
        if (!token) return null
        const box = token.getBoundingClientRect()
        const where = {
          bubbles: true, composed: true, cancelable: true,
          clientX: box.left + box.width / 2, clientY: box.top + box.height / 2,
          metaKey: true, pointerId: 1, isPrimary: true, pointerType: "mouse"
        }
        const started = performance.now()
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Meta", bubbles: true }))
        token.dispatchEvent(new PointerEvent("pointerover", where))
        token.dispatchEvent(new PointerEvent("pointermove", where))
        for (let waited = 0; waited < 12000; waited += 50) {
          const marked = (el) => (el.style.textDecoration || "") !== ""
          if (marked(token) || [...token.querySelectorAll("span")].some(marked)) {
            return Math.round(performance.now() - started)
          }
          await new Promise((go) => setTimeout(go, 50))
        }
        return null
      })()
    `)

    const problems = [
      spot.hits ? null : `the point over "${spot.word}" lands on something else, so no pointer can reach it`,
      real === null ? `Chrome's own pointer held over "${spot.word}" never underlined it` : null,
      real === null && synthetic !== null
        ? "a dispatched event underlines what a real pointer does not, so every probe that dispatches is measuring nothing a reader can do"
        : null
    ].filter((one): one is string => one !== null)

    console.log(
      JSON.stringify(
        { page: PAGE, word: spot.word, hitTested: spot.hits, realMs: real, syntheticMs: synthetic, problems },
        null,
        2
      )
    )
  }
} finally {
  session.stop()
}
