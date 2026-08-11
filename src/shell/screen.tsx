import { Effect, Fiber } from "effect"
import type { ReactNode } from "react"
import { createRoot } from "react-dom/client"
import { reportError } from "../observability/sentry"
import { whenAnotherBarStands } from "../ui/barSlot"
import {
  GOING,
  gate,
  handBack,
  interfaceContainer,
  markPage,
  ourSurface,
  reveal,
  takeOverSlotWhenReady,
  ungate,
  whenTakenOver
} from "../ui/mount"
import type { Place } from "../ui/place"
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
export const standAScreen = ({
  place,
  draw,
  holding,
  borrowing = true,
  settling
}: Screen): Standing => {
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

  // Assigned once there is a page to step aside from. Until then the button that calls
  // it cannot be on the screen, because nothing is.
  let stepAside = (): boolean => true

  // Reads false the moment this is no longer the page being shown: the takeover below
  // waits on an address and on GitHub's React, and can finish long afterwards.
  let watching = true

  const container = interfaceContainer(document, place)
  const root = createRoot(container)
  const letGo = holding?.(container) ?? (() => {})

  let down = false
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
  const standDown = (): void => {
    if (down) return
    down = true
    letGo()
    whenAnotherBarStands(document, () => root.unmount())
  }

  /*
   * Said by the screen taking the page: this one is off it now, which is not the same
   * moment as the address leaving it. A reader pressing a pull request is looking at the
   * list for the few hundred milliseconds the card needs to arrive.
   */
  container.addEventListener(GOING, standDown)

  /*
   * Where a screen of ours is the page being left, its surface is the one to stand on.
   * Read after the container was made, which is what marks the screen on its way out.
   *
   * Waiting for GitHub's own region instead was a second of the old page still on the
   * screen after the reader asked for this one. Their page is behind ours, hidden
   * rather than gone, and nothing is going to make them render it again: no document
   * is coming, because answering the press without one is the whole point.
   */
  const surface = borrowing ? (ourSurface(document) ?? undefined) : undefined

  const waiting = whenTakenOver(
    () => takeOverSlotWhenReady(document, container, undefined, settling, place, surface),
    {
      taken: (takeover) => {
        /*
         * The reader left while this was waiting for the address or for a region. The
         * takeover still landed, and a container put on the page by a screen nobody is
         * on is a second interface standing beside the real one — with a bar of its
         * own, which is how two bars used to end up on one page.
         */
        if (!watching) {
          takeover?.stepAside()
          standDown()
          return
        }
        if (takeover === null) {
          // The page is GitHub's now. Nothing is going to look at this tree.
          standDown()
          return
        }
        stepAside = takeover.stepAside
      },
      failed: (cause) => {
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

  const standing: Standing = {
    container,
    stepAside: () => stepAside(),
    redraw: () => root.render(<Supplied root={container}>{draw(standing)}</Supplied>),
    close: () => {
      watching = false
      clearTimeout(failsafe)
      // Nothing is waiting for this page any more. Left alone the wait holds an address
      // watcher and a mutation observer open for as long as its patience lasts.
      Effect.runFork(Fiber.interrupt(waiting))
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
  standing.redraw()

  return standing
}
