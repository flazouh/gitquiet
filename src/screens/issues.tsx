import { Effect, Fiber, Option } from "effect"
import { rememberedRepositories } from "@/app/destinations"
import { forgetIntent, intendedPath } from "@/app/intent"
import { type ListedIssues, loadIssueList, rememberedIssueList } from "@/app/issueList"
import { drawingIssues } from "@/app/rows"
import {
  type IssueDashboard,
  issueDashboardIn,
  pathOf,
  queryFor,
  seeding
} from "@/domain/issueDashboard"
import type { Involvement } from "@/domain/issues"
import { reportError } from "@/observability/report"
import type { View } from "@/domain/Settings"
import { chosenView } from "@/app/settings"
import { goWithin } from "@/ui/going"
import { handBack, markPage, reveal, ungate } from "@/ui/mount"
import { whenLocationChanges } from "@/ui/navigation"
import { ISSUES } from "@/ui/place"
import { standAScreen } from "@/shell/screen"
import { settings, throughGitHub } from "@/shell/supplied"
import { IssuesScreen } from "@/ui/IssuesScreen"
import { openedNamed } from "@/ui/lastDrawn"
import "@/ui/styles.css"

/**
 * Every repository the reader has, as the store already knows them, for the
 * palette in the bar. Cache only, for the reason every other screen reads it
 * that way.
 */
const recallRepositories = () => rememberedRepositories().pipe(throughGitHub)

/**
 * One page of one tab, told apart from every other.
 *
 * The search and the page are in it because they are what the address is a view
 * of: page four of Mentioned is not page one of Assigned.
 */
const addressOf = (dash: IssueDashboard): string =>
  `${dash.involvement}?${dash.query}#${dash.page}`

/**
 * The list as the reader last saw it, kept for as long as this document lives.
 *
 * One page held rather than every page visited: going back means the page just
 * left, and a document open for an afternoon should not accumulate every tab
 * its reader has passed through.
 */
let asLastSeen: { readonly address: string; readonly listed: ListedIssues } | undefined

/**
 * Puts one page of the reader's own issues on the page, and hands back the way
 * to take it off again.
 *
 * The closing half is not tidiness. GitHub navigates between these tabs without
 * loading a page, so the list would otherwise still be standing over whatever
 * comes next.
 */
const open = (
  dash: IssueDashboard,
  /** Another view of this same screen, without a document. See {@link goWithin}. */
  press: (path: string) => void,
  /** The exact pathname this screen is stood up for. See `DrawnAt` in `drawnAt.tsx`. */
  at: string
): (() => void) => {
  const asked = queryFor(dash)

  /**
   * What this tab has on the screen, said for the screen that a press on one of
   * these rows opens. The same as a repository's own list does it, and for the
   * same reason: see `src/app/rows.ts`.
   */
  const drawn = (listed: ListedIssues): void => drawingIssues(window, listed.rows)

  const reading = () =>
    loadIssueList(asked, dash.page).pipe(
      throughGitHub,
      Effect.tap((listed) =>
        Effect.sync(() => {
          asLastSeen = { address: addressOf(dash), listed }
          drawn(listed)
        })
      ),
      Effect.tapError((error) => Effect.sync(() => reportError(error)))
    )

  /** This very page, as this document last had it up. */
  const held = asLastSeen?.address === addressOf(dash) ? asLastSeen.listed : undefined

  /*
   * What to show while the live read finds out what is there now, asked for at
   * the same moment as the read rather than after it: the whole value of it is
   * arriving first, and a storage read is a few milliseconds against most of a
   * second for a search.
   */
  const remembered = () =>
    (held !== undefined
      ? Effect.succeed(Option.some(held))
      : rememberedIssueList(asked, dash.page).pipe(
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
   * Another tab, asked for the way the address asks for it.
   *
   * The whole address is replaced rather than edited, because the tab is the
   * path and the search belonged to the tab being left: a filter typed against
   * Assigned is not a filter anybody asked for against Mentioned.
   */
  const goToTab = (involvement: Involvement): void => {
    press(pathOf(involvement))
  }

  /**
   * Another page of the same tab, asked for the way the address asks for it.
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
    place: ISSUES,
    draw: (standing) => (
      <IssuesScreen
        at={at}
        involvement={dash.involvement}
        load={read}
        recallRepositories={recallRepositories}
        preload={remembered}
        onGo={goToTab}
        onPage={goToPage}
        where={openedNamed("issues", dash)}
        seed={seeding(dash)}
        onStepAside={standing.stepAside}
      />
    )
  }).close
}

/**
 * Puts this screen in charge of the document, once.
 *
 * Called by the shell, which is the one script GitHub cannot navigate away from
 * — see `src/entrypoints/shell.content.ts`.
 */
export const start = (): void => {
  // Before anything else, because the rules that hide GitHub's list are written
  // per page and hang on this. Synchronous and first: an attribute set a frame
  // late is a frame of their list on the screen.
  markPage(document, ISSUES)


  const store = settings()

  let close = (): void => {}
  let view: View = "ours"

  /**
   * The address the screen on the page was stood up for, or nothing where none of
   * ours is standing. Read by {@link goWithin}, which asks it before and after a
   * press to tell a redraw from a screen that never came.
   */
  let standingFor: string | undefined

  /** Another view of this screen: another tab, another page. */
  const press = (path: string): void =>
    goWithin(
      window,
      path,
      () => show(window.location.href),
      () => standingFor
    )

  const show = (url: string): void => {
    /*
     * One address asked for twice, which is one screen. A press within this
     * screen redraws for the new address itself, and where that press changed the
     * path the watcher below hears it as well and asks for the same thing again.
     */
    if (standingFor === url) return

    close()
    close = () => {}
    standingFor = undefined

    const dash = issueDashboardIn(url)

    /*
     * Somewhere else — a view of theirs this extension has no question for, or
     * another page entirely. The stylesheet is gating this page too, because a
     * stylesheet cannot read a URL, so handing it back is the first thing this
     * does.
     */
    if (Option.isNone(dash)) {
      handBack(document)
      return
    }

    // Their list, because that is what was asked for last time.
    if (view === "github") {
      reveal(document)
      ungate(document)
      return
    }

    close = open(dash.value, press, new URL(url).pathname)
    standingFor = url
  }

  // The whole address, not the path: which page of which tab this is lives in
  // the query, and a reader pressing Next changes nothing else.
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

        if (Option.isSome(issueDashboardIn(here))) show(here)
        else if (promise !== null) {
          const wanted = new URL(promise, window.location.origin).toString()
          if (Option.isSome(issueDashboardIn(wanted))) show(wanted)
          else reveal(document)
        } else reveal(document)
      })
    )
  )
}
