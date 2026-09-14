/**
 * What the uses card ends up saying about the rest of the repository.
 *
 * The in-file half answers in milliseconds. The half that reads the whole
 * repository is a different question with a different failure, and the card
 * says one of three things about it — reading, a count, or that it could not be
 * read. A run that stops at the press never sees which, so this one waits and
 * reports the sequence.
 *
 *     bun run build && GITQUIET_CDP_PROFILE=... bun scripts/probe-across.ts --page ... --word ... --written ...
 */
import { withExtension } from "./chrome"

const argued = (flag: string): string | undefined => {
  const at = Bun.argv.indexOf(flag)
  return at === -1 ? undefined : Bun.argv[at + 1]
}

const PAGE = argued("--page") ?? ""
const WORD = argued("--word") ?? ""
const WRITTEN = argued("--written") ?? "1"
const EXTENSION = `${import.meta.dir}/../.output/chrome-mv3`

const session = await withExtension(PAGE, EXTENSION)

const seen = await session.evaluate<unknown>(`(async () => {
  const sleep = (ms) => new Promise((go) => setTimeout(go, ms))

  const pane = async () => {
    for (let tries = 0; tries < 60; tries++) {
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
  if (!shadow) return { pane: false }

  const token = [...shadow.querySelectorAll("[data-line] span")].find((one) => (one.textContent || "").trim() === ${JSON.stringify(WORD)})
  if (!token) return { pane: true, token: false }

  const at = token.getBoundingClientRect()
  const where = {
    bubbles: true, composed: true, cancelable: true,
    clientX: at.left + at.width / 2, clientY: at.top + at.height / 2,
    metaKey: true, pointerId: 1, isPrimary: true, pointerType: "mouse"
  }

  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Meta", bubbles: true }))
  token.dispatchEvent(new PointerEvent("pointerover", where))
  token.dispatchEvent(new PointerEvent("pointermove", where))
  for (let waited = 0; waited < 20000; waited += 100) {
    if ((token.style.textDecoration || "") !== "") break
    await sleep(100)
  }
  token.dispatchEvent(new PointerEvent("pointerdown", where))
  token.dispatchEvent(new PointerEvent("pointerup", where))
  token.dispatchEvent(new MouseEvent("click", where))

  // What the card says about the repository, sampled until it stops changing.
  const said = []
  for (let waited = 0; waited < 40000; waited += 500) {
    const card = document.querySelector("dialog[open][aria-label^='Uses of']")
    const line = card ? (card.querySelector("div") || {}).innerText || "" : ""
    const now = line.replace(/\\s+/g, " ").trim().slice(0, 120)
    if (now !== "" && said[said.length - 1] !== now) said.push(now)
    await sleep(500)
  }

  return { pane: true, token: true, said }
})()`)

console.log(JSON.stringify({ page: PAGE, seen, problems: session.problems() }, null, 2))
session.stop()
