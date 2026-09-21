/**
 * Whether a press on a name reaches it when its Writing is on a folded line.
 *
 * Reported from a real pull request: `runGitCommand` is written on line 45 of
 * the file it is used in, and a pull request that changed lines 71 to 93 draws
 * lines 21 to 70 as one "unmodified lines" bar. The underline went on, which is
 * the Ledger answering, and a Command-press did nothing at all — the jump looked
 * for a row with that line number, and the renderer never drew one.
 *
 * `bun test` holds the pane's half with a renderer that draws no rows. What it
 * cannot hold is the real one: that a pull request's diff really does leave the
 * Writing's row out, that Chrome's own press reaches the name, and that what
 * the reader is shown is the Writing's lines. So this presses a real name in a
 * real diff with Chrome's own input, and looks for them.
 *
 * The default is `flazouh/gitquiet#94`, where `readerTerms` is written on line
 * 93 of `src/domain/issueList.ts` and used in a line the pull request added.
 *
 *     bun run build && bun scripts/probe-following-folded.ts [--page URL] [--word NAME] [--line N]
 */
import { PANES, withExtension } from "./chrome"

const argued = (flag: string): string | undefined => {
  const at = Bun.argv.indexOf(flag)
  return at === -1 ? undefined : Bun.argv[at + 1]
}

const PAGE = argued("--page") ?? "https://github.com/flazouh/gitquiet/pull/94#src/domain/issueList.ts"
const WORD = argued("--word") ?? "readerTerms"
/** The line the Writing is on, which the diff should not have drawn. */
const LINE = Number(argued("--line") ?? "93")
const EXTENSION = `${import.meta.dir}/../.output/chrome-mv3`
/** Command on a Mac, Control elsewhere; the interface takes either. */
const META = 4

const sleep = (ms: number) => new Promise((go) => setTimeout(go, ms))

const session = await withExtension(PAGE, EXTENSION)

const mouse = (type: string, x: number, y: number, modifiers: number, button = "none") =>
  session.tab.send("Input.dispatchMouseEvent", {
    type,
    x,
    y,
    modifiers,
    button,
    clickCount: button === "none" ? 0 : 1
  })

/** Whether any pane holds a drawn row for a line number. */
const drawn = (line: number) =>
  session.evaluate<boolean>(`
    (() => { ${PANES} return panes().some((root) => root.querySelector('[data-line="${line}"]')) })()
  `)

/**
 * Whether the Writing's own lines are on the screen, and where.
 *
 * A Peek says the line it is showing — "line 93" — beside the lines themselves,
 * and neither is anywhere on the page until it opens. Asked across every shadow
 * root, because the row the Peek hangs in is inside the diff's.
 */
const shown = () =>
  session.evaluate<boolean>(`
    (() => {
      ${PANES}
      const said = "line ${LINE}"
      return panes().some((root) => {
        for (const one of root.querySelectorAll("*")) {
          if (one.children.length > 0) continue
          if ((one.textContent || "").includes(said)) return true
        }
        return false
      })
    })()
  `)

const scrolledTo = () => session.evaluate<number>(`Math.round(scrollY)`)

try {
  for (let tries = 0; tries < 60; tries++) {
    // A pull request's address is rewritten as the interface takes the page, and
    // a question asked across that navigation is dropped rather than answered.
    const ready = await session
      .evaluate<boolean>(`
        (() => { ${PANES} return panes().some((root) => root.querySelector("[data-line] span")) })()
      `)
      .catch(() => false)
    if (ready) break
    await sleep(1000)
  }
  // The door the pane opens as it draws — a worker, a document, a grammar — is
  // not a question about a name and should not be measured as one.
  await sleep(3000)

  // The premise, checked rather than assumed: a probe about a folded line is
  // measuring nothing if the line was drawn after all.
  const foldedAtStart = !(await drawn(LINE))
  const shownAtStart = await shown()

  const spot = await session.evaluate<{ x: number; y: number; hits: boolean } | null>(`
    (async () => {
      ${PANES}
      const edge = "[^A-Za-z0-9_$]"
      const pattern = new RegExp("(^|" + edge + ")" + ${JSON.stringify(WORD)} + "(" + edge + "|$)")
      const find = () => {
        for (const root of panes()) {
          for (const one of root.querySelectorAll("[data-line] span")) {
            if (one.children.length > 0) continue
            const text = one.textContent || ""
            if (!pattern.test(text)) continue
            return { one, text }
          }
        }
        return null
      }
      const first = find()
      if (first === null) return null
      first.one.closest("[data-line]")?.scrollIntoView({ block: "center", behavior: "instant" })
      await new Promise((go) => setTimeout(go, 800))
      const found = find()
      if (found === null) return null
      const box = found.one.getBoundingClientRect()
      const at = found.text.indexOf(${JSON.stringify(WORD)})
      const wide = box.width / Math.max(1, found.text.length)
      const x = Math.round(box.left + (at + ${WORD.length} / 2) * wide)
      const y = Math.round(box.top + box.height / 2)
      let node = document.elementFromPoint(x, y)
      while (node && node.shadowRoot) {
        const inner = node.shadowRoot.elementFromPoint(x, y)
        if (!inner || inner === node) break
        node = inner
      }
      return { x, y, hits: node === found.one }
    })()
  `)

  if (spot === null) {
    console.log(JSON.stringify({ page: PAGE, word: WORD, problems: [`"${WORD}" is drawn nowhere`] }, null, 2))
  } else {
    const before = await scrolledTo()

    // Chrome's own, hit-tested: the key down, the pointer moved in from beside
    // the word, and then a real press — which is the gesture that did nothing.
    await session.tab.send("Input.dispatchKeyEvent", {
      type: "rawKeyDown",
      key: "Meta",
      code: "MetaLeft",
      modifiers: META
    })
    await mouse("mouseMoved", spot.x - 40, spot.y + 30, META)
    await sleep(200)
    await mouse("mouseMoved", spot.x, spot.y, META)
    await sleep(1500)
    await mouse("mousePressed", spot.x, spot.y, META, "left")
    await mouse("mouseReleased", spot.x, spot.y, META, "left")
    await session.tab.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Meta", code: "MetaLeft" })

    const pressedAt = Date.now()
    let answeredMs: number | null = null
    while (Date.now() - pressedAt < 8_000) {
      if (await shown()) {
        answeredMs = Date.now() - pressedAt
        break
      }
      await sleep(100)
    }
    const after = await scrolledTo()

    const problems = [
      foldedAtStart ? null : `line ${LINE} was drawn from the start, so this measured nothing about a fold`,
      shownAtStart ? `"line ${LINE}" was on the screen before the press, so its appearing proves nothing` : null,
      spot.hits ? null : `the point over "${WORD}" lands on something else, so no pointer can reach it`,
      answeredMs === null ? `a press on "${WORD}" showed nothing of line ${LINE}` : null
    ].filter((one): one is string => one !== null)

    console.log(
      JSON.stringify(
        {
          page: PAGE,
          word: WORD,
          line: LINE,
          foldedAtStart,
          hitTested: spot.hits,
          shownAfterMs: answeredMs,
          scrolled: after - before,
          problems
        },
        null,
        2
      )
    )
  }
} finally {
  session.stop()
}
