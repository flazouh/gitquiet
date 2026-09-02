import { Effect, Fiber, Option } from "effect"
import {
  loadAuthors,
  loadBranches,
  loadHistory,
  loadSizes,
  rememberedHistory
} from "@/app/commitList"
import { rememberedRepositories } from "@/app/destinations"
import { forgetIntent, intendedPath } from "@/app/intent"
import { chosenView } from "@/app/settings"
import { type CommitList, commitListIn, type History, type Stat } from "@/domain/commitList"
import type { Participant } from "@/domain/PullRequest"
import type { View } from "@/domain/Settings"
import { initialiseErrorReporting, reportError } from "@/observability/sentry"
import { standAScreen } from "@/shell/screen"
import { settings, throughGitHub } from "@/shell/supplied"
import { HistoryScreen } from "@/ui/HistoryScreen"
import { goWithin } from "@/ui/going"
import { handBack, markPage, reveal, ungate } from "@/ui/mount"
import { whenLocationChanges } from "@/ui/navigation"
import { COMMITS } from "@/ui/place"
import { openedNamed } from "@/ui/lastDrawn"
import "@/ui/styles.css"

/**
 * Every repository the reader has, as the store already knows them.
 *
 * For the palette in the bar, and cache only: a page asking GitHub for a hundred and
 * fifty repositories on the chance somebody presses ⌘K is a request nobody asked for.
 */
const recallRepositories = () => rememberedRepositories().pipe(throughGitHub)

/**
 * Puts one page of a branch's commits on the page, and hands back the way to take it
 * off again.
 *
 * The closing half is not tidiness. GitHub navigates within a repository without
 * loading a page, so this list would otherwise still be standing over the Code tab.
 */
const open = (
  list: CommitList,
  /** Another view of this same screen, without a document. See {@link goWithin}. */
  press: (path: string) => void,
  /** The exact pathname this screen is stood up for. See `DrawnAt` in `drawnAt.tsx`. */
  at: string
): (() => void) => {
  // Started before anything is waited on: reading the branch and waiting for GitHub
  // to render a region to stand in have nothing to say to each other.
  const reading = (partly: (history: History) => void) =>
    loadHistory(list, partly).pipe(
      throughGitHub,
      Effect.tapError((error) => Effect.sync(() => reportError(error)))
    )

  /*
   * The rows, which land a whole round trip before the marks beside them do.
   *
   * Held here as well as reported, because this read starts before the screen
   * exists: the list can be complete by the time React asks, and a stage nobody
   * was there to hear is a page that waits for the second read to draw the first.
   */
  let sofar: History | undefined
  let tell: ((history: History) => void) | undefined

  const first = Effect.runFork(
    reading((history) => {
      sofar = history
      tell?.(history)
    })
  )

  /*
   * The first ask joins what is already in flight; every ask after it is the screen
   * saying it wants to know again — on coming back to the tab, say — and joining that
   * same finished fiber would answer with the page it is trying to leave.
   */
  let started = false
  const read = (partly: (history: History) => void) => {
    if (!started) {
      started = true
      tell = partly
      if (sofar !== undefined) partly(sofar)
      return Fiber.join(first)
    }
    return reading(partly)
  }

  /**
   * The same page as the last visit left it, where this browser has read it before.
   *
   * Nothing was remembered, or the store refused to say. Neither is worth reporting:
   * the live read is on its way and is the answer either way.
   */
  const remembered = () =>
    rememberedHistory(list).pipe(
      throughGitHub,
      Effect.catch(() => Effect.succeed(Option.none<History>()))
    )

  /**
   * How big each commit on the page is, said one at a time as each is counted.
   *
   * Failure here is a column that stays empty, which is what the column looks
   * like before it is read anyway. Nothing to report and nothing to say.
   */
  const askSizes = (shas: ReadonlyArray<string>, tell: (sha: string, stat: Stat) => void) =>
    loadSizes(list, shas, tell).pipe(
      throughGitHub,
      Effect.catch(() => Effect.void)
    )

  /**
   * Every branch of the repository, once the picker has been opened.
   *
   * Not before: the route answers with all thousand of them, and a page that
   * reads it on the chance somebody presses the control is a page paying for a
   * control most readers never touch.
   */
  const askBranches = (partly: (branches: ReadonlyArray<string>) => void) =>
    loadBranches(list.repo, partly).pipe(throughGitHub)

  /** Everybody who has written a commit here, once the author filter is opened. */
  const askAuthors = (partly: (authors: ReadonlyArray<Participant>) => void) =>
    loadAuthors(list, partly).pipe(throughGitHub)

  /**
   * Another page of the same branch, asked for the way the address asks for it.
   *
   * Written into the address rather than held in this script, because the address is
   * what this page is a view of: a reader who pages back a fortnight and sends
   * somebody the link has sent them that fortnight.
   */
  const goTo = (path: string): void => {
    press(path)
  }

  return standAScreen({
    place: COMMITS,
    draw: (standing) => (
      <HistoryScreen
        at={at}
        list={list}
        load={read}
        preload={remembered}
        sizes={askSizes}
        branches={askBranches}
        authors={askAuthors}
        onGo={goTo}
        where={openedNamed("commits", list)}
        onStepAside={standing.stepAside}
        recallRepositories={recallRepositories}
      />
    )
  }).close
}

/**
 * Puts this screen in charge of the document, once.
 *
 * Called by the shell, which is the one script GitHub cannot navigate away from — see
 * `src/entrypoints/shell.content.ts`. It decides from the address that this is the
 * screen wanted and imports this file; a second press of the same page finds it
 * already imported and already following the address on its own.
 */
export const start = (): void => {
  // Before anything else, because the rules that hide GitHub's list are written per
  // page and hang on this. An attribute set a frame late is a frame of their page.
  markPage(document, COMMITS)

  initialiseErrorReporting("commits")

  const store = settings()

  let close = (): void => {}
  let view: View = "ours"

  /**
   * The address the screen on the page was stood up for, or nothing where none of
   * ours is standing. Read by {@link goWithin}, which asks it before and after a
   * press to tell a redraw from a screen that never came.
   */
  let standingFor: string | undefined

  /** Another view of this screen, which here means another page of the branch. */
  const press = (path: string): void =>
    goWithin(
      window,
      path,
      () => show(window.location.href),
      () => standingFor
    )

  const show = (url: string): void => {
    // One address asked for twice, which is one screen. A press within this
    // screen redraws for the new address itself.
    if (standingFor === url) return

    close()
    close = () => {}
    standingFor = undefined

    const list = commitListIn(url)

    /*
     * Somewhere else in the repository — the Code tab, an issue, one commit. The
     * stylesheet is gating this page too, because a stylesheet cannot read a URL, so
     * handing it back is the first thing this does.
     */
    if (Option.isNone(list)) {
      handBack(document)
      return
    }

    // Their list, because that is what was asked for last time.
    if (view === "github") {
      reveal(document)
      ungate(document)
      return
    }

    close = open(list.value, press, new URL(url).pathname)
    standingFor = url
  }

  // The whole address, not the path: which page of the branch this is lives in the
  // query, and a reader pressing Older changes nothing else.
  whenLocationChanges(window, () => show(window.location.href))

  Effect.runFork(
    chosenView(store).pipe(
      Effect.map((chosen) => {
        view = chosen

        /*
         * What the address says, or — while GitHub is still fetching and the address
         * still names the page being left — what the reader pressed.
         */
        const here = window.location.href
        const promise = intendedPath(window)
        forgetIntent(window)

        if (Option.isSome(commitListIn(here))) show(here)
        else if (promise !== null) {
          const asked = new URL(promise, window.location.origin).toString()
          if (Option.isSome(commitListIn(asked))) show(asked)
          else reveal(document)
        } else reveal(document)
      })
    )
  )
}
