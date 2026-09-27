import { OUTSIDE } from "./outside"

/** Where our bar stands. Named here because `theirNav` has to rule it out when reading theirs. */
export const BAR_ID = "gitquiet-bar"

/**
 * The same thing said as an attribute, for the bars that are not the page's.
 *
 * There is one bar on GitHub and it can have an id. There are twelve on the landing
 * page, each inside its own screen, and an id cannot be in a document twice. So the
 * stylesheets key off `:is(#gitquiet-bar, [data-gitquiet-bar])`, the way every other
 * rule of ours already keys off `:is(#gitquiet-root, [data-gitquiet-outside])`. The
 * `:is()` matters beyond being shorter: it takes the specificity of its most specific
 * argument, so the attribute half still weighs an id and still beats GitHub's own
 * unlayered element rules.
 */
export const BAR_MARK = "data-gitquiet-bar"

/**
 * The same fact written on the document, for the rules that hide GitHub's bar.
 *
 * `gates.bar.css` and `glass.css` used to ask `html:has(#gitquiet-bar)`, which is
 * true and expensive: a `:has()` whose subject is `html` marks the whole document
 * as affected, and every change anywhere in it then restyles everything. The
 * attribute says the same thing for the price of a lookup — see `WITHIN` in
 * `mount.ts`, which is the same repair one element lower.
 *
 * Written when the page's own slot is made and never taken off, exactly as the
 * element itself is: the rules key on there being somewhere for a bar to stand,
 * so that the page is never left with neither bar.
 */
export const BAR_ON_PAGE = "data-gitquiet-bar-standing"

/**
 * How `glass.css` and `quiet.css` open every rule about the bar.
 *
 * Here rather than only in the stylesheets because `glass.test.ts` reads those rules by
 * the selector that opens them, and a test that writes the selector out again is a test
 * that passes while the sheet says something else.
 */
export const BAR_AT = `:is(#${BAR_ID}, [${BAR_MARK}])`

/**
 * The element our bar is rendered into, made once per document.
 *
 * The first child of `body`, above everything of theirs, rather than inside the element their
 * own bar lives in. Their header sits inside a `react-partial` that hydrates and re-renders,
 * and a node of ours inside it is a node their React can drop between two frames — a bar that
 * vanishes on a soft navigation and comes back on a reload is the kind of fault nobody can
 * reproduce on purpose.
 *
 * In `body` rather than inside the host, which is where the screens stand. The rule that hides
 * their page spares anything marked {@link OUTSIDE}, and this is marked — so the bar is exempt
 * where a plain box of theirs is not. A prototype of the host hid the bar and read as proof it
 * had to move inside; the rule it was tested against had no exemption in it, and the real one
 * always did.
 *
 * Their bar is not removed, only hidden, and hidden by there being somewhere for ours to stand
 * rather than by the takeover having started: {@link BAR_ON_PAGE} is written when this element
 * is. That way the page can never be left with no bar at all, which is what a rule keyed on "we
 * are taking over" would do for as long as the takeover took.
 */
/**
 * The page's own slot, remembered by every copy of this module.
 *
 * Found by id alone, a slot Turbo had just carried off with the old `body` was not found,
 * and a second one was made; the keeper then put the first back beside it. Measured on a
 * press from a repository to one of its commits: two slots, then three, and GitHub's React
 * stuck committing under them. So the slot is remembered and put back, as the host is.
 */
const SLOTS = Symbol.for("gitquiet.barSlots")
const slots: WeakMap<Document, HTMLElement> = ((globalThis as { [SLOTS]?: WeakMap<Document, HTMLElement> })[
  SLOTS
] ??= new WeakMap())

export const theBarSlot = (page: Document, within?: HTMLElement | undefined): HTMLElement => {
  const held: ParentNode = within ?? page.body
  // Said of the document whichever call makes it true, including the one that
  // finds a slot already standing: the rules that hide GitHub's bar read this
  // rather than the element, and a second interface arriving must not leave the
  // page with both bars. See {@link BAR_ON_PAGE}.
  if (within === undefined) page.documentElement.setAttribute(BAR_ON_PAGE, "")
  const standing =
    within === undefined ? (page.getElementById(BAR_ID) ?? slots.get(page) ?? null) : firstBarIn(within)
  if (standing !== null) {
    if (!standing.isConnected) held.insertBefore(standing, held.firstChild)
    return standing
  }

  const slot = page.createElement("div")
  /*
   * The id only for the page's own bar.
   *
   * `gates.bar.css` hides GitHub's nav on `html[data-gitquiet-bar-standing]`, and `theirNav`
   * rules the bar out by this name when it reads theirs. Both are statements about
   * the one bar standing on a page of GitHub's. A screen mounted inside another page —
   * the landing page draws twelve — must not claim either, and cannot repeat an id
   * anyway. The mark is on both, and the stylesheets key off both.
   */
  if (within === undefined) slot.id = BAR_ID
  slot.setAttribute(BAR_MARK, "")
  // Marked, so the stylesheet resets it and the theme paints it: see `outside.ts`.
  slot.setAttribute(OUTSIDE, "")
  /*
   * Sticky rather than fixed: fixed takes the bar out of the flow, and GitHub's page would
   * then start underneath it — with their own bar hidden there is nothing holding the space.
   */
  slot.style.position = "sticky"
  slot.style.top = "0"
  slot.style.zIndex = "30"
  held.insertBefore(slot, held.firstChild)
  if (within === undefined) {
    slots.set(page, slot)
    markWhileABarStands(page, slot)
  }
  return slot
}

/**
 * Keeps {@link BAR_ON_PAGE} true exactly while a bar of ours is in the page's slot.
 *
 * The mark is what hides their header, and it was written once and never taken off. A
 * press from one of our screens to a page of theirs, a file's history for one, took our
 * bar down and left the mark: a page with no header at all. Written when the slot is made
 * as well, so their header never shows for the frame before our bar renders into it.
 */
const markWhileABarStands = (page: Document, slot: HTMLElement): void => {
  new MutationObserver(() => {
    page.documentElement.toggleAttribute(BAR_ON_PAGE, slot.children.length > 0)
  }).observe(slot, { childList: true })
}

/** The bar already standing in this container, which is the one this container's screen made. */
const firstBarIn = (within: HTMLElement): HTMLElement | null =>
  within.querySelector<HTMLElement>(`:scope > [${BAR_MARK}]`)

/**
 * How long a bar is held for a screen that has left, waiting for the next one.
 *
 * Eighty milliseconds is what the arriving screen took to render its bar, measured on
 * bun's Actions list. This is that with room, and short enough that a reader going to a
 * page of GitHub's — where no bar is coming at all — cannot notice the difference.
 */
const HANDOVER = 400

/**
 * Said by a bar as it goes up, on the document rather than to anyone in particular.
 *
 * The screens are separate bundles and share nothing but the page, so this is how the one
 * arriving tells the one leaving that the page has a bar again. See {@link SCREEN_MOVED}
 * in `mount.ts`, which is the same arrangement for the same reason.
 */
export const BAR_STANDING = "gitquiet:bar-standing"

/** Said by {@link TheBar} on every render where it is the bar the page is showing. */
export const theBarStands = (page: Document): void => {
  page.documentElement.dispatchEvent(new CustomEvent(BAR_STANDING))
}

/**
 * Says when the bar of the screen leaving may come down.
 *
 * Which is when another one is standing, and not when the screen it belongs to lost the
 * page: those are eighty milliseconds apart, and in between the slot is empty. An empty
 * slot is not a smaller bar, it is no bar — the page under it moves up by the height of
 * one and back down again, in the middle of a press.
 *
 * The cap is for the reader who left for a page of GitHub's, where no bar is coming and
 * waiting for one would hold ours over their page.
 */
export const whenAnotherBarStands = (
  page: Document,
  ready: () => void,
  patience: number = HANDOVER
): void => {
  const slot = page.getElementById(BAR_ID)
  // Nothing of ours is in there, so there is nothing to hold and nothing to wait for.
  if (slot === null || slot.children.length === 0) {
    ready()
    return
  }

  const finish = () => {
    clearTimeout(timer)
    page.documentElement.removeEventListener(BAR_STANDING, finish)
    ready()
  }
  const timer = setTimeout(finish, patience)
  page.documentElement.addEventListener(BAR_STANDING, finish)
}

/**
 * Puts the slot back if anything takes it off the document.
 *
 * GitHub replaces large parts of `body` on a soft navigation, and while this element sits
 * above all of it, "above all of it" is a claim about their markup rather than a guarantee.
 * The cost of being wrong is the whole bar; the cost of watching is one callback per mutation
 * of `body`'s own child list.
 */
export const keepTheBarSlot = (
  page: Document,
  slot: HTMLElement,
  within?: HTMLElement | undefined
): (() => void) => {
  /*
   * Watched only where something else is rewriting the children. GitHub does, on every
   * soft navigation. A screen inside a page of ours is put there by React and stays,
   * and watching for a replacement that cannot come would be a callback on every render
   * of the tree above it.
   */
  /*
   * `body` asked for each time, never kept. A Turbo visit replaces `body` itself, and a
   * keeper holding the old one put the slot back into a detached node, heard its own
   * insert and did it again: a microtask loop that froze the tab. Measured on a press
   * from a repository's commits to one commit.
   */
  const heldNow = (): ParentNode => within ?? page.body
  let watched: ParentNode | null = null
  const putBack = (): void => {
    const held = heldNow()
    if (held !== watched) {
      watched = held
      watch.observe(held, { childList: true })
    }
    if (slot.isConnected || !held.isConnected) return
    // Not over a page handed to GitHub. See {@link takeTheBarDown}.
    if (within === undefined && !page.documentElement.hasAttribute(BAR_ON_PAGE)) return
    // And never beside another: one page, one slot.
    if (within === undefined && page.getElementById(BAR_ID) !== null) return
    held.insertBefore(slot, held.firstChild)
  }
  const watch = new MutationObserver(putBack)
  // The document's own children, which is where a swapped `body` shows up.
  if (within === undefined) watch.observe(page.documentElement, { childList: true })

  /*
   * At once, and not only on the next change.
   *
   * A screen kept live for a traversal comes back with the slot it drew into
   * already off the page — whatever took the outgoing screen down took the slot
   * with it, and this keeper is only set up again when the screen resumes. An
   * observer answers changes that come after it, so a slot that was detached
   * before it started would never be put back: the resumed screen portalled its
   * bar into a node nothing was looking at, and the page came back with no bar.
   */
  putBack()

  return () => watch.disconnect()
}

/**
 * Gives GitHub its own bar back, for a page handed over to them.
 *
 * {@link BAR_ON_PAGE} is what hides their header, so it cannot outlive our bar. Measured on
 * a pull request: after "Leave GitQuiet" their header stayed hidden and an empty slot of ours
 * sat at the top of their page. The slot goes only when nothing of ours is in it: a bar still
 * drawn there is a bar a screen is still using.
 */
export const takeTheBarDown = (page: Document): void => {
  page.documentElement.removeAttribute(BAR_ON_PAGE)
  const slot = page.getElementById(BAR_ID)
  if (slot === null) return
  // The screen handing over unmounts its bar a moment after this, so the slot is
  // taken off once it is empty, unless a bar has stood up on the page again since.
  const goIfEmpty = (): boolean => {
    if (slot.children.length > 0) return false
    if (!page.documentElement.hasAttribute(BAR_ON_PAGE)) slot.remove()
    return true
  }
  if (goIfEmpty()) return
  const watch = new MutationObserver(() => {
    if (goIfEmpty()) watch.disconnect()
  })
  watch.observe(slot, { childList: true })
}
