import { Effect, type Fiber } from "effect"
import { auditTakeover } from "./gateAudit"
import { runWhenIdle } from "./idle"
import { type Stop, whenAddressChanges } from "./navigation"
import { CONVERSATION, type Place } from "./place"
import {
  clearPreparedTraversal,
  markPreparedTraversal,
  preparedTraversal
} from "./preparedNavigation"
import { finishNavigation } from "./navigationTiming"

export const ROOT_ID = "gitquiet-root"

/**
 * The mark on everything of ours that lives in `body` rather than in the root — the
 * bar, the hover-card hosts, the toaster. Owned and documented by `outside.ts`, which
 * re-exports it; defined here because that file imports this one, and because a screen
 * standing on `body` itself needs the mark to tell its own furniture from the page it
 * is hiding.
 */
export const OUTSIDE = "data-gitquiet-outside"
export const SCREEN_ACTIVITY = "data-gitquiet-screen-activity"

const firstOf = (
  target: Document,
  selectors: ReadonlyArray<string>,
  within?: string
): Element | null => {
  for (const selector of selectors) {
    // Every match rather than the first, because a page in the middle of a
    // handover carries two of these: the outgoing page's and, once GitHub has
    // rendered it, this one's.
    for (const found of target.querySelectorAll(selector)) {
      if (within === undefined || found.closest(within) !== null) return found
    }
  }
  return null
}

/**
 * Which ancestor a region has to be inside before it is this page's to take, or
 * nothing where anything matching will do.
 *
 * Asked only while another interface is being handed the page over, which is the
 * one moment the question has a wrong answer. Their dashboard is built out of the
 * same Primer layout as their pull request, so a card injected on a press finds a
 * `PageLayoutContent` immediately — the dashboard's, inside the element the
 * Working Set hid on its way in. Standing there swept the list off the screen and
 * mounted the card somewhere `display: none`.
 *
 * `soft.within` already names the ancestor that exists on their version of this
 * page and nowhere else; it is what keeps the gate's stylesheet from blanking the
 * page being left, and this is the same question asked by the search rather than
 * by a rule. Absent on an ordinary arrival, where the loose selectors are what
 * makes this survive GitHub renaming a layout.
 */
const ownRegion = (target: Document, place: Place): string | undefined =>
  target.querySelector(`[${LEAVING}]`) === null ? undefined : place.soft?.within

/** The region itself, and nothing else — the only acceptable answer mid-parse. */
export const findConversationSlot = (
  target: Document,
  place: Place = CONVERSATION
): Element | null => firstOf(target, place.regions, ownRegion(target, place))

export const findSlot = (target: Document, place: Place = CONVERSATION): Element | null =>
  firstOf(target, [...place.regions, place.fallback], ownRegion(target, place))

/** Marks what GitHub rendered into the slot, so it can be hidden again if it comes back. */
const HIDDEN = "data-gitquiet-hidden"

/**
 * Which of this extension's interfaces a container was made for.
 *
 * There is one `#gitquiet-root` per document because every stylesheet here is
 * scoped to that id, and for a moment while a reader moves from the Working Set
 * to a pull request both interfaces' scripts are running. This is how the second
 * one knows the element it found is not its own.
 */
const BELONGS_TO = "data-gitquiet-for"

/** The exact address whose finished DOM this container holds. */
const ROUTE = "data-gitquiet-route"

type Snapshot = {
  readonly place: string
  readonly html: string
  readonly prepared?: {
    readonly element: HTMLElement
    readonly dispose: () => void
  }
}

type World = Window & { gitquietScreens?: Map<string, Snapshot> }

/** Enough for a short Back trail without retaining a whole browsing session. */
const HOW_MANY_SCREENS = 8

const screenSnapshots = (target: Document): Map<string, Snapshot> | null => {
  const view = target.defaultView as World | null
  if (view === null) return null
  view.gitquietScreens ??= new Map<string, Snapshot>()
  return view.gitquietScreens
}

const keepScreenSnapshot = (
  screens: Map<string, Snapshot>,
  route: string,
  snapshot: Snapshot
): void => {
  screens.get(route)?.prepared?.dispose()
  screens.delete(route)
  screens.set(route, snapshot)

  const oldest = screens.keys().next()
  if (screens.size > HOW_MANY_SCREENS && !oldest.done) {
    screens.get(oldest.value)?.prepared?.dispose()
    screens.delete(oldest.value)
  }
}

const routeNow = (target: Document, exact?: string): string | null => {
  if (exact !== undefined) return exact
  const view = target.defaultView
  return view === null ? null : `${view.location.pathname}${view.location.search}`
}

const rememberScreen = (element: Element): void => {
  const route = element.getAttribute(ROUTE)
  const place = element.getAttribute(BELONGS_TO)
  const screens = screenSnapshots(element.ownerDocument)
  if (route === null || place === null || screens === null || element.innerHTML === "") return

  // The screen left as a live React tree. Keep that stronger entry rather than
  // replacing it with an inert HTML copy on the idle task queued before it left.
  if (screens.get(route)?.prepared?.element === element) return

  keepScreenSnapshot(screens, route, { place, html: element.innerHTML })
}

/**
 * Keeps a finished detached screen under the route it was built for.
 *
 * The next navigation seeds this HTML before React starts. It is the same short-lived
 * cache used for Back, with no second storage tier and the same eight-route bound.
 */
export const rememberPreparedScreen = (
  target: Document,
  route: string,
  place: Place,
  prepared: Element,
  dispose?: () => void
): void => {
  const screens = screenSnapshots(target)
  if (screens === null || prepared.innerHTML === "") return

  keepScreenSnapshot(screens, route, {
    place: place.name,
    html: prepared.innerHTML,
    prepared:
      dispose === undefined ? undefined : { element: prepared as HTMLElement, dispose }
  })
}

/** Keeps a screen that just left as a live history entry, where it named its route. */
export const rememberLiveScreen = (
  element: Element,
  place: Place,
  dispose: () => void
): boolean => {
  const route = element.getAttribute(ROUTE)
  if (route === null || element.innerHTML === "") return false

  rememberPreparedScreen(element.ownerDocument, route, place, element, dispose)
  return true
}

/** Whether this exact route has a live React root ready to claim. */
export const hasPreparedScreen = (
  target: Document,
  route: string,
  place: Place
): boolean => {
  const snapshot = screenSnapshots(target)?.get(route)
  return snapshot?.place === place.name && snapshot.prepared !== undefined
}

/** Arms an exact live cache entry for Back, Forward, or another history traversal. */
export const prepareCachedTraversal = (
  target: Document,
  route: string,
  place: Place
): boolean => {
  if (!hasPreparedScreen(target, route, place)) return false

  markPreparedTraversal(target, route)
  return true
}

/** Takes a live route pre-render out of the cache without disposing its React root. */
const claimPreparedScreen = (
  target: Document,
  place: Place,
  exactRoute?: string
): HTMLElement | null => {
  const route = routeNow(target, exactRoute)
  const screens = screenSnapshots(target)
  if (route === null || screens === null) return null

  const snapshot = screens.get(route)
  if (snapshot?.place !== place.name || snapshot.prepared === undefined) return null

  screens.delete(route)
  if (preparedTraversal(target) === route) clearPreparedTraversal(target)
  const claimed = snapshot.prepared.element
  claimed.id = ROOT_ID
  claimed.setAttribute(BELONGS_TO, place.name)
  claimed.removeAttribute(LEAVING)
  return claimed
}

const seedRememberedScreen = (
  target: Document,
  container: Element,
  place: Place,
  exactRoute?: string
): void => {
  const route = routeNow(target, exactRoute)
  const screens = screenSnapshots(target)
  if (route === null || screens === null) return

  const snapshot = screens.get(route)
  if (snapshot === undefined || snapshot.place !== place.name) return

  screens.delete(route)
  screens.set(route, snapshot)
  container.innerHTML = snapshot.html
}

/**
 * Marks the container of an interface on its way out: still on the screen, no
 * longer being looked after.
 *
 * A reader who presses a pull request on a list this drew is looking at that
 * list, and the card that replaces it is several hundred milliseconds away — its
 * script has to be injected and it has a pull request to read. The list used to
 * be taken out of the document the instant the card's script started, which left
 * a hole for the whole of that wait: nothing of ours, and GitHub's own page still
 * held back by the gate.
 *
 * So it stays where it is, and this says so three times over — to the takeover
 * that put it there, which stops tending it; to the takeover replacing it, which
 * sweeps it away as it settles; and to the search for somewhere to stand, which
 * is stricter about what counts while the page belongs to somebody else.
 */
const LEAVING = "data-gitquiet-leaving"

/**
 * Told to a container as it is taken off the page, whether by the interface
 * inside it stepping aside or by the one replacing it.
 *
 * Which is when an interface comes down, and the only moment it is right to: a
 * React tree unmounted while the page is still showing it leaves a hole, and one
 * left mounted after the page has stopped goes on reading GitHub for nobody.
 * Both used to be possible, because it was the address changing that decided.
 */
export const GOING = "gitquiet:going"

const takeOffThePage = (element: Element, rememberLive = false): void => {
  const page = element.ownerDocument
  runWhenIdle(() => rememberScreen(element))
  element.remove()
  element.dispatchEvent(new CustomEvent(GOING, { detail: rememberLive }))
  if (element === ours) ours = null
  theScreenMoved(page)
}

/**
 * The container this screen draws into, from the moment it asked for one.
 *
 * Which is a question about this bundle rather than about the page: each screen is built as its
 * own bundle, and a bundle has one screen in it, so this is that screen's container and nobody
 * else ever reads it. {@link theScreenOnThePage} is the other half — the container that has the
 * page — and the two are different elements for the whole second between a press and the address
 * moving. See {@link oursToDraw}.
 */
let ours: Element | null = null

/** Whether this bundle still owns this container. */
const isOurContainer = (container: Element): boolean => container === ours

/**
 * Said on the document when the screen that has the page changes.
 *
 * On the document because that is the only thing the screens share. Each of them is
 * built as its own bundle, so each has its own copy of this module: a set of watchers
 * in here is a set of that screen's own watchers, and the move that matters most — the
 * arriving screen taking the page from the leaving one — is made in the other copy
 * entirely. The bar of the screen being left never heard it, and stayed on the page
 * beside the new one. That is the second bar, and this is the channel it was missing.
 */
export const SCREEN_MOVED = "gitquiet:screen-moved"

/** One pending announcement per document, so one takeover causes one React update. */
const moving = new WeakSet<Document>()

/** Says so, to every screen's script rather than only to this one's. */
export const theScreenMoved = (page: Document): void => {
  if (moving.has(page)) return
  moving.add(page)
  setTimeout(() => {
    moving.delete(page)
    page.documentElement.dispatchEvent(new CustomEvent(SCREEN_MOVED))
  }, 0)
}

/** Wakes a detached screen when its connection to the page changes. */
export const theScreenActivityChanged = (element: Element): void => {
  element.toggleAttribute(SCREEN_ACTIVITY)
}

/**
 * Whether this screen is the one whose bar the page should be showing.
 *
 * There is one bar slot per document — see `barSlot.ts` — and every screen portals its bar into
 * it, so the answer has to be no for all but one of them or the reader gets two bars stacked.
 * The rule is the plainest one that is true: a screen draws the bar while it has the page, or
 * while nobody has it.
 *
 * Nobody having it is the ordinary arrival, and it is why this is not simply "has the page". A
 * document load renders the tree while GitHub's HTML is still parsing, and the bar is the first
 * thing on the screen — held back until the takeover, the page would have no bar at all for as
 * long as that took, because their own is hidden by the presence of the slot rather than by
 * anything we could time.
 *
 * The no is what the reader reported twice: a screen started on the promise of a press draws its
 * tree a second before the address agrees, and where that press was abandoned or its takeover
 * failed, that tree kept its bar beside the bar of the screen still on the page. Ten screens
 * each unmount themselves on the one path that says the page is GitHub's, and none of them said
 * anything about the paths that do not, so the invariant had no owner. It has one here.
 */
export const oursToDraw = (page: Document): boolean => {
  // Nothing of this bundle's is being drawn: a test rendering the bar on its own, or a document
  // other than the one this screen was started against.
  if (ours === null || ours.ownerDocument !== page) return true

  const standing = page.getElementById(ROOT_ID)
  return standing === null || standing === ours
}

/** Says when the answer to {@link oursToDraw} may have changed. Stops when the caller says so. */
export const whenTheScreenMoves = (page: Document, watcher: () => void): (() => void) => {
  const hear = () => watcher()
  page.documentElement.addEventListener(SCREEN_MOVED, hear)
  return () => page.documentElement.removeEventListener(SCREEN_MOVED, hear)
}

/**
 * The container this script marked as leaving, held on to past its removal.
 *
 * A takeover sweeps the interface it replaces by searching the document for the
 * mark, and that search finds nothing when their router has already taken the
 * marked container out. Which it does: a Run stands inside
 * `turbo-frame#repo-content-turbo-frame`, and Turbo replaces that frame's
 * children wholesale, so the Run's container is gone from the document before
 * the next screen has anywhere to stand. Nothing tells that tree it is off the
 * page, so it stays mounted — reading GitHub for a page nobody is on, with its
 * bar still in `#gitquiet-bar` beside the new one. Two bars, and the reason
 * nobody could reproduce it is that it needs their router to be quick.
 *
 * Held in the module doing the replacing, which is the same module that marked
 * it: each screen is built as its own bundle, so this is never read by a script
 * other than the one that wrote it.
 */
let marked: Element | null = null

const markAsLeaving = (element: Element): void => {
  element.setAttribute(LEAVING, "")
  marked = element
}

/**
 * Says that the page may be shown: either ours is on it, or this has given up
 * and theirs is the best thing to show.
 *
 * Until it is set, the rule in `gates.load.css` keeps GitHub's conversation, header
 * and tabs off the screen. Nothing else sets it, and something must: a page
 * left gated is a blank page.
 */
const REVEALED = "data-gitquiet-revealed"

/**
 * The other gate: the one belonging to the small script that runs on every
 * GitHub page, which holds the conversation back on a page that never loaded as
 * one.
 *
 * Kept apart from {@link REVEALED} on purpose, and lifted only by
 * {@link ungate}. The interface can be injected into a document while GitHub is
 * still navigating, at a moment when the address is the list it is leaving
 * rather than the pull request it is heading for. It has to reveal then —
 * `gates.load.css` arrives with it and would otherwise hide the list — and if
 * revealing also lifted this gate, it would be dropping the guard a fraction of
 * a second before the conversation it exists to hide is rendered.
 */
const GATING = "data-gitquiet-gating"

/**
 * Which of GitHub's pages this document is, as the rules that hide it are written.
 *
 * The hooks those rules match are not as particular as they read: an issue, a
 * discussion and a release all have a `PageLayoutContent`, and one sheet naming it
 * by default would blank three pages this extension has nothing to do with. The
 * page-scoped rules used to be kept apart by shipping a sheet per interface, which
 * meant every region was named twice — once here to find it, once there to hide it
 * — and the copies drifted.
 *
 * So the sheet says which page each rule is for and this says which page this is.
 */
const PAGE = "data-gitquiet-page"

/**
 * Says so, from the address, before anything has been displayed.
 *
 * Has to be at `document_start` and has to be synchronous: everything downstream is
 * a stylesheet already in force, and an attribute set a frame later is a frame of
 * GitHub's page on the screen. The element it goes on is the one element that
 * exists that early — `document.body` does not yet.
 */
export const markPage = (target: Document, place: Place): void => {
  target.documentElement.setAttribute(PAGE, place.name)
}

/**
 * Says this is no longer one of their pages we have anything to say about.
 *
 * A reader leaving a pull request for an issue takes the same document with them,
 * and the rules keyed on this hide a region an issue has too. Nothing else takes it
 * off: the attribute outlives every navigation, because no page is ever loaded.
 */
export const unmarkPage = (target: Document): void => {
  target.documentElement.removeAttribute(PAGE)
}

export const reveal = (target: Document): void => {
  target.documentElement.setAttribute(REVEALED, "")
}

/**
 * Hands the page back, unless another screen has already claimed it.
 *
 * What a screen calls when the address stops being one it draws. Most of the
 * time that means the reader went somewhere this extension has nothing to say
 * about, and the page must be revealed or it stays blank. Sometimes it means
 * they went to another of these screens, and then revealing is wrong: the shell
 * gates on the press, so by the time the screen being left hears about the new
 * address the gate for the new screen is already up, and lifting it shows
 * GitHub's own page for as long as the arriving screen takes to mount.
 *
 * On the recording that found this, pressing Issues from a repository's pull
 * request list showed GitHub's issue list for most of a second before ours
 * replaced it. The gate was doing its job; the screen on its way out was
 * undoing it.
 *
 * Nothing is stuck by declining. Whatever set that gate either takes the page,
 * which reveals, or gives up, which reveals and ungates, or runs out of its
 * twenty seconds, which does both.
 */
export const handBack = (target: Document): void => {
  if (target.documentElement.hasAttribute(GATING)) return
  reveal(target)
}

/**
 * Lets GitHub's conversation through: this has either put something in front of
 * it or decided it is not going to.
 */
export const ungate = (target: Document): void => {
  target.documentElement.removeAttribute(GATING)
}

/**
 * Hides GitHub's conversation again, for the next pull request.
 *
 * On a page load the rule is already in force before this file runs and there
 * is nothing to do. On a soft navigation there is: the page has been revealed
 * for the pull request being left, and unless it is gated again the one being
 * arrived at appears in GitHub's own hand first and ours replaces it a moment
 * later, which is the flash this whole arrangement exists to avoid.
 */
export const gate = (target: Document): void => {
  target.documentElement.removeAttribute(REVEALED)
  target.documentElement.setAttribute(GATING, "")
}

/**
 * Says that the interface is the one in charge of the conversation region.
 *
 * Different from {@link REVEALED}, which only says the page may be shown: a
 * pull request this gave up on is revealed and not taken, and GitHub's own
 * conversation is what the reader gets.
 *
 * While it is set, `gates.load.css` keeps everything in that region that is not ours
 * out of sight. That is the part attribute-hiding cannot do on its own —
 * GitHub's React re-renders the region long after the takeover and inserts
 * children that are, for the moment before the observer notices them, perfectly
 * visible. A rule keyed off this hides them from the instant they exist.
 */
const TAKEN = "data-gitquiet-taken"

/**
 * Which of this extension's screens is the one on the page.
 *
 * Not the same question as {@link PAGE}, which is the page the document is *about*
 * and moves on the press — a whole second before the address does, deliberately, so
 * that the rules holding GitHub's conversation back are the incoming page's rules
 * from the instant the reader presses. This one moves when the screen does.
 *
 * Read by {@link theScreenShown}, and through it by the push in `going.ts`, which
 * has to know whether the screen it sent the reader to ever arrived.
 */
const SHOWN = "data-gitquiet-shown"

/**
 * Which of them it is, for a caller that has just sent the reader somewhere.
 *
 * The one honest test of "the screen for this address arrived", and the only one
 * that holds for a screen that was already standing. A list moving to its second
 * page and a repository opening a file both redraw without ever replacing the
 * container, so a caller comparing containers would call those moves failures and
 * load the document the push existed to avoid.
 */
export const theScreenShown = (target: Document): string | null =>
  target.documentElement.getAttribute(SHOWN)

/**
 * Which address the screen on the page has drawn, as a path.
 *
 * {@link SHOWN} says which kind of screen is up and cannot say more, because a screen
 * that shows a second page of its own kind never comes down: a reader moving between
 * two pull requests keeps the same container and the same React root, and only draws
 * again. So the kind reads "conversation" from the pull request they left, through the
 * press, and on into the one they arrived at.
 */
const AT = "data-gitquiet-at"

/**
 * Who has the mark up, so that only they can take it down.
 *
 * A path is not an identity. Two screens can stand for one address at once — see the
 * inbox drawn twice below, where one place ends up with two containers — and a guard
 * that compares the path lets the stray one withdraw the survivor's mark on its way
 * out. The same shape as `ours` above and as the root owner in `screen.tsx`, for the
 * same reason: the question is "is this still mine", and only a token answers it.
 */
let holder: symbol | null = null

/**
 * Said by a screen that has the page for this address to show, and not before.
 *
 * From the data rather than from the press, which is the whole of what this mark is
 * for and the one way it has been wrong. It used to be set by the shell's redraw off
 * `window.location.pathname` — the address the screen was *asked* for — so it went up
 * within about fifty milliseconds of the press while the pull request the reader had
 * just left was still the one on the screen. Measured between two of them: the mark
 * read the new address at 55ms and the rows underneath read the old one until 3,380ms.
 *
 * Which made every question it answers answerable wrongly. Reading ahead stopped
 * being held back at 55ms and went back to competing with the read the reader is
 * waiting for, on the one route where that read is seven requests long.
 */
export const theScreenIsAt = (target: Document, path: string, owner: symbol): void => {
  holder = owner
  target.documentElement.setAttribute(AT, path)
}

/**
 * Said by a screen on its way off the page, about the mark if it is still its own.
 *
 * Two screens are on the page at every navigation, on purpose — the one arriving
 * stands on the surface of the one leaving — and the one leaving goes last. Clearing
 * the mark unconditionally would take down the arriving screen's claim a moment after
 * it made it, which is the fault the toasts had when one slot was written by one
 * screen and cleared by another.
 */
export const theScreenLeft = (target: Document, owner: symbol): void => {
  if (holder !== owner) return
  holder = null
  target.documentElement.removeAttribute(AT)
}

/**
 * Whether the screen for this address is somewhere it should not be, asked by the one
 * caller that loads a whole document when the answer is yes.
 *
 * Not the strict test, and the difference is which way an unanswered question falls.
 * A screen that has not been wired to publish an address never says one, and read as
 * "it never arrived" that silence is a document load a second and a half after a press
 * that worked perfectly well. So no mark is not an answer here.
 *
 * A mark for another address is an answer, and it is the one the repair exists for: a
 * screen standing with the wrong page under an address this pushed. Before the mark
 * was published from the data, nothing could tell that case from a screen that had
 * simply not finished, and the repair went toothless on every move between two pages
 * of one kind.
 */
export const theScreenIsNotElsewhere = (
  target: Document,
  place: string,
  path: string
): boolean => {
  if (theScreenShown(target) !== place) return false

  const at = target.documentElement.getAttribute(AT)
  return at === null || at === path
}

export const theScreenArrived = (target: Document, place: string, path: string): boolean =>
  theScreenShown(target) === place && target.documentElement.getAttribute(AT) === path

/**
 * Says when the document has a body, which at `document_start` it does not.
 *
 * A detached container renders as well as an attached one, so a screen is drawn
 * before there is anywhere to put it. `body` is the exception, and it is not the
 * root's business but everything of ours that lives outside it: the bar's slot is
 * `body`'s first child, and the toaster and the hover cards are appended to it, all
 * three from a render. Against a document that is still `<html>` and nothing else,
 * `page.body` is null and the first render throws inside whichever of them got
 * there first. React then has no tree, nothing asks it for another, and the reader
 * is left with an empty interface over a page held back by the gate. Measured at
 * about one cold load in eight on a Run.
 *
 * Immediate where there is a body already, which is every soft navigation and every
 * screen a press stood up: the shell has been running since the document started, and
 * only the first screen of a load can be this early.
 *
 * Looked for again on the next turn rather than watched for. The wait is a turn or two
 * on a cold load and nothing at all on every other arrival, so an observer on
 * `documentElement` would be set up and taken down for one record, and one that is
 * never taken down is a watcher on the busiest node of the page.
 */
export const whenThereIsAPage = (page: Document, ready: () => void): (() => void) => {
  if (page.body !== null) {
    ready()
    return () => {}
  }

  let turn: ReturnType<typeof setTimeout> | null = null
  const look = (): void => {
    if (page.body === null) {
      turn = setTimeout(look)
      return
    }
    turn = null
    ready()
  }
  turn = setTimeout(look)

  return () => {
    if (turn !== null) clearTimeout(turn)
    turn = null
  }
}

/**
 * The element the interface is drawn into.
 *
 * Handed out before there is anywhere on the page to put it, so React can build
 * the tree while GitHub's HTML is still arriving. A detached container renders
 * exactly as well as an attached one — the work is the same, only the paint
 * waits — and `takeOverSlot` puts this element into the region once the parser
 * has produced one.
 */
export const interfaceContainer = (
  target: Document,
  place: Place = CONVERSATION,
  exactRoute?: string
): HTMLElement => {
  const already = target.getElementById(ROOT_ID)
  if (already !== null) {
    // Ours: the same script running twice against one document. Or taken up
    // again — a reader who pressed a pull request and came back before the card
    // arrived is looking at this list, and it never left the page.
    if (already.getAttribute(BELONGS_TO) === place.name) {
      const route = routeNow(target, exactRoute)
      const drawnRoute = already.getAttribute(ROUTE)
      if (route === null || drawnRoute === null || route === drawnRoute) {
        already.removeAttribute(LEAVING)
        if (marked === already) marked = null
        ours = already
        theScreenMoved(target)
        return already
      }

      // One screen kind, another exact address. Keep this finished route until
      // a new container, seeded from its own cache entry, replaces it.
      markAsLeaving(already)
    } else {
      /*
       * Another interface's, which means that interface is being replaced — a
       * reader leaving the Working Set for a pull request has our list on the page
       * while the card's script is starting.
       *
       * Marked rather than taken out: it is the page the reader is looking at, and
       * it stays there until this container is in the document to replace it. A
       * container of its own rather than that one adopted, because two React roots
       * on one node is not a race worth running.
       */
      markAsLeaving(already)
    }
  }

  const prepared = claimPreparedScreen(target, place, exactRoute)
  const made = prepared ?? target.createElement("div")
  if (prepared === null) {
    made.id = ROOT_ID
    made.setAttribute(BELONGS_TO, place.name)
    seedRememberedScreen(target, made, place, exactRoute)
  }
  const madeRoute = routeNow(target, exactRoute)
  if (madeRoute !== null) made.setAttribute(ROUTE, madeRoute)
  ours = made
  theScreenMoved(target)
  return made
}

/**
 * The surface our own last screen is standing on, where one is still standing.
 *
 * For an arrival this extension navigated to itself: the page GitHub rendered is
 * the page being left, so the only place on it that is ours to use is the one the
 * screen being replaced is already using. Null where nothing of ours is on the
 * page, which is every ordinary arrival — there is a document coming, and the
 * region in it is the right place to wait for.
 */
export const ourSurface = (target: Document): Element | null =>
  target.querySelector(`[${LEAVING}]`)?.parentElement ?? null

/**
 * The screen on the page, whichever of ours it is.
 *
 * Compared rather than read: a caller that has just sent the reader somewhere
 * watches for this to become a different element, which is the one honest signal
 * that the screen it asked for has actually arrived.
 */
export const theScreenOnThePage = (target: Document): Element | null =>
  target.getElementById(ROOT_ID)

/** Whether the screen already on the page draws this exact route. */
export const theScreenHasRoute = (target: Document, route: string): boolean =>
  theScreenOnThePage(target)?.getAttribute(ROUTE) === route

/**
 * The name of the place the screen on the page took, or nothing where none is up.
 *
 * Asked before a history traversal commits, to tell a move between two of our screens
 * from one screen redrawing for a second address of its own. See `holdsForTraversal`.
 */
export const theScreenStandsFor = (target: Document): string | null =>
  theScreenOnThePage(target)?.getAttribute(BELONGS_TO) ?? null

/** The mark saying this document has already watched the interface arrive once. */
const LANDED_BEFORE = "data-gitquiet-arrived"

/**
 * Whether the reader has already seen one of our screens land in this document.
 *
 * The entrance animations belong to the arrival, and `Shell` holds a flag that says
 * when its own is over. That flag is a component's, and every navigation of ours
 * closes the screen and stands a new one up — so it started false again on every
 * move, and the page replayed its entrance for somewhere the reader was returning
 * to. Recorded at 120 frames a second, pressing Back onto a list: the rows arrived
 * at full strength and the filter bar above them faded in across the 183
 * milliseconds after, which is `t-panel-in` running on a panel nobody waited for.
 *
 * On the document rather than in a module, because each screen is built as its own
 * bundle and a move between two kinds shares no module with the screen it replaces.
 * A real page load empties the document and with it this, which is right: that is an
 * arrival, and the reader is watching the interface come up for the first time.
 */
export const hasLandedBefore = (target: Document): boolean =>
  target.documentElement.hasAttribute(LANDED_BEFORE)

export const markLanded = (target: Document): void => {
  target.documentElement.setAttribute(LANDED_BEFORE, "")
}

/** Forgets it, for a test that must not land on what another test landed. */
export const forgetLanded = (target: Document): void => {
  target.documentElement.removeAttribute(LANDED_BEFORE)
}

/** Updates the exact route after the browser redirects within the same screen. */
export const markScreenRoute = (target: Document, route: string): void => {
  const screen = theScreenOnThePage(target) ?? (ours?.ownerDocument === target ? ours : null)
  screen?.setAttribute(ROUTE, route)
  if (screen !== null) finishNavigation(target, route, screen)
}

/** Puts an exact live history target on the current surface before traversal commits. */
export const activatePreparedTraversal = (
  target: Document,
  route: string,
  place: Place
): boolean => {
  const leaving = theScreenOnThePage(target)
  const slot = leaving?.parentElement
  if (leaving === null || slot == null) return false

  const arriving = claimPreparedScreen(target, place, route)
  if (arriving === null) return false

  leaving.setAttribute(LEAVING, "")
  takeOffThePage(leaving, true)
  slot.append(arriving)
  arriving.setAttribute(ROUTE, route)
  target.documentElement.setAttribute(TAKEN, "")
  target.documentElement.setAttribute(SHOWN, place.name)
  hideTheirs(slot, arriving)
  hideTheirBands(target, place)
  reveal(target)
  ungate(target)
  finishNavigation(target, route, arriving)
  theScreenMoved(target)
  return true
}

/**
 * Keeps a screen on the page until the one replacing it is in the document.
 *
 * Said by a screen that has handed the address on itself. Its own script hears
 * that address change too, and without this it would give the page back to GitHub
 * in the same turn — a list taken down, GitHub's own restored underneath, and the
 * card that is coming arriving into a page that has already moved on.
 */
export const holdTheSurface = (target: Document): void => {
  const standing = target.getElementById(ROOT_ID)
  if (standing !== null) markAsLeaving(standing)
}

const hide = (element: Element): void => {
  if (element.hasAttribute(HIDDEN)) return
  element.setAttribute(HIDDEN, "")
  element.setAttribute("hidden", "")
}

const hideTheirBands = (target: Document, place: Place): void => {
  for (const selector of place.bands) {
    for (const band of target.querySelectorAll(selector)) hide(band)
  }
}

const hideTheirs = (slot: Element, root: Element): void => {
  for (const child of slot.children) {
    // Never ours. A second takeover — a development reload, a script injected
    // twice — would otherwise hide the interface the first one rendered and
    // leave the page apparently empty while the DOM insists it is all there.
    if (child === root || child.id === ROOT_ID) continue
    // Nor the furniture of ours that lives beside the root rather than in it. On a
    // region of GitHub's this never matches; on `body` itself the bar and the
    // hover-card hosts are siblings of the root, and hiding a sibling by position
    // is exactly what this does.
    if (child.hasAttribute(OUTSIDE)) continue
    hide(child)
  }
}

/**
 * How long to wait for GitHub to render the region before giving up on it.
 *
 * They render it with React after the document is done, so at the moment a
 * content script runs the slot reliably does not exist yet. Long enough for a
 * slow pull request on a slow connection; short enough that a page which is
 * never going to have one stops holding a listener open.
 */
const PATIENCE = 15_000

/**
 * How long the conversation region is waited for before the whole repository
 * content will do instead.
 *
 * Short, because on the path where this matters the region is frequently never
 * rendered at all. GitHub's own navigation from a list to a pull request stalls
 * after the response arrives — measured with this extension disabled entirely,
 * so it is theirs and not ours — and the page keeps the list's markup under a
 * pull request's address indefinitely. Waiting politely for a region nobody is
 * building was two and a half seconds of the reader's time, every time.
 *
 * Long enough only to not mistake a half-swapped page for a finished one. The
 * observer below keeps looking afterwards and moves the interface into the
 * conversation region if GitHub does eventually produce one.
 */
const SETTLING = 600

const whenSlotAppears = (
  target: Document,
  patience: number,
  settling: number,
  place: Place
): Effect.Effect<Element | null> => {
  // Whether it is yet fair to conclude there is no conversation region.
  //
  // A finished document used to be the whole test, and on a page load it is a
  // good one: GitHub sends the region in the HTML, so a parsed document without
  // one has none. It is worthless on a soft navigation. The document finished
  // loading minutes ago as somebody's list of pull requests, so every test of
  // it passes instantly, and the interface takes the whole repository content —
  // inside a turbo-frame, which Turbo then replaces, carrying the interface off
  // the page and leaving the rule that hides GitHub's conversation with nothing
  // in front of it. A blank page, in other words.
  //
  // So the wait is also made to be a real one.
  let mayFallBack = false

  const look = (): Element | null =>
    mayFallBack ? findSlot(target, place) : findConversationSlot(target, place)

  const conversation = findConversationSlot(target, place)
  if (conversation !== null) return Effect.succeed(conversation)

  return Effect.callback((resume) => {
    const finish = (found: Element | null) => {
      clearTimeout(timer)
      clearTimeout(grace)
      watcher.disconnect()
      target.removeEventListener("DOMContentLoaded", allow)
      resume(Effect.succeed(found))
    }
    const check = () => {
      const found = look()
      if (found !== null) finish(found)
    }
    const allow = () => {
      if (target.readyState === "loading") return
      mayFallBack = true
      check()
    }

    const watcher = new MutationObserver(check)
    const timer = setTimeout(() => finish(null), patience)
    // Long enough for GitHub to fetch a pull request and render it, which is
    // the only thing that distinguishes "not here yet" from "not coming".
    const grace = setTimeout(allow, settling)
    target.addEventListener("DOMContentLoaded", check)
    watcher.observe(target.documentElement, { childList: true, subtree: true })

    // Interruption is the reader leaving before GitHub produced a region: the
    // observer and both timers have to go, or a page nobody is on keeps a
    // subtree observer running for the rest of the tab's life.
    return Effect.sync(() => {
      clearTimeout(timer)
      clearTimeout(grace)
      watcher.disconnect()
      target.removeEventListener("DOMContentLoaded", allow)
    })
  })
}

export type Takeover = {
  /** Where to render. Already in the page. */
  readonly container: Element
  /**
   * Gives the page back: GitHub's conversation returns and ours leaves.
   *
   * False where there was nothing to give back because another interface is
   * taking the page instead. The one thing a caller does differently then is
   * nothing: the gates and what is on the screen are that takeover's business,
   * and this interface comes down when it sweeps it away.
   */
  readonly stepAside: () => boolean
}

/**
 * Puts the interface where GitHub's conversation was.
 *
 * Their content is hidden rather than removed. React is still mounted on it and
 * still updating it; deleting nodes from underneath a live tree earns a crash
 * at the worst moment, and hiding costs nothing. It also means the conversation
 * is one attribute away when this has to step aside — which is what it does
 * when a pull request cannot be read.
 *
 * Returns null when the slot cannot be found, which is the honest outcome if
 * GitHub reorganises the page: better their working conversation than our
 * interface nailed to the wrong element.
 */
export const takeOverSlot = (
  target: Document,
  // Whatever ran before us got here first; there is one interface per page.
  container: Element = interfaceContainer(target),
  place: Place = CONVERSATION,
  /**
   * Where to stand, for an arrival this extension navigated to itself.
   *
   * Everything above searches GitHub's document for the region belonging to the
   * page being arrived at. There is no such region when no document was asked
   * for: GitHub does not react to an address it did not move, so the page on the
   * screen stays the one it rendered, and the region for this page is never
   * going to exist. What does exist is the surface our own last screen was
   * standing on, which is already held, already gated, and already the page as
   * far as the reader is concerned.
   */
  ours?: Element,
  exactRoute?: string
): Takeover | null => {
  const slot = ours ?? findSlot(target, place)
  if (slot === null) return null

  container.id = ROOT_ID
  container.setAttribute(BELONGS_TO, place.name)

  const settle = (into: Element): void => {
    // The interface this one replaces goes now, in the same breath as ours
    // arriving, so that the page is never without one of them — and so that
    // there is never more than one `#gitquiet-root` on it, which every
    // stylesheet here is scoped to.
    // The one their router removed before this got here, read before the sweep
    // rather than after: the sweep disconnects what it takes, and asking
    // afterwards would name a container that has just been told once already.
    // See `marked`.
    const missed = marked !== null && marked !== container && !marked.isConnected ? marked : null
    for (const leaving of target.querySelectorAll(`[${LEAVING}]`))
      takeOffThePage(leaving, true)
    if (missed !== null) takeOffThePage(missed, true)
    marked = null
    /*
     * And any other of ours standing there unmarked, which is the same invariant asked at the
     * one moment it can be answered truthfully.
     *
     * {@link interfaceContainer} asks it of the document, and a container is deliberately not in
     * the document when it is handed out: it renders detached so that the tree is built while
     * GitHub's HTML is still arriving. So for the whole of that wait — measured at between 169
     * and 1219 milliseconds on their inbox, across six loads — `getElementById` answers null,
     * whatever is really pending, and a second container is made and never marked as replacing
     * the first, because marking happens in the search that could not see it.
     *
     * The reader found what that costs on `/notifications`, where they were shown their whole
     * inbox twice in two columns: two roots, both drawn, both direct children of a region that
     * is `display: flex`. Neither hid the other either, since `hideTheirs` skips a child of
     * ours by id.
     *
     * Here the question has one answer that cannot be stale, because this is the line that puts
     * a container in the document. `id` is not unique in a DOM that has two of these, so it is
     * asked with `querySelectorAll` rather than by id.
     *
     * Marked before it is taken off, which is not decoration: the takeover that put it there is
     * watching for exactly this and puts it back, and this one would take it out again. That is
     * a wedged tab rather than a flicker, because each runs on the mutations the other makes.
     * The mark is how a watcher is told to stand down, and the sweep above never has to set it
     * because a marked container is what that sweep is looking for.
     */
    let stray = target.getElementById(ROOT_ID)
    while (stray !== null && stray !== container) {
      stray.setAttribute(LEAVING, "")
      takeOffThePage(stray)
      stray = target.getElementById(ROOT_ID)
    }
    // Only a reused container can be the first result while another duplicate
    // follows it. The normal route stays on the constant-time id lookup above.
    if (stray === container) {
      for (const duplicate of target.querySelectorAll(`#${ROOT_ID}`)) {
        if (duplicate === container) continue
        duplicate.setAttribute(LEAVING, "")
        takeOffThePage(duplicate)
      }
    }
    into.append(container)
    theScreenActivityChanged(container)
    const route = routeNow(target, exactRoute)
    if (route !== null) {
      container.setAttribute(ROUTE, route)
      finishNavigation(target, route, container)
    }
    hideTheirs(into, container)
    hideTheirBands(target, place)
    // Set before revealing, so that the rule keeping their conversation out of
    // sight is never off for an instant. The attribute hiding above says what
    // to do about the children that are there now; this says what to do about
    // every child React inserts afterwards, which is the same thing, decided in
    // advance rather than a mutation late.
    target.documentElement.setAttribute(TAKEN, "")
    target.documentElement.setAttribute(SHOWN, place.name)
    reveal(target)
    ungate(target)
    // And the bar, which was waiting for exactly this: the screen that has the page is the one
    // whose bar the page shows. Said whichever container arrived, because the answer changes for
    // the screen that just lost the page as well as for the one that took it. See {@link oursToDraw}.
    theScreenMoved(target)
  }
  settle(slot)

  // Once, a little later, ask whether any of their page is still on the screen where
  // ours stood: a band gone stale hides nothing, and this is the one thing that hears
  // about it before a reader does. It defers and swallows its own faults, so it never
  // holds the takeover up or throws into it.
  auditTakeover(target, place)

  // React does not re-render this region so much as replace it: the element the
  // interface was appended to is thrown away and an identical one takes its
  // place, with our container still attached to the discarded copy. Watching the
  // slot itself would mean watching a node no longer on the page, so this
  // watches something above it that survives — and re-finds the slot each time,
  // rather than trusting the one it started with.
  //
  // The body, and nothing nearer. Everything between it and the slot is
  // something Turbo replaces wholesale on a navigation, and an observer on a
  // replaced node is an observer of a node no longer in the document: it never
  // fires again, so the interface is never put back, and the page stays blank
  // behind a rule that is still hiding GitHub's.
  const ground = target.body
  const watcher = new MutationObserver(() => {
    /*
     * Another interface is taking the document over, and this one is on the
     * screen only until it does. Tending it past that point would start a fight:
     * this takeover would keep the region it was given, that one would take it
     * back, and neither would ever stop — a wedged tab rather than a flicker,
     * because each runs on the mutations the other makes.
     */
    if (container.hasAttribute(LEAVING)) {
      watcher.disconnect()
      return
    }

    /*
     * A surface borrowed from the screen being replaced lives only as long as the
     * region it sits in.
     *
     * It is somewhere to stand on an arrival GitHub is not rendering a page for —
     * but they may render one later all the same, and their router does exactly
     * that on the way back from a card to a list: the region holding the borrowed
     * surface is thrown away and the interface goes off the page with it. So the
     * borrowed surface is only ever used while it is still on the page, and the
     * region GitHub has now is what replaces it.
     */
    const standing = ours !== undefined && ours.isConnected ? ours : undefined

    if (!container.isConnected) {
      /*
       * A history traversal can remove the old region before GitHub creates a
       * new one. Keep the finished interface in the stable page surface during
       * that gap. The observer will move it into the proper region if one lands.
       */
      const view = target.defaultView
      const stillHere =
        view === null || place.owns(view.location.pathname, view.location.search)
      const temporary = isOurContainer(container) && stillHere
        ? (target.querySelector("main") ?? target.body)
        : null
      const fresh = standing ?? findSlot(target, place) ?? temporary
      if (fresh !== null) settle(fresh)
      return
    }

    // Moving up, when the conversation region turns up late.
    //
    // The wait above is deliberately short, so on a slow page the interface
    // goes into the whole repository content and is on the screen quickly.
    // That is the right trade for a reader and the wrong place to stay: if
    // GitHub does render a conversation after all, this is where the interface
    // moves into it. React does not mind being re-parented — the same nodes,
    // one level down — and nothing has to be drawn again.
    const better = standing ?? findConversationSlot(target, place)
    if (better !== null && container.parentElement !== better) {
      settle(better)
      return
    }

    const parent = container.parentElement
    if (parent !== null) hideTheirs(parent, container)
    hideTheirBands(target, place)
  })
  watcher.observe(ground, { childList: true, subtree: true })

  return {
    container,
    stepAside: () => {
      watcher.disconnect()

      /*
       * Another interface is taking this document, and everything below this line
       * describes its takeover rather than this one.
       *
       * Which happens on every press of a pull request from a list this drew: the
       * card is injected on the press and claims the document while the address
       * still says list, and the list's own script only finds out afterwards,
       * when the address finally moves. Going on from here would strip a page
       * that has already moved on — the flag lifted from under a card that is
       * standing there, and GitHub's conversation unhidden behind it. Taking this
       * container off the page would be worse still: for the few hundred
       * milliseconds before that card is up, it is the page.
       */
      if (container.hasAttribute(LEAVING)) return false

      takeOffThePage(container)

      target.documentElement.removeAttribute(TAKEN)
      target.documentElement.removeAttribute(SHOWN)
      /*
       * The address is not withdrawn here, and that is deliberate. It has an owner
       * now, and the owner is the screen that published it: taking it down from a
       * second place leaves a mark that nothing can put back, because the hook that
       * publishes it only runs again when its own address changes.
       */
      // Everything hidden anywhere, not only within the slot: their tab row
      // lives in the header above it and has to come back too.
      for (const theirs of target.querySelectorAll(`[${HIDDEN}]`)) {
        theirs.removeAttribute("hidden")
        theirs.removeAttribute(HIDDEN)
      }
      return true
    }
  }
}

/**
 * Waits until the address in the bar is the one this screen is for.
 *
 * The rule every screen stands by, held here so that none of them can hold it
 * differently. A screen is started at `pointerdown` and the address is pushed at the
 * `click` that follows, so for a hundred milliseconds or more the arriving screen has
 * everything it needs and no right to the page yet. Taking it in that window replaces
 * the bar, and the bar holds the link being pressed: the release lands on an element
 * that is no longer in the document, nothing pushes the address, and the reader is left
 * with one page's content under another page's address until a repair reloads the tab.
 *
 * True at once where the address is already ours, which is every ordinary load.
 *
 * True at once as well where the document has no window to ask — a document built for a
 * test has no address, and a rule about addresses has nothing to say about it.
 */
const whenTheAddressIsOurs = (
  target: Document,
  place: Place,
  patience: number
): Effect.Effect<boolean> => {
  const view = target.defaultView
  if (view === null) return Effect.succeed(true)

  /*
   * True at once as well for a place found in the document rather than at an
   * address. This rule waits for an address that is on its way, and for those
   * pages none is: the document in front of the reader is already the page, which
   * is how it was recognised. An organisation's single sign-on is the one of them —
   * served in place of what was asked for and under that page's own URL, so waiting
   * for its address to arrive would be waiting for the address it already has to
   * turn into something else. See `Place.loadedWhen`.
   */
  if (place.loadedWhen !== undefined) return Effect.succeed(true)

  if (place.owns(view.location.pathname, view.location.search)) return Effect.succeed(true)

  return Effect.callback((resume) => {
    let stop: Stop = () => {}
    let timer: ReturnType<typeof setTimeout> | undefined

    const finish = (arrived: boolean) => {
      clearTimeout(timer)
      stop()
      resume(Effect.succeed(arrived))
    }

    // Fifty rather than the watcher's usual fifth of a second: this one is between a
    // press and the page it asked for, where every tick is a tick of nothing happening.
    //
    // The whole address, because a person's three pages are one path and a `tab`: a
    // press from their repositories tab to their stars changes nothing else, and a
    // screen waiting on the path alone would wait until the failsafe gave up.
    stop = whenAddressChanges(
      view,
      (path, search) => {
        if (place.owns(path, search)) finish(true)
      },
      50
    )
    timer = setTimeout(() => finish(false), patience)

    return Effect.sync(() => {
      clearTimeout(timer)
      stop()
    })
  })
}

/**
 * Takes over as soon as the address is ours and GitHub has parsed somewhere to
 * take over.
 *
 * Reveals the page when it cannot: a pull request this fails to recognise still
 * has GitHub's own conversation on it, and showing that is far better than
 * leaving the region hidden behind a rule nothing is ever going to lift.
 */
export const takeOverSlotWhenReady = Effect.fn("mount.takeOverSlotWhenReady")(function* (
  target: Document,
  container: Element = interfaceContainer(target),
  patience: number = PATIENCE,
  settling: number = SETTLING,
  place: Place = CONVERSATION,
  /** Where to stand outright, for an arrival with no document coming. */
  ours?: Element,
  exactRoute?: string
) {
  // The address first, always. See {@link whenTheAddressIsOurs}: a screen that stands
  // before the address moves takes the link being pressed off the page with it.
  if (!(yield* whenTheAddressIsOurs(target, place, patience))) {
    reveal(target)
    ungate(target)
    return null
  }

  // Nothing to wait for: the surface is on the page now, and the region that
  // would have been waited for is never going to be rendered.
  if (ours === undefined && (yield* whenSlotAppears(target, patience, settling, place)) === null) {
    reveal(target)
    ungate(target)
    return null
  }

  const takeover = takeOverSlot(target, container, place, ours, exactRoute)
  if (takeover === null) {
    reveal(target)
    ungate(target)
  }
  return takeover
})

/**
 * What every interface here does with the answer, in one place.
 *
 * All four of them end the same way: wait for somewhere to stand, take charge
 * of it if there is one, give the page back to GitHub if the wait went wrong,
 * and cancel the failsafe either way. None of that is per-interface, and each
 * of them used to write it out again around a `try` — where a failure that
 * escaped left a page gated with nothing on it.
 *
 * The wait is passed unstarted so that a throw on the way to it is the same kind
 * of event as one after it.
 */
export const whenTakenOver = (
  begin: () => Effect.Effect<Takeover | null, unknown>,
  answer: {
    /** Null where there was nowhere to stand and GitHub has the page. */
    readonly taken: (takeover: Takeover | null) => void
    readonly failed: (cause: unknown) => void
    readonly settled: () => void
  }
  /*
   * Handed back so that a screen the reader has already left can stop waiting. The wait
   * holds an address watcher and a mutation observer, and both outlive the screen by
   * whatever is left of its patience unless somebody interrupts it. `settled` runs on
   * the way out either way.
   */
): Fiber.Fiber<void, never> =>
  Effect.runFork(
    Effect.suspend(begin).pipe(
      Effect.match({ onSuccess: answer.taken, onFailure: answer.failed }),
      Effect.ensuring(Effect.sync(answer.settled))
    )
  )
