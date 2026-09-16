/**
 * Following a name, on a live page, through the built extension.
 *
 * The resolver's own tests prove a name resolves and that its Uses are listed.
 * What they cannot prove is that a reader can get at any of it: between the
 * resolver and the reader are the renderer's token events, and a name the
 * pointer cannot pick out of a token is a name nobody can press however well it
 * resolves. That gap is where "I cannot click this and see its usage" lived —
 * for types, and for the 48.7% of all names that share a token with something
 * else — and nothing in `bun test` reaches it.
 *
 * So this is a pointer and a key, on a real file, in a real Chrome:
 *
 *     bun run build && bun scripts/probe-following-types.ts
 *
 * A public `.d.ts` rather than a pull request, for the reason
 * `scripts/qa-following.ts` sets out at length: a signed-out visit reaches a
 * sign-in card and no diff is ever drawn. A blob page is the same renderer and
 * the same token events, and it answers to nobody.
 *
 * It reports one line per name — whether the token was found at all, whether it
 * underlined, and whether pressing it opened the panel — and exits non-zero if
 * any of them did not, so it can be run as a check rather than read as a story.
 */
import { withExtension } from "./chrome"

const argued = (flag: string): string | undefined => {
  const at = Bun.argv.indexOf(flag)
  return at === -1 ? undefined : Bun.argv[at + 1]
}

const PAGE =
  argued("--page") ?? "https://github.com/sindresorhus/p-limit/blob/main/index.d.ts"

/**
 * The names to try, and what each one is there to catch.
 *
 * A type at its declaration and a type at a use, because those are the two
 * different things a press does and only one of them opens the panel.
 *
 * `wants` is which of the two things a press does, and it is not a detail: a
 * press on a Writing asks who depends on it and opens the panel, and a press on
 * a *use* goes to the Writing instead. The first version of this expected a
 * panel from every press and called the one that went somewhere a failure.
 *
 * Nothing here presses a name written in *another* file. That press is a real
 * one and it works, but what it does is open that file — which tears down the
 * execution context this is waiting in, so the probe hangs and reports nothing.
 * Every function in a `.d.ts` is such a name: the signature is here and the
 * body is in the `.js` beside it, which is why none is used as a control.
 *
 * Line 89 is avoided for a different reason worth writing down. Shiki draws
 * `export default function pLimit(concurrency: number | Options): LimitFunction;`
 * as one token from the `(` to the end of the line, so no name in it is a token
 * of its own and none of them can be hovered at all — types and values alike.
 * That is a grammar's doing rather than this extension's, and it is the one
 * shape found where a reader genuinely cannot click a type.
 */
const TRIES = [
  { word: "LimitFunction", line: 1, wants: "panel", what: "a type at its declaration" },
  { word: "Options", line: 91, wants: "panel", what: "a second type at its declaration" },
  { word: "LimitFunction", line: 136, wants: "go", what: "a use of a type, which goes to it" },
  /*
   * A generic on a signature with no body, which is two bugs at once.
   *
   * It is inside a lumped token, so before the pointer decided which name a
   * token meant it could not be hovered at all. And its signature opened no
   * scope, so once it could be hovered it answered with a different generic of
   * the same spelling eighty lines up — `Arguments` on line 133 resolving to
   * the `Arguments` on line 53.
   */
  { word: "Arguments", line: 133, wants: "panel", what: "a generic on a bodiless signature" },
  { word: "ReturnType", line: 133, wants: "panel", what: "a second generic beside it" }
] as const

/** One name only, for telling a name that fails from an order that does. */
const ONLY = argued("--only")

const EXTENSION = `${import.meta.dir}/../.output/chrome-mv3`
const sleep = (ms: number) => new Promise((go) => setTimeout(go, ms))

const session = await withExtension(PAGE, EXTENSION)

/**
 * Puts a line on the screen, whatever is actually doing the scrolling.
 *
 * The same problem `scripts/shots-following.ts` solves and for the same reason:
 * the row is inside a shadow root, the document does not scroll, and a token
 * below the fold is a token the renderer has not drawn. Without this the probe
 * reports that a name was never drawn, which is a probe reporting on a screen
 * nobody is looking at.
 */
const ON_SCREEN = `
  const putOnScreen = async (el) => {
    for (let tries = 0; tries < 6; tries++) {
      el.scrollIntoView({ block: "center", behavior: "instant" })
      await new Promise((go) => setTimeout(go, 250))
      const seen = el.getBoundingClientRect()
      if (seen.top > 80 && seen.bottom < window.innerHeight - 80) return true
    }
    return false
  }
`

type Answer = {
  readonly drawn: boolean
  readonly underlined: boolean
  readonly opened: boolean
  readonly why?: string
}

/**
 * One name, with a deadline.
 *
 * A probe that hangs reports nothing at all, which is worse than a probe that
 * reports a failure: the first version of this sat inside an `evaluate` that
 * never settled and was killed by the shell, so every run said "Terminated"
 * and nothing about the feature. Whatever goes wrong in the page, this answers.
 */
const tryOne = async (word: string, line: number, wants: string): Promise<Answer> => {
  const gaveUp: Answer = { drawn: false, underlined: false, opened: false, why: "the page never answered" }
  const asked = inThePage(word, line, wants).catch((cause): Answer => ({
    drawn: false,
    underlined: false,
    opened: false,
    why: `the page threw: ${String(cause).slice(0, 200)}`
  }))
  return Promise.race([asked, sleep(120_000).then(() => gaveUp)])
}

const inThePage = (word: string, line: number, wants: string): Promise<Answer> =>
  session.evaluate<Answer>(`
    (async () => {
      /*
       * The page's own deadline, inside the shell's.
       *
       * An \`evaluate\` that never settles is a run that reports nothing at all,
       * and the shell killing it a minute later says only that it was killed.
       * Whatever is slow in here, this answers with what it had got to.
       */
      /*
       * How far it got, for the deadline below to name.
       *
       * Worth the global. Every failing run before this said only that it had
       * been killed, which is a sentence about the harness rather than about
       * the feature — and the one time it said where it had stopped, the cause
       * was obvious in a minute.
       */
      window.__step = "start"
      const ranOut = new Promise((go) =>
        setTimeout(() => go({ drawn: false, underlined: false, opened: false, why: "gave up in the page at: " + window.__step }), 90000)
      )
      const doing = (async () => {
      try {
      ${ON_SCREEN}
      const sleep = (ms) => new Promise((go) => setTimeout(go, ms))

      /*
       * Every pane, wherever it is, which is no longer their document.
       *
       * The interface stands in a shadow root on a host of its own, and the
       * renderer's own container is a second one inside that.
       * \`document.querySelector\` reaches across neither, which is why the
       * probes written before the move report that a name was never drawn on a
       * page that is drawing it perfectly well.
       */
      const panes = () => {
        const found = []
        const walk = (node) => {
          for (const el of node.querySelectorAll("*")) {
            if (!el.shadowRoot) continue
            if (el.tagName.toLowerCase() === "diffs-container") found.push(el.shadowRoot)
            // Not into the renderer's own root: it holds a span per token, so
            // walking it is the expensive half of this and there is no pane
            // inside a pane. Sweeping it every poll is what made the probe run
            // out of its own deadline rather than answer.
            else walk(el.shadowRoot)
          }
        }
        walk(document)
        return found
      }

      /** The pane holding this file, found again rather than trusted. */
      const paneFor = async () => {
        for (let tries = 0; tries < 40; tries++) {
          for (const root of panes()) {
            if (root.querySelector('[data-line="${line}"]')) return root
          }
          await sleep(250)
        }
        return null
      }

      const shadow = await paneFor()
      window.__step = "found the pane"
      if (!shadow) return { drawn: false, underlined: false, opened: false, why: "no pane drew this line" }

      const row = shadow.querySelector('[data-line="${line}"]')
      if (row) await putOnScreen(row)
      window.__step = "scrolled it into view"

      /*
       * The token *holding* the word, and where in it the word sits.
       *
       * Not the token whose text is the word. Shiki draws by colour, so a name
       * is very often inside a token carrying other things too — a dot, a
       * bracket, a whole argument list. A reader points at the word wherever it
       * sits, so this does, and the pointer's x is what says which name is
       * meant. A probe that could only find whole-token names could only ever
       * check the half of them that were never broken.
       */
      const rows = [...shadow.querySelectorAll('[data-line="${line}"]')]
      const edge = "[^A-Za-z0-9_$]"
      let token = null
      let inside = -1
      for (const one of rows) {
        for (const span of one.querySelectorAll("span")) {
          // A leaf, which is what a real pointer would hit. A span that wraps
          // other spans is a parent, and its box spans several tokens — the
          // arithmetic below would land on the right pixel and the event on the
          // wrong element.
          if (span.querySelector("span")) continue
          const text = span.textContent || ""
          const whole = new RegExp("(^|" + edge + ")" + ${JSON.stringify(word)} + "(" + edge + "|$)")
          const found = text.search(whole)
          if (found === -1) continue
          token = span
          inside = text.indexOf(${JSON.stringify(word)}, found)
          break
        }
        if (token) break
      }
      if (!token) return { drawn: false, underlined: false, opened: false, why: "the renderer drew no such token" }
      window.__step = "found the token"

      const at = token.getBoundingClientRect()
      const text = token.textContent || ""
      // Monospaced, so a character is the width over the count — the same
      // arithmetic the engine does to work out which name is being pointed at.
      const wide = at.width / Math.max(1, text.length)
      const where = {
        bubbles: true, composed: true, cancelable: true,
        clientX: at.left + (inside + ${JSON.stringify(word)}.length / 2) * wide,
        clientY: at.top + at.height / 2,
        metaKey: true, pointerId: 1, isPrimary: true, pointerType: "mouse"
      }

      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Meta", bubbles: true }))
      token.dispatchEvent(new PointerEvent("pointerover", where))
      token.dispatchEvent(new PointerEvent("pointermove", where))

      let underlined = false
      for (let waited = 0; waited < 15000; waited += 50) {
        // On the token, or on a span inside it where the name is only part.
        const drawn = (token.style.textDecoration || "") !== "" ||
          [...token.querySelectorAll("span")].some((s) => (s.style.textDecoration || "") !== "")
        if (drawn) { underlined = true; break }
        await sleep(50)
      }
      if (!underlined) return { drawn: true, underlined: false, opened: false, why: "held the key and it never underlined" }
      window.__step = "it underlined"

      // Press it. On the Writing itself the press asks who depends on it, which
      // is the panel — the one thing the report said could not be reached.
      token.dispatchEvent(new PointerEvent("pointerdown", where))
      token.dispatchEvent(new PointerEvent("pointerup", where))
      token.dispatchEvent(new MouseEvent("click", where))

      // The panel is a popup portalled into the page body, under nothing, and
      // it names what it is about — so the check is that the panel which opened
      // is the one for the name that was pressed, and not a panel left standing
      // from the try before.
      let opened = false
      const wanted = '[aria-label="Uses of ' + ${JSON.stringify(word)} + '"]'
      /*
       * Looked for in their document, which is where the panel is put.
       *
       * Not swept through the shadow roots: the panel is portalled into the
       * page body on purpose — see the note in UsesPanel about a popup
       * standing under nothing that could mishear a press — and a sweep that
       * asked the renderer's own root eighty times ran the probe out of its
       * deadline on a file of a hundred and thirty lines.
       */
      for (let waited = 0; waited < 8000; waited += 100) {
        if (document.querySelector(wanted)) { opened = true; break }
        await sleep(100)
      }

      // A press on a use is answered by going to the Writing, not by a panel —
      // so for that one the panel staying shut is the pass, and opening is the
      // failure.
      const wanted${"Panel"} = ${JSON.stringify(wants)} === "panel"
      const right = wanted${"Panel"} ? opened : !opened
      return {
        drawn: true,
        underlined: true,
        opened: right,
        ...(right
          ? {}
          : {
              why: wanted${"Panel"}
                ? "it underlined, and pressing it opened no panel" +
                  (() => {
                    const any = document.querySelector('[aria-label^="Uses of "]')
                    return any ? " (a panel for " + JSON.stringify(any.getAttribute("aria-label")) + " is up)" : " (no panel at all)"
                  })()
                : "pressing a use opened a panel, where it should have gone to the Writing"
            })
      }
      } catch (cause) {
        return { drawn: false, underlined: false, opened: false, why: "threw in the page: " + String(cause).slice(0, 200) }
      }
      })()
      return Promise.race([doing, ranOut])
    })()
  `)

let bad = 0
try {
  for (const one of TRIES.filter((each) => ONLY === undefined || each.word === ONLY)) {
    const { word, line, wants, what } = one
    const stillOpen = "open" in one && one.open === true
    const answer = await tryOne(word, line, wants)
    const ok = answer.drawn && answer.underlined && answer.opened
    if (!ok && !stillOpen) bad += 1
    const mark = ok ? "ok  " : stillOpen ? "open" : "FAIL"
    console.log(
      `${mark}  ${word.padEnd(14)} L${String(line).padEnd(4)} ${what}` +
        (answer.why === undefined ? "" : `\n        ${answer.why}`)
    )
    /*
     * Let go, and put the panel away, so the next name starts from a clean
     * screen.
     *
     * Not politeness: a panel left standing holds a second drawing of code,
     * which is a great deal more DOM for the next try to walk, and the run
     * where this was missing had the third name time out rather than answer.
     * A press anywhere else is how a reader closes it, so that is what this is.
     */
    await session.evaluate(`
      (() => {
        document.dispatchEvent(new KeyboardEvent("keyup", { key: "Meta", bubbles: true }))
        // A pointerdown, in the capture phase on the document, is what the
        // panel actually listens for. A mousedown closed nothing, so every
        // panel stayed up and the next name checked found the one before it.
        document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true, pointerId: 1, isPrimary: true, pointerType: "mouse" }))
      })()
    `)
    await sleep(400)
    // Proven gone, rather than assumed: two tries about the same word cannot
    // tell a panel that opened from one that never closed.
    const stillUp = await session.evaluate<boolean>(`
      !!document.querySelector('[aria-label^="Uses of "]')
    `)
    if (stillUp) console.log(`        (a panel was still up after ${word})`)
  }

  const problems = session.problems()
  if (problems.length > 0) {
    console.log("\nthe page logged:")
    for (const one of problems.slice(0, 10)) console.log(`  ${one}`)
  }
} finally {
  await session.screenshot(`${import.meta.dir}/../.output/qa/following-types.png`)
  session.stop()
}

process.exit(bad === 0 ? 0 : 1)
