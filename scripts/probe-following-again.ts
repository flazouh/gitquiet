/**
 * What holding the key costs the first time, and every time after.
 *
 * Reported from real use and not caught by anything here: the first hold on a
 * file waits two or three seconds for the underline, the next is instant, and
 * coming back to the same file waits all over again. Every probe in this
 * repository misses it, this one included until now — they settle the page for a
 * second or two before reaching for the key, which is a reader slower than any
 * reader and measures the answer rather than the door.
 *
 * So this measures the door: the first hold after a draw with no settling at
 * all, a second hold beside it, the same file returned to, and a hold after
 * long enough idle for MV3 to have collected the service worker and the
 * offscreen document with it.
 *
 *     bun run build && bun scripts/probe-following-again.ts [--page URL] [--word NAME] [--idle 45000]
 */
import { PANES, withExtension } from "./chrome"

const argued = (flag: string): string | undefined => {
  const at = Bun.argv.indexOf(flag)
  return at === -1 ? undefined : Bun.argv[at + 1]
}

const PAGE = argued("--page") ?? "https://github.com/flazouh/gitquiet/commit/3ecd76e"
const WORD = argued("--word") ?? "asRemembered"
/** Long enough that an idle MV3 service worker has been collected. */
const IDLE = Number(argued("--idle") ?? 45_000)
/** How long the screen is let stand before the key is reached for. The variable. */
const SETTLE = Number(argued("--settle") ?? 0)
const EXTENSION = `${import.meta.dir}/../.output/chrome-mv3`
const META = 4

const sleep = (ms: number) => new Promise((go) => setTimeout(go, ms))

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

const key = (type: "rawKeyDown" | "keyUp") =>
  session.tab.send("Input.dispatchKeyEvent", {
    type,
    key: "Meta",
    code: "MetaLeft",
    ...(type === "rawKeyDown" ? { modifiers: META } : {})
  })

/** Where the word is, aimed at its own characters inside whatever run drew it. */
const spotOf = (word: string) =>
  session.evaluate<{ x: number; y: number } | null>(`
    (async () => {
      ${PANES}
      const edge = "[^A-Za-z0-9_$]"
      const at = (text) => text.search(new RegExp("(^|" + edge + ")" + ${JSON.stringify(word)} + "(" + edge + "|$)"))
      for (const root of panes()) {
        for (const one of root.querySelectorAll("[data-line] span")) {
          if (one.children.length > 0) continue
          const text = one.textContent || ""
          if (at(text) === -1) continue
          const row = one.closest("[data-line]")
          if (row) row.scrollIntoView({ block: "center", behavior: "instant" })
          await new Promise((go) => setTimeout(go, 500))
          const box = one.getBoundingClientRect()
          if (box.width <= 0) continue
          const found = text.indexOf(${JSON.stringify(word)}, at(text))
          const wide = box.width / Math.max(1, text.length)
          return {
            x: Math.round(box.left + (found + ${JSON.stringify(word)}.length / 2) * wide),
            y: Math.round(box.top + box.height / 2)
          }
        }
      }
      return null
    })()
  `)

/**
 * A watcher inside the page that costs the page nothing.
 *
 * Two earlier versions of this measured themselves. The first polled from
 * outside, so every reading carried a round trip that walked every shadow root
 * on the page. The second moved the stopwatch into the page but kept the walk,
 * running it every sixteen milliseconds — which saturates the one thread the
 * interface needs in order to answer, and produced the same figure to within a
 * few milliseconds whether the screen had stood for zero seconds or ten. A
 * measurement that does not move when its subject moves is measuring the
 * instrument.
 *
 * So nothing is walked. A `MutationObserver` is told to report style attribute
 * changes under the panes, and the first one that lands on a node holding the
 * word is the underline appearing.
 */
const watchFor = (word: string) =>
  session.evaluate<boolean>(`
    (() => {
      ${PANES}
      if (window.__mark && window.__mark.watcher) window.__mark.watcher.disconnect()
      const wanted = ${JSON.stringify(word)}
      const marked = (node) =>
        node.nodeType === 1 &&
        (node.style.textDecoration || "") !== "" &&
        (node.textContent || "").includes(wanted)
      const watcher = new MutationObserver((changes) => {
        if (window.__mark.at !== null) return
        for (const change of changes) {
          if (change.type === "attributes" && marked(change.target)) {
            window.__mark.at = performance.now()
            return
          }
          for (const added of change.addedNodes) {
            if (marked(added)) {
              window.__mark.at = performance.now()
              return
            }
          }
        }
      })
      window.__mark = { at: null, started: performance.now(), watcher }
      for (const root of panes()) {
        watcher.observe(root, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ["style"]
        })
      }
      return true
    })()
  `)

const watched = (ceiling: number) =>
  session.evaluate<number | null>(`
    (async () => {
      const until = performance.now() + ${ceiling}
      while (window.__mark.at === null && performance.now() < until) {
        await new Promise((go) => setTimeout(go, 50))
      }
      return window.__mark.at === null ? null : Math.round(window.__mark.at - window.__mark.started)
    })()
  `)

/** Hold the key over the word and time the underline. Nothing is settled first. */
const hold = async (word: string, ceiling = 20_000): Promise<number | null> => {
  const spot = await spotOf(word)
  if (spot === null) return null
  await mouse("mouseMoved", spot.x - 60, spot.y + 40, 0)
  await key("rawKeyDown")
  // Armed before the move, so the stopwatch starts with the gesture and not
  // with the round trip that follows it.
  await watchFor(word)
  await mouse("mouseMoved", spot.x, spot.y, META)
  const underlined = await watched(ceiling)
  await key("keyUp")
  await mouse("mouseMoved", 5, 5, 0)
  await sleep(500)
  return underlined
}

const waitForPane = async () => {
  for (let tries = 0; tries < 40; tries++) {
    const drawn = await session.evaluate<boolean>(`
      (() => { ${PANES} return panes().some((root) => root.querySelector("[data-line] span")) })()
    `)
    if (drawn) return true
    await sleep(500)
  }
  return false
}

try {
  await waitForPane()
  await sleep(SETTLE)

  // No settling: the reader reaches for the key as soon as they can read the line.
  const first = await hold(WORD)
  const second = await hold(WORD)

  // Away and back, which is what a reader does with a file tree.
  await session.tab.send("Input.dispatchKeyEvent", { type: "keyDown", key: "s", code: "KeyS", text: "s" })
  await session.tab.send("Input.dispatchKeyEvent", { type: "keyUp", key: "s", code: "KeyS" })
  await sleep(2500)
  await session.tab.send("Input.dispatchKeyEvent", { type: "keyDown", key: "w", code: "KeyW", text: "w" })
  await session.tab.send("Input.dispatchKeyEvent", { type: "keyUp", key: "w", code: "KeyW" })
  await sleep(2500)
  await waitForPane()
  const returned = await hold(WORD)

  await sleep(IDLE)
  const afterIdle = await hold(WORD)

  const problems = [
    first === null ? `the first hold never underlined "${WORD}"` : null,
    first !== null && first > 1000 ? `the first hold waited ${first}ms, which a reader feels` : null,
    returned !== null && second !== null && returned > second * 3 && returned > 1000
      ? `coming back to the same file cost ${returned}ms after a warm ${second}ms, so what was opened was not kept`
      : null,
    afterIdle !== null && afterIdle > 1000
      ? `after ${Math.round(IDLE / 1000)}s idle a hold cost ${afterIdle}ms, so the door closes on its own`
      : null
  ].filter((one): one is string => one !== null)

  console.log(
    JSON.stringify(
      { page: PAGE, word: WORD, firstMs: first, secondMs: second, returnedMs: returned, afterIdleMs: afterIdle, problems },
      null,
      2
    )
  )
} finally {
  session.stop()
}
