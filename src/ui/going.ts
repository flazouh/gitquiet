import { Effect } from "effect"
import { BAR_ID } from "./barSlot"
import { holdTheSurface, ROOT_ID, theScreenOnThePage } from "./mount"
import type { Stop } from "./navigation"

/**
 * Moving from one of this extension's screens to another, without asking GitHub
 * for a page.
 *
 * A press on a row of ours used to cost a document: the browser threw the page
 * away, GitHub spent about nine hundred milliseconds composing a new one, and the
 * first thing the arriving screen did was hide almost all of it. Nothing a screen
 * here draws comes out of that HTML — a card is read from GitHub's API — so the
 * document was work nobody ever saw, paid for in front of a reader who had already
 * said where they wanted to be.
 *
 * The address still moves. It is the address of the thing on the screen, and the
 * back button, a copied link, a reload and the browser's own history all have to
 * mean exactly what they say. What does not happen is the fetch.
 *
 * Everything that touches history lives in this file. A screen says where the
 * reader is going; it never says how.
 */

type World = Window & { gitquietOwnRows?: true }

/**
 * How long the screen being gone to has to appear before the address is made
 * honest the slow way.
 *
 * Generously longer than it takes. The screen replacing this one is a separate
 * content script the shell fetches on the press, and it stands on the page
 * within about a fifth of a second — but it is a separate script, so it can fail
 * to arrive at all, and an address pointing at a page nobody drew is the worst
 * of the outcomes here. See {@link goTo}.
 */
const ARRIVING = 1_500

/**
 * Whether the screen on the page is one of ours, drawing rows of its own.
 *
 * Declared by that screen for as long as it is up, rather than worked out at each
 * press, because of when it is read: the shell asks for the next screen on
 * `pointerdown`, so by the time a handler inside a React tree could say anything
 * the screen that needed to hear it has already started. Kept on the window that
 * every content script of this extension shares — GitHub's own page cannot see it.
 */
export const drawingOurOwnRows = (target: Window, ours: boolean): void => {
  if (ours) (target as World).gitquietOwnRows = true
  else delete (target as World).gitquietOwnRows
}

export const ourOwnRowsDrawn = (target: Window): boolean =>
  (target as World).gitquietOwnRows === true

/**
 * The browser's own account of where this tab has been.
 *
 * `history` will not say. It answers a count and nothing else, so a control built
 * on it can offer one step in each direction and can never list the places behind
 * — which is the whole of what a reader asking for "five back" wants. The
 * Navigation API answers with the entries themselves.
 *
 * Read off the window rather than declared as a global, because it is Chrome's and
 * this file is also compiled for tests in a runtime that has none. Every field is
 * optional for the same reason: what a version of the browser answers is its
 * business, and {@link theTrail} falls back to the count when anything is missing.
 *
 * Verified from inside a content script, which was the doubt: the isolated world a
 * screen of ours runs in sees the same entries, the same index, and a `pushState`
 * of ours appears among them. What it does not see is the state on an entry, so
 * nothing here reads one — a row is named from its address.
 */
type Entry = {
  readonly key?: string
  readonly url?: string | null
  readonly index?: number
}

type Traversal = {
  readonly committed?: PromiseLike<unknown>
  readonly finished?: PromiseLike<unknown>
}

type TheirNavigation = {
  readonly entries?: () => ReadonlyArray<Entry>
  readonly currentEntry?: Entry | null
  readonly canGoBack?: boolean
  readonly canGoForward?: boolean
  readonly traverseTo?: (key: string) => Traversal | undefined
  readonly addEventListener?: (name: string, heard: () => void) => void
  readonly removeEventListener?: (name: string, heard: () => void) => void
}

const theirNavigation = (target: Window): TheirNavigation | undefined =>
  (target as unknown as { navigation?: TheirNavigation }).navigation

/** One place the reader has been, as the menu behind the back button draws it. */
export type Step = {
  /** The address, path and search, which is what names the row and fills its href. */
  readonly at: string
  /** The entry, where the browser named it, so the jump is to that entry and not a count. */
  readonly key?: string
  /** How many entries back it is, for going there without a key. */
  readonly back: number
}

/** Where the reader can go from here, in both directions. */
export type Trail = {
  /** Whether there is anywhere behind this page. */
  readonly back: boolean
  /** Whether there is anywhere ahead, which there is only once the reader has gone back. */
  readonly forward: boolean
  /**
   * The places behind, nearest first, at most {@link HOW_FAR} of them.
   *
   * Empty where the browser will not list them, which leaves the two buttons
   * working and no menu to open.
   */
  readonly behind: ReadonlyArray<Step>
}

/**
 * How many places back the menu offers.
 *
 * Eight, against Chrome's own twelve. A menu is read at a glance and the reason a
 * reader opens this one is to skip two or three pages at once, not to audit an
 * afternoon: the entry twelve back is quicker to reach by pressing the row that
 * names the repository than by finding it in a column.
 */
const HOW_FAR = 8

/**
 * The path and search of one entry, or nothing where there is no page in it.
 *
 * Cut off the front rather than parsed. `new URL` throws on the entries a tab has
 * that are not pages — `about:blank` is the first entry of a tab opened empty — and
 * a throw is a failure this has no way to report. Anything that does not come out
 * of this as a path is not somewhere a reader can be sent back to.
 */
const addressOfEntry = (url: string | null | undefined): string | undefined => {
  if (url === undefined || url === null || url === "") return undefined

  const address = url.replace(/^(?:https?:)?\/\/[^/]+/, "").replace(/#.*$/, "")
  return address.startsWith("/") ? address : undefined
}

/**
 * Where the reader can go from here, read once and handed to the bar.
 *
 * One address appears once, nearest first. The same page is often several entries
 * — their router replaces an entry for a filter, a heading or a scroll position,
 * and a reader who walks a stack visits the same list between each layer — and a
 * menu offering the Working Set five times says nothing five times. Whichever of
 * those entries is nearest is the one worth going to, so the first reading of an
 * address wins and the rest are dropped.
 *
 * The count is still the answer where the entries cannot be read: `back` stays
 * true, `forward` stays false, and no menu is offered. Nothing here guesses at a
 * forward entry from a count, because a count includes them and cannot say so.
 */
export const theTrail = (target: Window): Trail => {
  const nav = theirNavigation(target)
  const entries = nav?.entries?.()
  const here = nav?.currentEntry?.index

  if (nav === undefined || entries === undefined || here === undefined || here < 0) {
    return { back: target.history.length > 1, forward: false, behind: [] }
  }

  const behind: Array<Step> = []

  for (let at = here - 1; at >= 0 && behind.length < HOW_FAR; at -= 1) {
    const address = addressOfEntry(entries[at]?.url)
    if (address === undefined) continue
    if (behind.some((one) => one.at === address)) continue

    behind.push({ at: address, key: entries[at]?.key, back: here - at })
  }

  return {
    /*
     * The API's answer, and the count where it declines to give one. `entries()`
     * holds the same-origin run this page is part of and nothing before it, so a
     * reader who reached GitHub from somewhere else stands at index 0 with a page
     * behind them that the list cannot show. `back()` still returns to it.
     */
    back: (nav.canGoBack ?? false) || target.history.length > 1,
    forward: nav.canGoForward ?? false,
    behind
  }
}

/**
 * Back one page, forward one page: the browser's own moves, not ours.
 *
 * Here because everything that touches history is here. A screen says the reader
 * is going back; it does not reach into `history` to do it.
 */
export const goBack = (target: Window): void => {
  target.history.back()
}

export const goForward = (target: Window): void => {
  target.history.forward()
}

/**
 * Reads whatever the browser answers a traversal with, and does nothing about it.
 *
 * A refused traversal is nothing to report: the entry has gone, the reader is where
 * they were, and the only reason to look at the answer at all is that a rejection
 * nobody reads is an error on GitHub's console with this extension's name on it.
 */
const letGo = (answer: PromiseLike<unknown> | undefined): void => {
  if (answer === undefined) return

  Effect.runFork(
    Effect.match(
      Effect.tryPromise(() => answer),
      { onSuccess: () => {}, onFailure: () => {} }
    )
  )
}

/**
 * Straight to one of the places behind, skipping the ones between.
 *
 * By the entry where the browser named one, because a count is a promise about a
 * list that may have changed since it was read: an entry the browser has since
 * dropped turns `go(-4)` into a jump to whatever is four back now. `traverseTo`
 * names the entry itself and fails instead of landing somewhere else.
 *
 * A refused traversal is nothing to report. The entry is gone, the reader is where
 * they were, and the two promises are read only so that neither is left unhandled.
 */
export const goBackTo = (target: Window, step: Step): void => {
  const nav = theirNavigation(target)

  if (step.key !== undefined && nav?.traverseTo !== undefined) {
    const traversal = nav.traverseTo(step.key)
    letGo(traversal?.committed)
    letGo(traversal?.finished)
    return
  }

  target.history.go(-step.back)
}

/**
 * Says when the trail has changed, so the two buttons never describe the last page.
 *
 * A press on Back leaves this screen, and a new screen builds a new bar — except
 * where it does not: a list going back to its own first page redraws in place, and
 * the bar that stays up would otherwise still say there is nothing ahead. One
 * event covers pushes and traversals alike where the API is there, and `popstate`
 * covers the traversals where it is not.
 */
export const watchTheTrail = (target: Window, moved: () => void): Stop => {
  const nav = theirNavigation(target)

  if (nav?.addEventListener !== undefined && nav.removeEventListener !== undefined) {
    nav.addEventListener("currententrychange", moved)
    return () => nav.removeEventListener?.("currententrychange", moved)
  }

  target.addEventListener("popstate", moved)
  return () => target.removeEventListener("popstate", moved)
}

/**
 * Sends the reader to one of our screens, and makes sure the address never gets
 * ahead of what is on the page.
 *
 * The repair is the point. Pushing an address is this file's business; drawing
 * the screen for it is another script's, and the two can come apart — a screen
 * that fails to load, a page GitHub has moved, a version of this extension where
 * the second press was not answered. What that left behind was the worst kind of
 * bug: an address naming a pull request, a list still on the screen, and a history
 * entry with nothing behind it, so the reader pressed Back and appeared to skip
 * the page they had been looking at.
 *
 * So the push is provisional. If no screen has arrived by {@link ARRIVING}, the
 * same address is loaded properly — `replace`, not `assign`, so the entry this
 * pushed is the one the document lands on rather than a second one beside it. The
 * reader waits as long as they always used to, and history says one true thing.
 */
/**
 * The whole address, so that two of them can be compared.
 *
 * All three parts of it. A heading counts: a reader who presses the repository's
 * own tab from `/owner/repo#quick-start` is going somewhere, and reading only the
 * path and the search called that a press already answered — so nothing was
 * pushed, and the heading stayed in the address bar over a page that no longer
 * had that heading anywhere on it.
 */
const addressOf = (target: Window): string =>
  `${target.location.pathname}${target.location.search}${target.location.hash}`

/**
 * The whole of where a link goes, as an address to push. The origin is left off
 * because every link this answers is to the page this is already running on.
 *
 * All three parts again, and for the same reason as {@link addressOf}: a reader
 * who presses a line in a build log is asking for line 23 of that file, and an
 * address pushed without the `#L23` is a quieter answer than the one they asked
 * for. Whatever the screen then does with it, the address says what was pressed
 * and a reader can copy it and send it to someone.
 */
export const addressIn = (link: HTMLAnchorElement): string =>
  `${link.pathname}${link.search}${link.hash}`

export const goTo = (
  target: Window,
  path: string,
  /**
   * Whether the screen for {@link path} is on the page, asked once the wait is
   * over. Defaults to the container having been replaced, which is what an
   * arrival looks like when the screen being left is a different one.
   *
   * Given by a caller that knows better. See {@link theScreenShown}: a screen
   * already standing redraws in place for a second page of a list or a file
   * opening in a tree, and comparing containers would call those failures.
   */
  arrived?: () => boolean
): void => {
  /*
   * Already there, which is one gesture answered twice rather than two moves.
   * The shell sees every press from the top of the document and the screen's own
   * handler sees it again underneath; both call this, and a second history entry
   * for one press is a back button that appears to do nothing.
   */
  if (addressOf(target) === path) return

  const leaving = theScreenOnThePage(target.document)
  const cameUp = arrived ?? (() => theScreenOnThePage(target.document) !== leaving)

  // The screen being left stays on the page until the next one is in the
  // document. Its own script hears this address change too, and would otherwise
  // hand the page back to GitHub in the same turn.
  holdTheSurface(target.document)
  /*
   * No state of ours on the entry. It was tried, to carry the address being left
   * so the bar could name where Back goes, and the entries themselves say it: see
   * {@link theTrail}. What the slot actually holds on a GitHub page is Turbo's own
   * record, so writing ours into it would be this extension keeping a fact GitHub
   * needs, in the one place GitHub is entitled to overwrite.
   */
  target.history.pushState(null, "", path)

  target.setTimeout(() => {
    // Somewhere else entirely by now: a second press, or the back button. This
    // address is nobody's to repair.
    if (addressOf(target) !== path) return
    if (cameUp()) return

    target.location.replace(path)
  }, ARRIVING)
}

/**
 * Everything this extension draws, in the two elements it draws it into.
 *
 * The bar is the reason this is not one selector. It is a child of `body` rather
 * than of the screen — see `barSlot.ts` — so every handler ever attached to a
 * screen's own container missed the one link on it that goes anywhere.
 */
const OURS = `#${ROOT_ID}, #${BAR_ID}`

/**
 * Whether a press is this extension's to answer, rather than GitHub's router's.
 *
 * Two conditions, and both are about what is already on the page. This drew the
 * link, so their router was never told the link exists and cannot be relied on to
 * finish it. And a screen of ours is standing, so the screen being gone to has a
 * surface to stand on and no document has to be fetched for one.
 *
 * What it costs to get this wrong is measured: a press their router drops sits for
 * two and a half seconds under the old address, with the old page's tabs above the
 * new page's contents, and is then carried out as a whole document load that throws
 * away everything already read. See {@link whenTheyStayPut}, which is what does it,
 * and which is now only ever armed for links GitHub drew themselves.
 */
export const oursToAnswer = (link: Element, target: Window): boolean =>
  link.closest(OURS) !== null && theScreenOnThePage(target.document) !== null

/**
 * Whether a link goes to a heading on the page the reader is already reading.
 *
 * Every heading in a rendered README is one of these, and there is nothing here
 * to answer: the browser is the only thing that can jump to a heading, because
 * `pushState` moves the address and leaves the page exactly where it is.
 *
 * Answering them anyway is what this was written for. The link is inside a screen
 * of ours and names a page of ours, so it passed {@link oursToAnswer} and the
 * press was cancelled — and then nothing was pushed either, because the path and
 * the search had not changed. The jump died, and the `#quick-start` the reader
 * meant to copy never reached the address bar.
 */
const aJumpWithinThePage = (link: HTMLAnchorElement, target: Window): boolean =>
  link.hash !== "" &&
  link.pathname === target.location.pathname &&
  link.search === target.location.search

/**
 * The three things there are to do about one event of a press.
 *
 * Separate from the press itself so that the order cannot be got wrong by the
 * caller: this names the three, {@link answerPress} decides which and when.
 */
export type Answering = {
  /**
   * Nobody's press here to answer. GitHub drew the link, so their router
   * finishes it — or it goes to a heading on this page, and the browser does.
   */
  readonly theirs: () => void
  /**
   * Ours, and not yet the navigation. Everything worth doing before the reader
   * lets go — the gate up, the next screen fetched — and nothing that moves the
   * address.
   */
  readonly ready: () => void
  /** Ours, cancelled, and the address is this extension's to move now. */
  readonly go: () => void
}

/**
 * Answers one event of a press, and decides which of the three it is.
 *
 * A press is `pointerdown`, then `mousedown`, then `click`, and only the last of
 * them is a navigation. That is the whole reason this is a function and not a
 * rule each caller keeps: the first event is worth hearing, because a screen
 * fetched while the reader still has the button down is on the page about a
 * fifth of a second after they let go — and it is worth hearing for that alone.
 *
 * Moving the address on it as well is the fault this was written to make
 * impossible. The address moving swaps the screen, so the anchor the press began
 * on leaves the document before the reader lets go; the `click` then lands on
 * nothing this extension can see, nobody cancels it, and the browser loads the
 * whole document for the page already drawn. Two hundred milliseconds of
 * interface, then the reload the push existed to avoid.
 *
 * So: cancel first, move second, and only ever on the event that would have
 * loaded a document.
 */
export const answerPress = (
  event: Event,
  link: HTMLAnchorElement,
  target: Window,
  answering: Answering
): void => {
  if (!oursToAnswer(link, target) || aJumpWithinThePage(link, target)) {
    answering.theirs()
    return
  }

  if (event.type !== "click") {
    answering.ready()
    return
  }

  event.preventDefault()
  answering.go()
}

/**
 * Whether a press is one to answer, or one to leave to the browser.
 *
 * Anything held down means a new tab, a new window or a download, where the page
 * really is being loaded and this one is staying exactly where it is.
 *
 * A press GitHub has already cancelled is answered all the same, which is the
 * one judgement here worth arguing about. They watch every press on the page from
 * the top of the document, and they cancel the ones they mean to handle
 * themselves — but these rows are ours, drawn into a region they were never told
 * about, and a link to a pull request from a list of ours is not something their
 * router knows how to finish. Deferring to it left readers on a page where
 * nothing happened at all: the press was cancelled, no address moved, and six
 * seconds later the card that had been drawn on the promise of that press gave
 * up and took the list down with it.
 */
export const aPlainPress = (event: MouseEvent): boolean => {
  if (event.button !== undefined && event.button !== 0) return false
  return !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
}

/** The link a press was headed for, where it was headed for one on GitHub. */
const linkIn = (event: Event, target: Window): HTMLAnchorElement | null => {
  const on = event.target
  if (!(on instanceof Element)) return null

  const link = on.closest("a")
  return link === null || link.hostname !== target.location.hostname ? null : link
}

/**
 * Answers presses on the links a screen drew, in place of the browser.
 *
 * Attached to the screen's own container rather than to the document, so it can
 * only ever answer for what this extension put on the page. Hands back the way to
 * stop.
 *
 * Which addresses it answers is the screen's own to say, because the screen is
 * the only thing that knows what it can hand its surface over to. A list of pull
 * requests can hand over to any of them; the card can hand over to the list it
 * came from, and deliberately not to another pull request — that one would have
 * to stand in a region GitHub has not rendered, and asking them for the document
 * is the honest way there.
 */
export const answerPressesIn = (
  container: Element,
  target: Window,
  answerable: (path: string) => boolean
): Stop => {
  const press = (event: Event): void => {
    if (!aPlainPress(event as MouseEvent)) return

    const link = linkIn(event, target)
    if (link === null || !answerable(link.pathname)) return
    // The browser's, not this screen's. See {@link aJumpWithinThePage}.
    if (aJumpWithinThePage(link, target)) return

    event.preventDefault()
    goTo(target, addressIn(link))
  }

  container.addEventListener("click", press)
  return () => container.removeEventListener("click", press)
}
