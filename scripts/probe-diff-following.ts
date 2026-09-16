/**
 * Following on a pull request, reported in full rather than as pass or fail.
 *
 * Every live check of Following so far was made on a blob page, because that is
 * the only page this can reach on its own: a pull request is drawn from routes
 * that answer to a session, and a fresh profile has none — measured, not
 * assumed, on a *public* pull request, which showed our own signed-out card with
 * `user-login` empty and only anonymous cookies. A diff is a different drawing —
 * two halves, a marker column, line numbers belonging to one side — so none of
 * what a blob page proves carries over on its own.
 *
 * So this needs a browser that is signed in, which means a profile that has been
 * signed in once and kept:
 *
 *     GITQUIET_CDP_PROFILE=~/.gitquiet-qa bun scripts/probe-diff-following.ts \
 *       --page 'https://github.com/OWNER/REPO/pull/N/files' \
 *       --names 'readBodyWithinLimit@12,AsyncResult@1,BodyReadFailure@5'
 *
 * Sign in once in that profile and it stays signed in between runs. Nothing here
 * reads a cookie or moves one anywhere.
 *
 * For each name it says what the renderer handed over, what the underline did,
 * and what the press did — a panel, a move, or nothing — because "nothing
 * happens" is three different faults wearing one coat, and which one it is
 * cannot be told from the outside.
 */
import { PANES, withExtension } from "./chrome"

const argued = (flag: string): string | undefined => {
  const at = Bun.argv.indexOf(flag)
  return at === -1 ? undefined : Bun.argv[at + 1]
}

const PAGE = argued("--page") ?? "https://github.com/flazouh/gitquiet/pull/82/files"

/** `name@line` a few times over, which is what a reader would press. */
const NAMES = (argued("--names") ?? "Secret@11").split(",").map((one) => {
  const [word, line] = one.trim().split("@")
  return { word: word ?? "", line: Number(line ?? 1) }
})

const session = await withExtension(PAGE, `${import.meta.dir}/../.output/chrome-mv3`)
const sleep = (ms: number) => new Promise((go) => setTimeout(go, ms))

type Report = {
  readonly drew: boolean
  readonly row?: string
  readonly token?: { char: string | null; text: string; inside: number }
  readonly underlined?: boolean
  readonly press?: string
  readonly why?: string
}

const look = (word: string, line: number): Promise<Report> =>
  session.evaluate<Report>(`
    (async () => {
      ${PANES}
      const sleep = (ms) => new Promise((go) => setTimeout(go, ms))

      let drawn = []
      for (let tries = 0; tries < 60; tries++) {
        drawn = panes()
        if (drawn.length > 0) break
        await sleep(500)
      }
      if (drawn.length === 0) return { drew: false, why: "no pane drew at all — signed out, or the diff never arrived" }

      const edge = "[^A-Za-z0-9_$]"
      let row = null, token = null, inside = -1
      for (const root of drawn) {
        for (const one of root.querySelectorAll('[data-line="${line}"]')) {
          for (const span of one.querySelectorAll("span")) {
            if (span.querySelector("span")) continue
            const text = span.textContent || ""
            const found = text.search(new RegExp("(^|" + edge + ")" + ${JSON.stringify(word)} + "(" + edge + "|$)"))
            if (found === -1) continue
            row = one; token = span; inside = text.indexOf(${JSON.stringify(word)}, found)
            break
          }
          if (token) break
        }
        if (token) break
      }
      if (!token) return { drew: true, why: "the renderer drew no token holding that word on that line" }

      row.scrollIntoView({ block: "center", behavior: "instant" })
      await sleep(400)

      const at = token.getBoundingClientRect()
      const text = token.textContent || ""
      const wide = at.width / Math.max(1, text.length)
      const where = {
        bubbles: true, composed: true, cancelable: true,
        clientX: at.left + (inside + ${JSON.stringify(word)}.length / 2) * wide,
        clientY: at.top + at.height / 2,
        metaKey: true, pointerId: 1, isPrimary: true, pointerType: "mouse"
      }

      const seen = {
        drew: true,
        row: [...row.attributes].map((a) => a.name + "=" + a.value).join(" "),
        token: { char: token.getAttribute("data-char"), text: text.slice(0, 60), inside }
      }

      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Meta", bubbles: true }))
      token.dispatchEvent(new PointerEvent("pointerover", where))
      token.dispatchEvent(new PointerEvent("pointermove", where))

      let underlined = false
      for (let waited = 0; waited < 15000; waited += 50) {
        if ((token.style.textDecoration || "") !== "" ||
            [...token.querySelectorAll("span")].some((s) => (s.style.textDecoration || "") !== "")) {
          underlined = true
          break
        }
        await sleep(50)
      }
      if (!underlined) return { ...seen, underlined: false, why: "held the key and it never underlined" }

      // Where the pane is before the press, so a move can be told from nothing.
      const scrollerOf = (el) => {
        let up = el
        while (up) {
          if (up.scrollHeight > up.clientHeight + 4) return up
          up = up.parentElement || (up.getRootNode() || {}).host || null
        }
        return document.scrollingElement
      }
      const scroller = scrollerOf(row)
      const before = scroller ? scroller.scrollTop : 0

      token.dispatchEvent(new PointerEvent("pointerdown", where))
      token.dispatchEvent(new PointerEvent("pointerup", where))
      token.dispatchEvent(new MouseEvent("click", where))

      let panel = null
      for (let waited = 0; waited < 8000; waited += 100) {
        panel = document.querySelector('[aria-label^="Uses of "]')
        if (panel) break
        await sleep(100)
      }
      const after = scroller ? scroller.scrollTop : 0

      return {
        ...seen,
        underlined: true,
        press: panel
          ? "opened " + JSON.stringify(panel.getAttribute("aria-label"))
          : after !== before
            ? "moved the pane from " + before + " to " + after
            : "nothing: no panel, and the pane did not move"
      }
    })()
  `)

try {
  console.log(`page: ${PAGE}\n`)
  for (const { word, line } of NAMES) {
    const seen = await look(word, line)
    console.log(`${word} @ L${line}`)
    for (const [key, value] of Object.entries(seen)) {
      console.log(`   ${key}: ${typeof value === "object" ? JSON.stringify(value) : value}`)
    }
    console.log()
    await session.evaluate(`
      (() => {
        document.dispatchEvent(new KeyboardEvent("keyup", { key: "Meta", bubbles: true }))
        document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true, pointerId: 1, isPrimary: true, pointerType: "mouse" }))
      })()
    `)
    await sleep(500)
  }

  const problems = session.problems()
  if (problems.length > 0) {
    console.log("the page logged:")
    for (const one of problems.slice(0, 8)) console.log(`  ${one.split("\n")[0]}`)
  }
} finally {
  await session.screenshot(`${import.meta.dir}/../.output/qa/diff-following.png`)
  session.stop()
}
