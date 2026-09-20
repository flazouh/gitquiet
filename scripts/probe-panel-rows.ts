/**
 * The Uses panel, opened, put away, and opened again.
 *
 * Three rows a QA pass keeps leaving open because each is easy to assume: that
 * a press opens the panel, that pressing away puts it back, and that doing it
 * twice works without reloading. The third is the one that catches a panel
 * which opens once and then refuses, and no unit test reaches it — the panel
 * closes on events heard at the window.
 *
 *     bun run build && bun scripts/probe-panel-rows.ts [--page URL] [--word NAME]
 */
import { PANES, withExtension } from "./chrome"

const argued = (flag: string): string | undefined => {
  const at = Bun.argv.indexOf(flag)
  return at === -1 ? undefined : Bun.argv[at + 1]
}

const PAGE = argued("--page") ?? "https://github.com/flazouh/gitquiet/blob/main/src/ledger/reaching.ts"
const WORD = argued("--word") ?? "ENDINGS"
const EXTENSION = `${import.meta.dir}/../.output/chrome-mv3`
const META = 4
const sleep = (ms: number) => new Promise((go) => setTimeout(go, ms))

const session = await withExtension(PAGE, EXTENSION)

const mouse = (type: string, x: number, y: number, modifiers: number, click = false) =>
  session.tab.send("Input.dispatchMouseEvent", {
    type,
    x,
    y,
    modifiers,
    button: click ? "left" : "none",
    clickCount: click ? 1 : 0
  })

const key = (type: "rawKeyDown" | "keyUp") =>
  session.tab.send("Input.dispatchKeyEvent", { type, key: "Meta", code: "MetaLeft", ...(type === "rawKeyDown" ? { modifiers: META } : {}) })

/** Where the word is, brought onto the screen first. */
const spotOf = () =>
  session.evaluate<{ x: number; y: number } | null>(`
    (async () => {
      ${PANES}
      for (const root of panes()) {
        for (const one of root.querySelectorAll("[data-line] span")) {
          if (one.children.length > 0) continue
          if ((one.textContent || "").trim() !== ${JSON.stringify(WORD)}) continue
          one.closest("[data-line]").scrollIntoView({ block: "center", behavior: "instant" })
          await new Promise((go) => setTimeout(go, 600))
          const box = one.getBoundingClientRect()
          if (box.width <= 0) continue
          return { x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2) }
        }
      }
      return null
    })()
  `)

/** The panel, by the label it gives itself. */
const panel = () =>
  session.evaluate<{ up: boolean; wide: number; high: number; says: string }>(`
    (() => {
      const found = document.querySelector('[aria-label^="Uses of "]')
      if (!found) return { up: false, wide: 0, high: 0, says: "" }
      const box = found.getBoundingClientRect()
      return {
        up: true,
        wide: Math.round(box.width),
        high: Math.round(box.height),
        says: (found.textContent || "").replace(/\\s+/g, " ").slice(0, 200)
      }
    })()
  `)

/** Holds the key, presses the name, and waits for the panel to be up. */
const press = async (): Promise<ReturnType<typeof panel> extends Promise<infer A> ? A : never> => {
  const spot = await spotOf()
  if (spot === null) throw new Error(`no token drew "${WORD}"`)
  await key("rawKeyDown")
  await mouse("mouseMoved", spot.x - 50, spot.y + 30, META)
  await sleep(200)
  await mouse("mouseMoved", spot.x, spot.y, META)
  // The underline first: a press before the answer is a press on a plain word.
  for (let waited = 0; waited < 20_000; waited += 250) {
    const marked = await session.evaluate<boolean>(`
      (() => {
        ${PANES}
        for (const root of panes()) {
          for (const one of root.querySelectorAll("[data-line] span")) {
            if (!(one.textContent || "").includes(${JSON.stringify(WORD)})) continue
            if ((one.style.textDecoration || "") !== "") return true
            for (const inner of one.querySelectorAll("span")) if ((inner.style.textDecoration || "") !== "") return true
          }
        }
        return false
      })()
    `)
    if (marked) break
    await sleep(250)
  }
  await mouse("mousePressed", spot.x, spot.y, META, true)
  await mouse("mouseReleased", spot.x, spot.y, META, true)
  await key("keyUp")
  for (let waited = 0; waited < 12_000; waited += 250) {
    const now = await panel()
    if (now.up) return now
    await sleep(250)
  }
  return panel()
}

const problems: Array<string> = []
try {
  for (let tries = 0; tries < 40; tries++) {
    const ready = await session.evaluate<boolean>(`(() => { ${PANES} return panes().some((r) => r.querySelector("[data-line] span")) })()`)
    if (ready) break
    await sleep(1000)
  }

  const first = await press()
  console.log("opened:", JSON.stringify(first))
  if (!first.up) problems.push("a press on the name opened no panel")
  // Sized, not merely present — a panel at 0x0 is a press that did nothing.
  else if (first.wide < 100 || first.high < 40) problems.push(`the panel opened at ${first.wide}x${first.high}`)

  // Likely is a waiting word, not an answer: where the repository proved rows,
  // none of them should still be offered as a maybe.
  if (first.up && /Likely/i.test(first.says) && /\d+ elsewhere/i.test(first.says)) {
    problems.push("the panel offers Likely rows beside proven ones")
  }

  // Pressing away puts it back.
  await mouse("mousePressed", 12, 400, 0, true)
  await mouse("mouseReleased", 12, 400, 0, true)
  await sleep(1200)
  const away = await panel()
  console.log("after pressing away:", JSON.stringify({ up: away.up }))
  if (away.up) problems.push("pressing outside the panel did not put it away")

  // And again, without reloading.
  const second = await press()
  console.log("opened again:", JSON.stringify({ up: second.up, wide: second.wide, high: second.high }))
  if (!second.up) problems.push("the panel opened once and would not open again")

  console.log(JSON.stringify({ problems, logged: session.problems().slice(0, 3) }, null, 1))
} finally {
  session.stop()
}
