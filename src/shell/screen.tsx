import { Effect, Fiber, Option } from "effect"
import type { ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { reportError } from "../observability/report"
import { whenAnotherBarStands } from "../ui/barSlot"
import { runWhenIdle } from "../ui/idle"
import {
  GOING,
  gate,
  handBack,
  hasPreparedScreen,
  interfaceContainer,
  markPage,
  ourSurface,
  rememberLiveScreen,
  reveal,
  takeOverSlotWhenReady,
  ungate,
  whenTakenOver,
  whenThereIsAPage
} from "../ui/mount"
import { landWhenArrived } from "../ui/landing"
import type { Place } from "../ui/place"
import { OWNED_TRAVERSAL } from "../ui/preparedNavigation"
import { prepareRouteActivation } from "../ui/routeActivation"
import { Supplied } from "./supplied"

/**
 * Standing one screen on a GitHub page, for every screen there is.
 *
 * Eleven of them, and each used to write this out again: gate the page, build the
 * container, make a root, render into it, borrow the surface of the screen being left,
 * wait to take the page, hand the page back on the way out, and hold a failsafe over
 * the lot in case any of that never finishes. The same forty lines eleven times.
 *
 * Which is not a tidiness complaint. Every one of those lines is an invariant, and a
 * screen that held ten of the eleven looked exactly like a screen that held all of
 * them until a reader found the difference. The run screen borrowed no surface, so
 * pressing a run from the Actions list waited on markup GitHub was never going to
 * render. Two screens forgot to unmount when their takeover failed, and their bars
 * stayed on the page beside the real one. Both were one screen disagreeing with ten,
 * and neither could happen to a rule that has one home.
 *
 * What is left to a screen is what really differs: what it reads, what it draws, and
 * what else it holds open while it is on the page.
 */

/**
 * The last resort that stops a gated page staying blank.
 *
 * `gates.load.css` hides GitHub's version of the page from the first paint and this is
 * what lifts it again. Anything that stops a screen reaching its takeover — a throw, a
 * hang, a GitHub deploy that moves the region — would otherwise leave a reader looking
 * at nothing at all, which is far worse than looking at the page we meant to replace.
 */
const FAILSAFE = 20_000

/**
 * The one React root a container has, and which stand-up owns it.
 *
 * A screen taken up again is handed the container it already has — see
 * `interfaceContainer`, where coming back to a list that never left the page is the case
 * it is for. A second root on that node is what React warns about in a development build
 * and says nothing about in the one a reader runs, and the cost is paid in the bar: every
 * root's own copy of `mount.ts` has `ours` pointing at that same container, so
 * `oursToDraw` is true for all of them and each portals a bar into the one slot. Measured
 * on the page: /pulls, a pull request, Back, Back, and three bars stacked, three palettes
 * on one ⌘K, and Escape shutting one of them.
 *
 * So the root is kept here rather than made again, and the stand-up that arrived last owns
 * it. Owning matters on the way down: the screen being taken up again is told to come down
 * by the very move that replaced it, and unmounting then would take the tree the reader is
 * looking at with it.
 */
const roots = new WeakMap<Element, { readonly root: Root; owner: symbol }>()
const preparedRoots = new WeakSet<Element>()
const preparedBridges = new WeakMap<Element, { adopt: (standing: Standing) => void }>()

const rootOn = (container: Element, owner: symbol): Root => {
  const had = roots.get(container)
  if (had !== undefined) {
    had.owner = owner
    return had.root
  }
  const made = createRoot(container)
  roots.set(container, { root: made, owner })
  return made
}

/** Whether this stand-up is still the one whose tree the container is showing. */
const stillOwned = (container: Element, owner: symbol): boolean =>
  roots.get(container)?.owner === owner

/** The page a screen is standing on, handed to it so it can draw and leave. */
export type Standing = {
  /** Where this screen is rendering. Already in the document. */
  readonly container: Element
  /**
   * Gives the page back to GitHub: their content returns and ours comes down.
   *
   * False where there was nothing to give back because another screen is taking the
   * page instead — see `Takeover.stepAside`.
   */
  readonly stepAside: () => boolean
  /**
   * Draws again, for a screen that shows something else without changing page.
   *
   * A file opening on a repository's front page is the case: the address changes, so
   * that the file has a link and the back button returns to the README, and standing
   * the screen up again for it would re-read the repository and lose the tree.
   */
  readonly redraw: () => void
  /** Takes the screen off the page and gives it back to GitHub. */
  readonly close: () => void
}

export type Screen = {
  /** Which of GitHub's pages this stands on, and which addresses are its own. */
  readonly place: Place
  /** The exact route this screen draws, including before a traversal commits. */
  readonly route?: string
  /** What to draw. Called again on every {@link Standing.redraw}. */
  readonly draw: (standing: Standing) => ReactNode
  /**
   * Anything else held open while this screen is on the page: presses answered on its
   * behalf, flags the shell reads. Undone the moment the screen leaves the screen,
   * which is not the moment the address changes.
   */
  readonly holding?: (container: Element) => () => void
  /**
   * Whether to stand on the surface of the screen being left, where there is one.
   *
   * True for every screen a reader reaches by pressing one of our own links, which is
   * every screen. False only where a document really is on its way and the region it
   * brings is the right place to be — a pull request opened cold, which is the one
   * case that has ever wanted it.
   */
  readonly borrowing?: boolean
  /** How long GitHub's own region is waited for before a worse one will do. */
  readonly settling?: number
}

/**
 * Puts a screen on the page, and hands back the way to take it off again.
 *
 * The closing half is not tidiness. GitHub navigates within a repository without
 * loading a page, so a screen left standing would still be over the next one, and the
 * attribute holding GitHub's own content out of sight would still be set.
 */
export const standAScreen = (screen: Screen): Standing => {
  const { place, route, draw, holding, borrowing = true, settling } = screen
  /*
   * Named before anything else. The rules that hide GitHub's version of this page are
   * written per page and hang on this attribute, and on a move between two of our own
   * screens the name on the document is still the page being left.
   */
  markPage(document, place)

  // On a page load this changes nothing, the rule being in force already. On a soft
  // navigation it is the difference between arriving in our hand and arriving in
  // GitHub's and being replaced a moment later.
  gate(document)
  const failsafe = setTimeout(() => {
    reveal(document)
    ungate(document)
  }, FAILSAFE)

  // And the entrance, which belongs to the first screen this document shows and to
  // no screen after it. Said here rather than in one screen's own tree, because
  // every screen has panels and only one of them is a pull request.
  const stopLanding = landWhenArrived(document)

  // Assigned once there is a page to step aside from. Until then the button that calls
  // it cannot be on the screen, because nothing is.
  let stepAside = (): boolean => true

  // Reads false the moment this is no longer the page being shown: the takeover below
  // waits on an address and on GitHub's React, and can finish long afterwards.
  let watching = true

  const container = interfaceContainer(document, place, route)
  const prepared = preparedRoots.delete(container)
  const activation = prepared ? prepareRouteActivation(container) : null
  /** This stand-up, told apart from another on the same container. */
  const mine = Symbol(place.name)
  const root = rootOn(container, mine)
  const letGo = holding?.(container) ?? (() => {})

  /** The new standing that claimed this live tree from the history cache. */
  let adopted: Standing | undefined
  /** Stops the one return listener installed while this live tree is cached. */
  let stopResuming = (): void => {}

  let down = false
  // Assigned by the wait at the foot of this function, and called from `standDown` above
  // it. Until then there is nothing to stop: no screen comes down before it is drawn.
  let stopWaitingForABody = (): void => {}
  /**
   * Takes the tree down and lets go of everything the screen held, once.
   *
   * Once, because the two ways off the page overlap: the screen replacing this one says
   * so through {@link GOING}, and a screen closing says so itself, and a screen that
   * gave the page back has just been told both. Unmounting a root twice is a warning in
   * the console and a fault report for something that went right.
   *
   * Late, and only the unmounting. Everything of this screen the reader can see is
   * inside a container that has already left the document by now — except the bar,
   * which is portalled into a slot of its own and is therefore still on the screen.
   * The screen arriving needs about eighty milliseconds to draw its own, so unmounting
   * in the same breath left the page with no bar at all for that long, and the page
   * under it jumped up by the height of one and back down. So the slot says when: see
   * {@link whenAnotherBarStands}, and `glass.css` for the one frame they overlap.
   */
  const unmount = (): void => {
    stopResuming()
    if (!stillOwned(container, mine)) return
    roots.delete(container)
    root.unmount()
  }
  const standDown = (event?: Event): void => {
    if (down) return
    down = true
    activation?.cancel()
    const keepLive = event instanceof CustomEvent && event.detail === true
    stopWaitingForABody()
    letGo()
    whenAnotherBarStands(document, () => {
      // Another stand-up on this container has the tree now, which is the screen on the
      // page: this one's tree stopped existing the moment that render replaced it.
      // Cleanup can be expensive on a large pull request. Leave the navigation task
      // free to paint the prepared route before React runs every outgoing cleanup.
      const remembered =
        keepLive &&
        rememberLiveScreen(container, place, () => {
          stopResuming()
          runWhenIdle(unmount, 2_000)
        })
      if (remembered) {
        preparedRoots.add(container)
        preparedBridges.set(container, {
          adopt: (screen) => {
            adopted = screen
          }
        })
        const exactRoute = container.getAttribute("data-gitquiet-route")
        if (exactRoute !== null) {
          const resume = (event: Event): void => {
            if ((event as CustomEvent<string>).detail !== exactRoute) return
            if (!hasPreparedScreen(document, exactRoute, place)) return
            stopResuming()
            standAScreen(screen)
          }
          document.addEventListener(OWNED_TRAVERSAL, resume)
          stopResuming = () => {
            document.removeEventListener(OWNED_TRAVERSAL, resume)
            stopResuming = () => {}
          }
        }
        return
      }
      runWhenIdle(unmount, 2_000)
    })
  }

  /*
   * Said by the screen taking the page: this one is off it now, which is not the same
   * moment as the address leaving it. A reader pressing a pull request is looking at the
   * list for the few hundred milliseconds the card needs to arrive.
   */
  container.addEventListener(GOING, standDown)

  /*
   * Held until the wait at the foot of this function has a page to work with, so that
   * `close` has something to interrupt from the moment it can be called.
   */
  let waiting: ReturnType<typeof whenTakenOver> | null = null

  const standUp = (): void => {
    /*
     * Where a screen of ours is the page being left, its surface is the one to stand on.
     * Read after the container was made, which is what marks the screen on its way out.
     *
     * Waiting for GitHub's own region instead was a second of the old page still on the
     * screen after the reader asked for this one. Their page is behind ours, hidden
     * rather than gone, and nothing is going to make them render it again: no document
     * is coming, because answering the press without one is the whole point.
     */
    const surface = borrowing
      ? (container.parentElement ?? ourSurface(document) ?? undefined)
      : undefined

    waiting = whenTakenOver(
      () =>
        takeOverSlotWhenReady(
          document,
          container,
          undefined,
          settling,
          place,
          surface,
          route
        ),
      {
        taken: (takeover) => {
          /*
           * The reader left while this was waiting for the address or for a region. The
           * takeover still landed, and a container put on the page by a screen nobody is
           * on is a second interface standing beside the real one — with a bar of its
           * own, which is how two bars used to end up on one page.
           */
          if (!watching) {
            activation?.cancel()
            takeover?.stepAside()
            standDown()
            return
          }
          if (takeover === null) {
            activation?.cancel()
            // The page is GitHub's now. Nothing is going to look at this tree.
            standDown()
            return
          }
          activation?.start()
          stepAside = takeover.stepAside
        },
        failed: (cause) => {
          activation?.cancel()
          // The wait ended in a throw, so this tree has no page and none is coming: the
          // same case as `takeover === null` above, and it comes down the same way.
          standDown()
          reveal(document)
          ungate(document)
          reportError(cause)
        },
        settled: () => clearTimeout(failsafe)
      }
    )

    if (!prepared) standing.redraw()
  }

  const standing: Standing = {
    container,
    stepAside: () => adopted?.stepAside() ?? stepAside(),
    // Nothing is said here about which address is up. This runs at the press, before
    // the screen has read anything, so the only address available is the one asked
    // for. `useDrawnAt` publishes the one that is drawn.
    redraw: () => {
      if (adopted !== undefined) {
        adopted.redraw()
        return
      }
      root.render(<Supplied root={container}>{draw(standing)}</Supplied>)
    },
    close: () => {
      if (adopted !== undefined) {
        adopted.close()
        return
      }
      watching = false
      clearTimeout(failsafe)
      stopLanding()
      // Nothing is waiting for this page any more. Left alone the wait holds an address
      // watcher and a mutation observer open for as long as its patience lasts. Null
      // where the reader left before the document had a body, which is a screen that
      // never began to look for a page.
      if (waiting !== null) Effect.runFork(Fiber.interrupt(waiting))
      // Where another screen is taking the page, the rest of this is its business: it
      // says when this one leaves the screen and comes down.
      if (!stepAside()) return
      /*
       * Nobody else is going to say it, so this does.
       *
       * Stepping aside from a page this screen had says {@link GOING} on the way, and
       * this is already done by the time it returns. The case it is here for is the one
       * that never reached a page at all: a press abandoned, an address that went
       * somewhere else. That tree was left mounted, drawing its bar into the one bar
       * slot on a page it never stood on — the second bar, again.
       */
      standDown()
      // Handed back rather than revealed: another of these screens may already be gating
      // for the address being arrived at, and lifting that shows GitHub's own page until
      // it mounts.
      handBack(document)
    }
  }
  if (prepared) {
    const bridge = preparedBridges.get(container)
    bridge?.adopt(standing)
    preparedBridges.delete(container)
  }
  /*
   * Everything above this line is a statement about the document; everything in
   * {@link standUp} needs a page to put a screen on, and at `document_start` there is
   * not one yet. See {@link whenThereIsAPage} for what that cost. A screen the reader
   * left before the parser produced a body is not stood up at all.
   */
  stopWaitingForABody = whenThereIsAPage(document, () => {
    if (down || !watching) return
    standUp()
  })

  return standing
}

/**
 * Builds one screen in a detached container, without naming or taking the page.
 *
 * A route pre-render uses this during pointer rest. The finished HTML can enter the
 * route cache, while the current screen keeps every event handler until the click.
 */
export const prepareAScreen = (draw: (standing: Standing) => ReactNode): Standing => {
  const container = document.createElement("div")
  const owner = Symbol("prepared screen")
  const root = rootOn(container, owner)
  let closed = false
  let adopted: Standing | undefined

  const standing: Standing = {
    container,
    stepAside: () => adopted?.stepAside() ?? false,
    redraw: () => {
      if (adopted !== undefined) {
        adopted.redraw()
        return
      }
      if (closed) return
      root.render(<Supplied root={container} quiet>{draw(standing)}</Supplied>)
    },
    close: () => {
      if (adopted !== undefined) {
        adopted.close()
        return
      }
      if (closed) return
      closed = true
      runWhenIdle(() => {
        if (!stillOwned(container, owner)) return
        roots.delete(container)
        root.unmount()
      }, 2_000)
    }
  }

  preparedRoots.add(container)
  preparedBridges.set(container, {
    adopt: (screen) => {
      adopted = screen
    }
  })
  standing.redraw()
  return standing
}

/**
 * A read that is already running by the time the screen asks for it.
 *
 * Every screen here starts its read at `document_start` and mounts once GitHub has given
 * it somewhere to stand, which are two different moments. Held this way the read is one
 * read: the first caller joins the fiber that is already in flight and is handed what it
 * reported on the way, and a later caller — a reader coming back to the tab, which
 * `useLive` revalidates on — gets a fresh one.
 */
export const held = <A, E>(
  reading: (partly: (value: A) => void) => Effect.Effect<A, E>
): ((partly: (value: A) => void) => Effect.Effect<A, E>) => {
  /**
   * The last thing the read said while nobody was listening yet.
   *
   * Which is most of what a staged read has to say, because the first stage is the one
   * that costs nothing: page one of a person's repositories is in the document GitHub
   * served, so it is reported almost at once and React subscribes a frame or two later.
   * Measured on a live profile before this — thirty rows ready 673ms after the press,
   * and on the screen at 3.9 seconds, when the walk behind them ended.
   */
  let last: Option.Option<A> = Option.none()
  let report: (value: A) => void = (value) => {
    last = Option.some(value)
  }

  const first = Effect.runFork(reading((value) => report(value)))
  let started = false

  return (partly) => {
    if (started) return reading(partly)

    started = true
    report = partly

    // On a microtask rather than here, because this runs inside the atom that asked and
    // a report is a write to another one.
    Option.match(last, {
      onNone: () => {},
      onSome: (value) => queueMicrotask(() => partly(value))
    })

    return Fiber.join(first)
  }
}
