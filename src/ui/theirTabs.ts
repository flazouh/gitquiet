/**
 * The way back, for a reader who is on GitHub's own pull request page.
 *
 * When the choice is GitHub's page, this extension puts nothing on the screen —
 * which would also mean nothing to press to change your mind, and a preference
 * that can only be undone from a browser's extension settings is a preference
 * that traps people. So one control goes back: at the end of their own tab row,
 * dressed as the tabs beside it, saying what it does.
 *
 * Their row and not a corner of the window, because that row is already the
 * place on this page where you choose what to look at. A floating button would
 * have been easier and would have sat on top of their page announcing itself
 * forever.
 */

export const SWITCH_ID = "gitquiet-switch"

const THEIR_TABS = '[aria-label="Pull request navigation"]'

/**
 * Where this stands on a commit's own page, which has no tab row.
 *
 * Their header there holds one action, the link off to the tree as it was at
 * this commit, and this goes beside it: the same reasoning as the tab row, in
 * the only place on that page where the reader is already offered somewhere
 * else to go. Matched on the module name in the class rather than the whole of
 * it, because the tail of it changes with every deploy.
 */
const THEIR_COMMIT_ACTION = '[class*="CommitHeader-module__browseFiles"]'

const LABEL = "Enhanced view"

/**
 * A four-pointed star, drawn here rather than imported.
 *
 * The icons this interface uses are React components, and there is no React on
 * this page — this control exists precisely because ours is not running. Eight
 * numbers in a path is a smaller price than mounting a tree to draw one glyph.
 */
const MARK =
  '<svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
  '<path fill="currentColor" d="M8 1l1.8 4.2L14 7l-4.2 1.8L8 13l-1.8-4.2L2 7l4.2-1.8Z"/>' +
  "</svg>"

const REST = "var(--button-primary-bgColor-rest, #1f883d)"
const LIT = "var(--button-primary-bgColor-hover, #1a7f37)"

/**
 * Not a tab. A tab is what you press to look at another part of the thing you
 * are already reading, and this offers a different reading of the whole of it —
 * so it is dressed as the page's one action rather than as its fifth tab, in
 * the colour GitHub keeps for the button they most want pressed.
 *
 * Their tokens, so it is their green in both themes and their green still when
 * they change what green is. The literals behind each one are only there for a
 * page that has not loaded their variables at all.
 */
const DRESS = [
  "align-items: center",
  `background: ${REST}`,
  "border: 1px solid var(--button-primary-borderColor-rest, rgba(31, 35, 40, 0.15))",
  "border-radius: 6px",
  "box-shadow: var(--shadow-resting-small, 0 1px 0 rgba(31, 35, 40, 0.04))",
  "color: var(--button-primary-fgColor-rest, #ffffff)",
  "cursor: pointer",
  "display: inline-flex",
  "font: inherit",
  "font-size: var(--text-body-size-small, 12px)",
  "font-weight: 600",
  "gap: 6px",
  "line-height: 20px",
  "margin: 0 0 0 12px",
  "padding: 3px 12px",
  "white-space: nowrap",
  // Their tabs are forty pixels tall and this is not; without it the pill
  // stretches to the full height of the strip and stops reading as a button.
  "align-self: center",
  "appearance: none"
].join("; ")

/** The whole of it, in one of its two states. */
const dressed = (lit: boolean): string => (lit ? DRESS.replace(REST, LIT) : DRESS)

const make = (target: Document, onChoose: () => void, subject: string): HTMLElement => {
  const control = target.createElement("button")
  control.id = SWITCH_ID
  control.type = "button"
  control.innerHTML = `${MARK}<span>${LABEL}</span>`
  control.title = `Read this ${subject} in the extension's own page`
  control.setAttribute("style", dressed(false))

  // Inline style beats a stylesheet, so the hover a class would have given it
  // has to be given by hand. The whole attribute is rewritten rather than the
  // one property set, because a property set to a `var()` is a property some
  // DOM implementations quietly decline to hold.
  control.addEventListener("mouseenter", () => {
    control.setAttribute("style", dressed(true))
  })
  control.addEventListener("mouseleave", () => {
    control.setAttribute("style", dressed(false))
  })
  control.addEventListener("click", (event) => {
    event.preventDefault()
    onChoose()
  })
  return control
}

/**
 * Which element actually holds the tabs.
 *
 * Not the row itself: GitHub's row is a `nav` wrapped around a flex strip, and
 * a button appended to the `nav` lands on a line of its own underneath the
 * tabs. The strip is whatever their tab links have for a parent, which is true
 * of the page they ship today and of a page where they wrap each link in a
 * list item tomorrow.
 */
const stripOf = (row: Element): Element => {
  const first = row.querySelector("a")
  const parent = first?.parentElement
  if (parent === null || parent === undefined) return row

  // Their links wrapped in list items: ours wants the list, and an item of its
  // own, rather than to be a second link inside somebody else's item.
  return parent.tagName === "LI" ? (parent.parentElement ?? row) : parent
}

/**
 * Keeps the way back on the page for as long as GitHub's page is the one being
 * read, and hands back the way to withdraw it.
 *
 * Their row is rendered by React after the document is parsed, replaced
 * wholesale on a soft navigation, and rearranged whenever they feel like it, so
 * placing this once would place it on a node that is thrown away a second
 * later. The observer only does anything when what was planted is no longer in
 * the document, which is both the test for "React replaced the row" and the
 * reason a page churning away underneath this does not accumulate buttons.
 */
export const offerOurPage = (target: Document, onChoose: () => void): (() => void) => {
  let planted: Element | null = null

  const place = (): void => {
    if (planted !== null && planted.isConnected) return

    const row = target.querySelector(THEIR_TABS)

    // No tab row means a commit's page, where the way back goes next to the one
    // action their header carries. Nowhere at all means a page that has not
    // finished arriving, and the observer below asks again when it has.
    if (row === null) {
      const action = target.querySelector(THEIR_COMMIT_ACTION)
      const beside = action?.parentElement
      if (beside === null || beside === undefined) return

      const control = make(target, onChoose, "commit")
      beside.append(control)
      planted = control
      return
    }

    const holder = stripOf(row)
    const control = make(target, onChoose, "pull request")

    if (holder.tagName !== "UL" && holder.tagName !== "OL") {
      holder.append(control)
      planted = control
      return
    }

    // A list of tabs is a list, and a button loose among its items is a list a
    // screen reader reads wrongly.
    const item = target.createElement("li")
    const beside = holder.lastElementChild
    if (beside !== null && beside.className !== "") item.className = beside.className
    else item.setAttribute("style", "display: inline-flex; align-items: center")
    item.append(control)
    holder.append(item)
    planted = item
  }

  place()

  const watcher = new MutationObserver(place)
  watcher.observe(target.documentElement, { childList: true, subtree: true })

  return () => {
    watcher.disconnect()
    planted?.remove()
    planted = null
  }
}
