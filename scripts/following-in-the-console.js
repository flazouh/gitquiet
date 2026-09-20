/*
 * Following, reported from the reader's own browser.
 *
 * Paste this into DevTools on a pull request's Files page, with the extension
 * running. It presses names the way a reader does and says what happened.
 *
 * It exists because the probes cannot get here. A pull request is drawn from
 * routes that answer to a session, so a fresh profile gets the signed-out card —
 * measured on a public pull request, not assumed — and the machine this was
 * written on has no display to sign one in with. The browser already looking at
 * the page has both.
 *
 * The first run of this found that a press *does* open the panel on a diff, for
 * a name written in the file being read — which is the opposite of what was
 * reported. So this one watches what happens next: the panel closes on a press
 * outside it and on any scroll that did not start inside it, and that second
 * rule is listening in the capture phase on `window`, where it hears a scroll
 * from anywhere on the page. A panel that opens and is taken away a moment
 * later is, to a reader, a click that did nothing.
 *
 * Edit NAMES, paste, read. Nothing is sent anywhere; it prints to the console.
 *
 * What this cannot tell you: whether a hand can reach the name. Every gesture
 * below is dispatched at the token element, which skips hit-testing entirely —
 * so a name under an overlay, in a pane that is not the live one, or on a line
 * nothing can point at, answers here exactly as a reachable one does. A QA pass
 * spent an afternoon on the gap between the two. `scripts/probe-following-
 * pointer.ts` sends Chrome's own pointer and reports both numbers side by side;
 * use it when the question is "does this work", and this when the question is
 * "why did it stop working" on a page only a session can reach.
 */
;(async () => {
  /** The names to press, as a reader would, and the line each is on. */
  const NAMES = [
    { word: "readBodyWithinLimit", line: 12 },
    { word: "BodyReadFailure", line: 5 }
  ]

  /** How long to watch the panel after it opens, for it to be taken away. */
  const WATCH = 6000

  const sleep = (ms) => new Promise((go) => setTimeout(go, ms))
  const panelNow = () => document.querySelector('[aria-label^="Uses of "]')

  const panes = () => {
    const found = []
    const walk = (node) => {
      for (const el of node.querySelectorAll("*")) {
        if (!el.shadowRoot) continue
        if (el.tagName.toLowerCase() === "diffs-container") found.push(el.shadowRoot)
        else walk(el.shadowRoot)
      }
    }
    walk(document)
    return found
  }

  const drawn = panes()
  if (drawn.length === 0) {
    console.log("%cno pane drew at all", "color:#f85149")
    return
  }

  /*
   * Everything that could take the panel away, in the order it happens.
   *
   * The same two events the panel itself listens for, on the same targets and
   * in the same phase, so what is logged here is what it heard.
   */
  const heard = []
  const note = (what) => (event) => {
    const target = event.target
    const named =
      target === document ? "document"
      : target === window ? "window"
      : target && target.nodeType === 1
        ? target.tagName.toLowerCase() + (target.id ? "#" + target.id : "") +
          (typeof target.className === "string" && target.className ? "." + target.className.split(" ")[0] : "")
        : String(target)
    heard.push({ at: Math.round(performance.now()), what, from: named })
  }
  const onScroll = note("scroll")
  const onDown = note("pointerdown")
  window.addEventListener("scroll", onScroll, true)
  document.addEventListener("pointerdown", onDown, true)

  const edge = "[^A-Za-z0-9_$]"

  const press = async ({ word, line }) => {
    const out = { name: `${word} @ L${line}` }

    let row = null, token = null, inside = -1
    for (const root of drawn) {
      for (const one of root.querySelectorAll(`[data-line="${line}"]`)) {
        for (const span of one.querySelectorAll("span")) {
          if (span.querySelector("span")) continue
          const text = span.textContent || ""
          const at = text.search(new RegExp(`(^|${edge})${word}(${edge}|$)`))
          if (at === -1) continue
          row = one; token = span; inside = text.indexOf(word, at)
          break
        }
        if (token) break
      }
      if (token) break
    }
    if (!token) {
      out.result = "the renderer drew no token holding that word on that line"
      return out
    }

    row.scrollIntoView({ block: "center", behavior: "instant" })
    await sleep(600)

    const box = token.getBoundingClientRect()
    const text = token.textContent || ""
    const wide = box.width / Math.max(1, text.length)
    const where = {
      bubbles: true, composed: true, cancelable: true,
      clientX: box.left + (inside + word.length / 2) * wide,
      clientY: box.top + box.height / 2,
      metaKey: true, ctrlKey: true, button: 0, buttons: 1,
      pointerId: 1, isPrimary: true, pointerType: "mouse"
    }

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Meta", bubbles: true }))
    token.dispatchEvent(new PointerEvent("pointerover", where))
    token.dispatchEvent(new PointerEvent("pointermove", where))

    let underlined = false
    for (let waited = 0; waited < 15000; waited += 50) {
      const marked = (el) => (el.style.textDecoration || "") !== ""
      if (marked(token) || [...token.querySelectorAll("span")].some(marked)) { underlined = true; break }
      await sleep(50)
    }
    out.underlined = underlined
    if (!underlined) {
      out.result = "held the key and it never underlined"
      return out
    }

    /*
     * The whole sequence a real mouse sends, not the three events a script
     * usually bothers with. `mousedown` is the one a script leaves out and a
     * hand never does, and it is what the drawing underneath acts on — a line
     * marked, a selection begun, and whatever scrolling either causes.
     */
    heard.length = 0
    const started = Math.round(performance.now())
    token.dispatchEvent(new PointerEvent("pointerdown", where))
    token.dispatchEvent(new MouseEvent("mousedown", where))
    token.dispatchEvent(new PointerEvent("pointerup", { ...where, buttons: 0 }))
    token.dispatchEvent(new MouseEvent("mouseup", { ...where, buttons: 0 }))
    token.dispatchEvent(new MouseEvent("click", { ...where, buttons: 0 }))

    let opened = null
    for (let waited = 0; waited < 8000; waited += 50) {
      const found = panelNow()
      if (found) { opened = Math.round(performance.now()) - started; break }
      await sleep(50)
    }
    if (opened === null) {
      out.result = "no panel ever appeared"
      out.heard = heard.slice(0, 6)
      return out
    }

    // It opened. Does it survive being looked at?
    let gone = null
    for (let waited = 0; waited < WATCH; waited += 50) {
      if (!panelNow()) { gone = Math.round(performance.now()) - started; break }
      await sleep(50)
    }

    out.result = gone === null
      ? `opened after ${opened}ms and stayed for ${WATCH}ms`
      : `opened after ${opened}ms and was GONE by ${gone}ms`
    out.heard = heard
      .filter((one) => one.at - started >= 0 && (gone === null || one.at - started <= gone + 100))
      .map((one) => `${one.at - started}ms ${one.what} from ${one.from}`)
      .slice(0, 10)

    document.dispatchEvent(new KeyboardEvent("keyup", { key: "Meta", bubbles: true }))
    document.body.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, composed: true, pointerId: 1, isPrimary: true, pointerType: "mouse" })
    )
    await sleep(400)
    return out
  }

  try {
    const seen = []
    for (const one of NAMES) seen.push(await press(one))
    for (const one of seen) {
      console.log(`%c${one.name}`, "font-weight:bold")
      console.log(`   underlined: ${one.underlined}`)
      console.log(`   result: ${one.result}`)
      if (one.heard && one.heard.length > 0) {
        console.log(`   heard while it was up:`)
        for (const line of one.heard) console.log(`      ${line}`)
      } else if (one.heard) {
        console.log(`   heard while it was up: nothing`)
      }
    }
    console.log(seen)
  } finally {
    window.removeEventListener("scroll", onScroll, true)
    document.removeEventListener("pointerdown", onDown, true)
  }
})()
