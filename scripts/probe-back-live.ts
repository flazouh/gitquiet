import { withExtension } from "./chrome"

/**
 * Presses the flow the navigation audit was about, on github.com itself: stand
 * on a repository's list, click a pull request, press the browser's own Back,
 * and check the list that comes back is the tree that left — not a rebuild.
 *
 * Three facts are measured, and they are the audit's whole claim:
 *
 *   1. `samePage` — Back never loaded a document. A flag set on `window` before
 *      the press is still there after it, so GitHub's router was cancelled and
 *      the traversal stayed in this document.
 *   2. `resumed` — the exact element that was the list before the click is the
 *      element on the page after Back. Identity, not resemblance: a rebuild
 *      makes a new node, a resume reattaches the old one.
 *   3. `backMs` — how long Back took to have the list's rows on the page.
 *
 * Then Back and Forward are mashed twice more each way, and the page must end
 * with exactly one root standing.
 *
 * Run it after `bun run build`:
 *
 *     bun scripts/probe-back-live.ts
 *     bun scripts/probe-back-live.ts --list https://github.com/owner/repo/pulls
 *
 * Signed out on purpose, like `verify-on-github.ts`: a public repository's list
 * and pull requests stand without a session.
 */

const argumentAfter = (flag: string): string | undefined => {
  const at = Bun.argv.indexOf(flag)
  return at === -1 ? undefined : Bun.argv[at + 1]
}

const LIST = argumentAfter("--list") ?? "https://github.com/microsoft/vscode/pulls"

const session = await withExtension(LIST, `${import.meta.dir}/../.output/chrome-mv3`)

const sleep = (ms: number) => new Promise((rest) => setTimeout(rest, ms))

/** Waits until the page says something true, up to `seconds`. */
const until = async (question: string, seconds: number): Promise<boolean> => {
  const deadline = Date.now() + seconds * 1000
  while (Date.now() < deadline) {
    if (await session.evaluate<boolean>(question)) return true
    await sleep(100)
  }
  return false
}

const ROWS = `document.querySelectorAll("#gitquiet-root a[href*='/pull/']").length > 3`

const fail = (why: string): never => {
  console.error(`✗ ${why}`)
  for (const problem of session.problems()) console.error(`  page: ${problem}`)
  session.stop()
  process.exit(1)
}

// 1. The list stands, drawn by us.
if (!(await until(ROWS, 45))) fail("the list screen never stood on the page")

// The two identities Back has to preserve: the document, and the list's tree.
await session.evaluate(`
  window.__gitquietProbeDocument = true
  window.__gitquietProbeList = document.getElementById("gitquiet-root")
  undefined
`)

// 2. Press the first pull request row in a reader's order: the pointer arrives,
//    rests a beat — which is what earns the warm-up — presses, and releases.
const clicked = await session.evaluate<string | null>(`
  (() => {
    const row = document.querySelector("#gitquiet-root a[href*='/pull/']")
    if (row === null) return null
    for (const kind of ["pointerover", "pointerenter", "pointermove"]) {
      row.dispatchEvent(new PointerEvent(kind, { bubbles: true }))
    }
    window.__gitquietProbeRow = row
    return row.getAttribute("href")
  })()
`)
if (clicked === null) fail("no pull request row to click")
await sleep(600)
await session.evaluate(`
  (() => {
    const row = window.__gitquietProbeRow
    row.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }))
    row.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }))
    row.click()
  })()
`)
console.log(`pressed: ${clicked}`)

if (!(await until(`location.pathname.includes("/pull/")`, 20))) {
  fail("the press never moved the address")
}
if (
  !(await until(
    `(document.getElementById("gitquiet-root")?.textContent ?? "").length > 200`,
    30
  ))
) {
  fail("the pull request screen never drew")
}
// Whether the press itself stayed in this document — a press that fell to the
// full-load repair contaminates everything Back is then asked about.
const sameDocumentAfterPress = await session.evaluate<boolean>(
  `window.__gitquietProbeDocument === true`
)
console.log(JSON.stringify({ sameDocumentAfterPress }))
// Let the arriving screen finish settling, as a reader reading it would.
await sleep(2000)

// What is armed at the moment Back is pressed, which decides everything after.
// The meta is DOM and both worlds see it; the screen cache lives in the
// extension world's view of `window`, so it is asked for there.
const armed = await session.evaluate<{
  readonly meta: string | null
  readonly navigationApi: boolean
}>(`
  (() => ({
    meta:
      document.querySelector('meta[name="data-gitquiet-prepared-traversal-route"]')
        ?.getAttribute("content") ?? null,
    navigationApi: typeof window.navigation?.addEventListener === "function"
  }))()
`)
const cachedRoots = await session
  .evaluateInExtension<ReadonlyArray<string>>(
    `[...(window.gitquietScreens?.keys?.() ?? [])]`
  )
  .catch(() => "unreadable" as const)
console.log(JSON.stringify({ armed, cachedRoots }, null, 2))

// 3. The browser's own Back.
const pressedAt = Date.now()
await session.evaluate(`history.back()`)
const cameBack = await until(
  `!location.pathname.includes("/pull/") && ${ROWS}`,
  20
)
const backMs = Date.now() - pressedAt
if (!cameBack) fail("Back never put the list back on the page")

const found = await session.evaluate<{
  readonly samePage: boolean
  readonly resumed: boolean
  readonly roots: number
}>(`
  (() => ({
    samePage: window.__gitquietProbeDocument === true,
    resumed: document.getElementById("gitquiet-root") === window.__gitquietProbeList,
    roots: document.querySelectorAll("#gitquiet-root").length
  }))()
`)

console.log(JSON.stringify({ backMs, sameDocumentAfterPress, ...found }, null, 2))

// 4. Mash Forward and Back twice more each way; the page must end whole.
for (const way of ["forward", "back", "forward", "back"] as const) {
  await session.evaluate(`history.${way}()`)
  await sleep(700)
}
const after = await session.evaluate<{ readonly roots: number; readonly rows: boolean }>(`
  (() => ({
    roots: document.querySelectorAll("#gitquiet-root").length,
    rows: ${ROWS}
  }))()
`)
console.log(JSON.stringify({ afterMashing: after }, null, 2))

const FAILURES: ReadonlyArray<readonly [string, boolean]> = [
  ["the press itself fell to the full-load repair", !sameDocumentAfterPress],
  [
    "Back loaded a whole document instead of staying in this one",
    sameDocumentAfterPress && !found.samePage
  ],
  [
    "Back rebuilt the list rather than resuming the tree that left",
    sameDocumentAfterPress && found.samePage && !found.resumed
  ],
  ["more than one root stood after Back", found.roots !== 1],
  ["mashing Back and Forward left the page without its one list", after.roots !== 1 || !after.rows]
]

let failed = false
for (const [why, wrong] of FAILURES) {
  if (!wrong) continue
  failed = true
  console.error(`✗ ${why}`)
}
if (!failed) console.log(`✓ Back resumed the same tree in ${backMs}ms, and mashing left one root`)

session.stop()
process.exit(failed ? 1 : 0)
