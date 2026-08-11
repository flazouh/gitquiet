/**
 * Records what is drawn, and when, while a reader walks into a pull request and back out.
 *
 *     ego-browser nodejs < scripts/probe-flicker-dom.js
 *
 * Alex recorded the repository's pull request list flickering on the way back to it: the
 * list appears, changes, goes blank for a frame, and comes back. Frames say that much and
 * cannot say which of the two scripts drew each of them, so this asks the document.
 *
 * Every observation is a `MutationObserver` batch rather than a frame: `requestAnimationFrame`
 * is throttled in a tab nobody is looking at, and a soft navigation is exactly the moment that
 * would hide. The digest of `#gitquiet-root` is only written down when it *changes*, so the log
 * is the sequence of distinct things that were on the screen and nothing else.
 *
 * `theirs` is the measurement that matters for the gate: how much of GitHub's own page was
 * painted, in pixels, at each of those moments. A gate that works reports zero throughout,
 * and it did on every run of this: the flicker was ours, drawn twice.
 *
 * What it recorded, before the fix in `src/ui/useLive.ts`. Arriving at the list: nothing at
 * 695ms, the remembered list whole at 1010ms, the same rows with every check gone at 1423ms,
 * whole again at 1736ms. Walking out of pull request 10 back onto it: nothing at 6362ms,
 * whole at 6394ms, checks gone at 7153ms, whole again at 7619ms. After the fix, both walks
 * are one step: nothing, then the whole list, and no further change for five seconds.
 */

const HERE = "https://github.com/flazouh/ghpro-scratch/pulls"

await useOrCreateTaskSpace("probe flicker dom")
await openOrReuseTab(HERE, { wait: true, timeout: 60 })

const RECORDER = String.raw`(() => {
  const started = performance.now()
  const log = []
  const at = () => Math.round(performance.now() - started)

  const GATES = [
    "data-gitquiet-page",
    "data-gitquiet-gating",
    "data-gitquiet-revealed",
    "data-gitquiet-taken",
    "data-gitquiet-shown"
  ]

  /* Every region either script may be standing in, so "GitHub's own page" is measured
   * against all of them rather than against whichever one this page happens to use. */
  const REGIONS = [
    "#repo-content-pjax-container",
    "turbo-frame#repo-content-turbo-frame",
    '[class*="PageLayoutContent"]'
  ]

  const ours = (el) => el.id === "gitquiet-root" || el.querySelector("#gitquiet-root") !== null

  const theirs = () => {
    let painted = 0
    for (const region of REGIONS) {
      for (const el of document.querySelectorAll(region + " > *")) {
        if (ours(el)) continue
        if (el.hasAttribute("hidden")) continue
        const box = el.getBoundingClientRect()
        if (box.width > 0 && box.height > 0) painted += Math.round(box.width * box.height)
      }
    }
    return painted
  }

  const digest = () => {
    const root = document.getElementById("gitquiet-root")
    if (root === null) return { root: "gone", theirs: theirs() }
    const text = (root.innerText || "").replace(/\s+/g, " ").trim()
    return {
      root: root.getAttribute("data-gitquiet-for"),
      leaving: root.hasAttribute("data-gitquiet-leaving") ? 1 : 0,
      inDoc: root.isConnected ? 1 : 0,
      opacity: getComputedStyle(root).opacity,
      chars: text.length,
      head: text.slice(0, 90),
      theirs: theirs()
    }
  }

  let last = ""
  const drawn = (why) => {
    const now = digest()
    const key = JSON.stringify(now)
    if (key === last) return
    last = key
    log.push({ at: at(), kind: "drawn", why, ...now })
  }

  const gates = new MutationObserver((records) => {
    for (const record of records) {
      const name = record.attributeName
      log.push({
        at: at(),
        kind: "gate",
        name,
        was: record.oldValue,
        now: document.documentElement.getAttribute(name)
      })
    }
  })
  gates.observe(document.documentElement, {
    attributes: true,
    attributeOldValue: true,
    attributeFilter: GATES
  })

  const painting = new MutationObserver(() => drawn("mutation"))
  painting.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  })

  window.__flick = {
    log,
    mark: (what) => log.push({ at: at(), kind: "mark", what }),
    read: () => log
  }
  drawn("start")
  return "recording"
})()`

const dump = async (what) => {
  const log = await js(String.raw`JSON.stringify(window.__flick?.read() ?? [])`)
  console.log("\n===== " + what + " =====")
  console.log(log)
}

/*
 * A real document load every run. A tab already on this address keeps the content script
 * the extension had when it was opened, so a rebuilt extension is not the one being
 * measured — which is a whole round of measuring the previous build.
 */
await cdp("Page.reload", { ignoreCache: true })

/*
 * The cold arrival, polled from here rather than watched from in there.
 *
 * A `MutationObserver` cannot see this one: it has to be installed after the document
 * exists, and by then the interface is frequently already up. So this asks repeatedly
 * instead, and reports each distinct answer against the document's own clock — which is
 * enough to say whether the list arrives in one piece and whether it arrives at all.
 */
const cold = []
for (let round = 0; round < 60; round += 1) {
  const now = await js(String.raw`(() => {
    const root = document.getElementById("gitquiet-root")
    const text = root === null ? "" : (root.innerText || "").replace(/\s+/g, " ").trim()
    return JSON.stringify({ at: Math.round(performance.now()), chars: text.length, head: text.slice(0, 60) })
  })()`).catch(() => null)
  if (now !== null) {
    const said = JSON.parse(now)
    const last = cold.at(-1)
    if (last === undefined || last.chars !== said.chars) cold.push(said)
  }
  await wait(0.1)
}
console.log("\n===== cold load =====")
console.log(JSON.stringify(cold))

console.log(await js(RECORDER))

// Into a pull request, from the row on our own list: the soft navigation the card arrives on.
await js(String.raw`window.__flick.mark("press row #10")`)
await click('#gitquiet-root a[href="/flazouh/ghpro-scratch/pull/10"]', {
  label: "open pull request 10"
})
await wait(5)
await dump("list -> pull request")

// And back out through the bar, which is the navigation on the recording.
await js(String.raw`window.__flick.mark("press Pull requests")`)
await click('#gitquiet-bar a[href="/flazouh/ghpro-scratch/pulls"]', {
  label: "back to the list"
})
await wait(5)
await dump("pull request -> list")
