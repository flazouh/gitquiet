/**
 * Whether the diff pane can read the rest of a file, and whether a name in it
 * is ever offered to Following.
 *
 * Following does not underline in a diff, and with the silent catches gone the
 * console says nothing at all — so it is not failing, it is not running. Two
 * things upstream could account for that and neither reports: a read that never
 * settles, and a token the engine never classifies as a Name. This asks both
 * directly rather than inferring them from a gesture that does nothing.
 *
 *     bun run build && bun scripts/probe-reveal.ts
 */
import { withExtension } from "./chrome"

const argued = (flag: string): string | undefined => {
  const at = Bun.argv.indexOf(flag)
  return at === -1 ? undefined : Bun.argv[at + 1]
}

const PAGE =
  argued("--page") ??
  "https://github.com/sindresorhus/p-limit/commit/f3e7f9ba364a9357bd912d136367d06c46660917"
const WORD = argued("--word") ?? "limitFunction"
const WRITTEN = argued("--written") ?? "117"
const EXTENSION = `${import.meta.dir}/../.output/chrome-mv3`

const session = await withExtension(PAGE, EXTENSION)

const seen = await session.evaluate<unknown>(`(async () => {
  const sleep = (ms) => new Promise((go) => setTimeout(go, ms))

  /*
   * The pane drawn for one named file, rather than whichever one is first.
   *
   * A commit draws a container per file and they are all alike from outside, so
   * querySelector answers with the first — which on this commit is a
   * declaration file, and every measurement taken through it was taken against
   * a .d.ts while reporting a line number from somewhere else entirely. The
   * path is in the light DOM above each container, so the container is found by
   * reading up to it.
   */
  /*
   * The pane drawn for the file the name is actually in.
   *
   * A commit draws a container per file, they are alike from outside, and the
   * path is not in the DOM near any of them — so querySelector answers with the
   * first, which on this commit is a declaration file. Every measurement here
   * was taken through that: a .d.ts, reporting a line from one file against a
   * name expected in another, and reporting it as a feature that does not work.
   *
   * The name and the line it is written on identify the pane between them,
   * which is what a reader is looking at anyway.
   */
  const pane = async () => {
    for (let tries = 0; tries < 40; tries++) {
      for (const one of document.querySelectorAll("diffs-container")) {
        const root = one.shadowRoot
        if (!root) continue
        const row = root.querySelector('[data-line="' + ${JSON.stringify(WRITTEN)} + '"]')
        if (row && [...row.querySelectorAll("span")].some((s) => (s.textContent || "").trim() === ${JSON.stringify(WORD)})) {
          return root
        }
      }
      await sleep(250)
    }
    return null
  }

  const shadow = await pane()
  if (!shadow) {
    const all = [...document.querySelectorAll("diffs-container")]
    return {
      pane: false,
      containers: all.length,
      around: all.map((one) => {
        const up = one.parentElement?.parentElement?.parentElement
        return (up?.textContent || "").trim().slice(0, 90)
      }),
      paths: [...document.querySelectorAll("[data-path], [title]")].slice(0, 20).map((o) => o.getAttribute("data-path") || o.getAttribute("title"))
    }
  }

  const rows = () => shadow.querySelectorAll("[data-line]").length

  /*
   * The separators Pierre draws between the hunks. They are the only control in
   * the pane that calls back into our reveal, so pressing one is the only way
   * to find out from outside whether that read ever answers.
   */
  const buttons = [...shadow.querySelectorAll('button, [role="button"]')]
  const expanders = buttons.filter((one) => {
    const said = ((one.getAttribute("aria-label") || "") + " " + (one.textContent || "")).toLowerCase()
    return said.includes("expand") || said.includes("unchanged") || said.includes("more") || one.querySelector("svg") !== null
  })

  const before = rows()
  if (expanders.length > 0) expanders[0].click()

  let after = before
  for (let waited = 0; waited < 10000; waited += 250) {
    await sleep(250)
    after = rows()
    if (after !== before) break
  }

  const spans = [...shadow.querySelectorAll("[data-line] span")]
  const token = spans.find((one) => (one.textContent || "").trim() === ${JSON.stringify(WORD)})

  const all = [...shadow.querySelectorAll("*")]
  const tally = {}
  for (const one of all) {
    const key = one.tagName.toLowerCase() + (one.getAttribute("role") ? "[role=" + one.getAttribute("role") + "]" : "")
    tally[key] = (tally[key] || 0) + 1
  }
  const containers = document.querySelectorAll("diffs-container").length

  return {
    pane: true,
    containers,
    tally,
    lineTypes: [...new Set([...shadow.querySelectorAll("[data-line-type]")].map((o) => o.getAttribute("data-line-type")))],
    allLines: [...shadow.querySelectorAll("[data-line]")].map((o) => o.getAttribute("data-line")),
    rowsBefore: before,
    rowsAfter: after,
    revealed: after > before,
    buttons: buttons.length,
    expanders: expanders.length,
    expanderSaid: expanders.slice(0, 3).map((one) => (one.getAttribute("aria-label") || one.textContent || "").trim().slice(0, 60)),
    tokenFound: !!token,
    tokenLine: token ? token.closest("[data-line]").getAttribute("data-line") : null,
    tokenLineType: token ? (token.closest("[data-line-type]") || {}).getAttribute?.("data-line-type") ?? null : null,
    buttonSaid: buttons.slice(0, 8).map((one) => (one.getAttribute("aria-label") || one.textContent || "").trim().slice(0, 40))
  }
})()`)

console.log(JSON.stringify({ page: PAGE, seen, problems: session.problems() }, null, 2))
session.stop()
