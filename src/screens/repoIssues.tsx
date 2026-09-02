import { Effect, Fiber, Option } from "effect"
import { rememberedRepositories } from "@/app/destinations"
import { forgetIntent, intendedPath } from "@/app/intent"
import { type ListedIssues, loadIssueList, rememberedIssueList } from "@/app/issueList"
import { drawingIssues } from "@/app/rows"
import { type IssueList, issueListIn, queryFor, seeding } from "@/domain/issueList"
import { initialiseErrorReporting, reportError } from "@/observability/sentry"
import type { View } from "@/domain/Settings"
import { chosenView } from "@/app/settings"
import { goWithin } from "@/ui/going"
import { handBack, markPage, reveal, ungate } from "@/ui/mount"
import { whenLocationChanges } from "@/ui/navigation"
import { REPO_ISSUES } from "@/ui/place"
import { standAScreen } from "@/shell/screen"
import { settings, throughGitHub } from "@/shell/supplied"
import { IssueListScreen } from "@/ui/IssueListScreen"
import { openedNamed } from "@/ui/lastDrawn"
import "@/ui/styles.css"

/**
 * Every repository the reader has, as the store already knows them, for the
 * palette in the bar. Cache only, for the reason a repository's pull request
 * list reads it that way.
 */
const recallRepositories = () => rememberedRepositories().pipe(throughGitHub)

/**
 * One page of one repository's issues, told apart from every other.
 *
 * The search and the page are in it because they are what the address is a view
 * of: page four of "closed, mine" is not page one of the default search.
 */
const addressOf = (list: IssueList): string =>
  `${list.repo.owner}/${list.repo.repo}?${list.query}#${list.page}`

/**
 * The list as the reader last saw it, kept for as long as this document lives.
 *
 * Worth less here than on a repository's pull request list, and kept for the
 * same reason all the same: leaving a row does not load a page, so coming back
 * should be the page that was left rather than a fresh read of it.
 */
let asLastSeen: { readonly address: string; readonly listed: ListedIssues } | undefined

/**
 * Puts one page of a repository's issues on the page, and hands back the way to
 * take it off again.
 *
 * The closing half is not tidiness. GitHub navigates within a repository
 * without loading a page, so the list would otherwise still be standing over
 * the Code tab, and the attribute holding GitHub's own content out of sight
 * would still be set.
 */
const open = (
  list: IssueList,
  /** Another view of this same screen, without a document. See {@link goWithin}. */
  press: (path: string) => void,
  /** The exact pathname this screen is stood up for. See `DrawnAt` in `drawnAt.tsx`. */
  at: string
): (() => void) => {
  const asked = queryFor(list)

  /**
   * What this list has on the screen, said for the screen that a press on one of
   * these rows opens.
   *
   * Both answers below say it, because either can be the page the reader is
   * pressing a row of: what was remembered paints first and the live read lands
   * over it. A memory that landed second would leave the issue screen a header one
   * read old, which is the bargain everything remembered here already makes. See
   * `src/app/rows.ts`.
   */
  const drawn = (listed: ListedIssues): void => drawingIssues(window, listed.rows)

  const reading = () =>
    loadIssueList(asked, list.page).pipe(
      throughGitHub,
      Effect.tap((listed) =>
        Effect.sync(() => {
          asLastSeen = { address: addressOf(list), listed }
          drawn(listed)
        })
      ),
      Effect.tapError((error) => Effect.sync(() => reportError(error)))
    )

  /** This very page, as this document last had it up. */
  const held = asLastSeen?.address === addressOf(list) ? asLastSeen.listed : undefined

  /*
   * What to show while the live read finds out what is there now, asked for at
   * the same moment as the read rather than after it: the whole value of it is
   * arriving first, and a storage read is a few milliseconds against most of a
   * second for a search.
   */
  const remembered = () =>
    (held !== undefined
      ? Effect.succeed(Option.some(held))
      : rememberedIssueList(asked, list.page).pipe(
          throughGitHub,
          // Nothing was remembered, or the store refused to say. Neither is
          // worth reporting: the live read is on its way and is the answer.
          Effect.catch(() => Effect.succeed(Option.none<ListedIssues>()))
        )
    ).pipe(
      Effect.tap((was) =>
        Effect.sync(() => {
          if (Option.isSome(was)) drawn(was.value)
        })
      )
    )

  // Started before anything is waited on. Reading the list and waiting for
  // GitHub to render a region to stand in have nothing to say to each other.
  const first = Effect.runFork(reading())

  // The first ask joins what is already in flight; every ask after it is
  // somebody saying the list has changed, and joining that same finished fiber
  // would answer with the page they are trying to leave.
  let started = false
  const read = () => {
    if (!started) {
      started = true
      return Fiber.join(first)
    }
    return reading()
  }

  /**
   * Another page of the same list, asked for the way the address asks for it.
   *
   * Written into the address rather than read straight off GitHub, because the
   * address is what this page is a view of: a reader who pages to the fourth
   * page and sends somebody the link has sent them the fourth page.
   */
  const goToPage = (page: number): void => {
    const address = new URL(window.location.href)
    if (page <= 1) address.searchParams.delete("page")
    else address.searchParams.set("page", String(page))
    press(`${address.pathname}${address.search}`)
  }

  return standAScreen({
    place: REPO_ISSUES,
    draw: (standing) => (
      <IssueListScreen
        at={at}
        repo={list.repo}
        load={read}
        recallRepositories={recallRepositories}
        preload={remembered}
        onPage={goToPage}
        where={openedNamed("issue-list", list)}
        seed={seeding(list)}
        onStepAside={standing.stepAside}
      />
    )
  }).close
}

/**
 * Puts this screen in charge of the document, once.
 *
 * Called by the shell, which is the one script GitHub cannot navigate away from
 * — see `src/entrypoints/shell.content.ts`. It decides from the address that
 * this is the screen wanted and imports this file; a second press of the same
 * page finds it already imported and already following the address on its own.
 */
export const start = (): void => {
  // Before anything else, because the rules that hide GitHub's list are written
  // per page and hang on this. Synchronous and first: an attribute set a frame
  // late is a frame of their list on the screen.
  markPage(document, REPO_ISSUES)

  initialiseErrorReporting("repo-issues")

  const store = settings()

  let close = (): void => {}
  let view: View = "ours"

  /**
   * The address the screen on the page was stood up for, or nothing where none of
   * ours is standing. Read by {@link goWithin}, which asks it before and after a
   * press to tell a redraw from a screen that never came.
   */
  let standingFor: string | undefined

  /** Another view of this screen, which here means another page of the list. */
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

    const list = issueListIn(url)

    /*
     * Somewhere else in the repository — the Code tab, one issue, a pull
     * request. The stylesheet is gating this page too, because a stylesheet
     * cannot read a URL, so handing it back is the first thing this does.
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

  // The whole address, not the path: which page of which search this is lives
  // in the query, and a reader pressing Next changes nothing else.
  whenLocationChanges(window, () => show(window.location.href))

  Effect.runFork(
    chosenView(store).pipe(
      Effect.map((chosen) => {
        view = chosen

        /*
         * What the address says, or — while GitHub is still fetching and the
         * address still names the page being left — what the reader pressed.
         */
        const here = window.location.href
        const promise = intendedPath(window)
        forgetIntent(window)

        if (Option.isSome(issueListIn(here))) show(here)
        else if (promise !== null) {
          const asked = new URL(promise, window.location.origin).toString()
          if (Option.isSome(issueListIn(asked))) show(asked)
          else reveal(document)
        } else reveal(document)
      })
    )
  )
}
