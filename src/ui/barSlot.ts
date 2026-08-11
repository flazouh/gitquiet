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
 * Their bar is not removed, only hidden, and hidden by the presence of this element rather
 * than by an attribute: `html:has(#gitquiet-bar)`. That way the page can never be left with no
 * bar at all, which is what a rule keyed on "we are taking over" would do for as long as the
 * takeover took.
 */
export const theBarSlot = (page: Document, within?: HTMLElement | undefined): HTMLElement => {
  const held = within ?? page.body
  const standing = within === undefined ? page.getElementById(BAR_ID) : firstBarIn(within)
  if (standing !== null) return standing

  const slot = page.createElement("div")
  /*
   * The id only for the page's own bar.
   *
   * `gates.bar.css` hides GitHub's nav with `html:has(#gitquiet-bar)`, and `theirNav`
   * rules the bar out by the same name when it reads theirs. Both are statements about
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
  return slot
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
  const held = within ?? page.body
  const watch = new MutationObserver(() => {
    if (slot.isConnected) return
    held.insertBefore(slot, held.firstChild)
  })

  watch.observe(held, { childList: true })
  return () => watch.disconnect()
}
