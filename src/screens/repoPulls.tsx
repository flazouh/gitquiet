import { Effect, Fiber, Option } from "effect"
import { rememberedRepositories } from "@/app/destinations"
import { forgetIntent, intendedPath } from "@/app/intent"
import { type Listed, loadRepoList, rememberedRepoList } from "@/app/repoList"
import type { PullRequestRef } from "@/domain/PullRequestRef"
import { type RepoList, repoListIn, seeding } from "@/domain/repoList"
import { initialiseErrorReporting, reportError } from "@/observability/sentry"
import type { View } from "@/domain/Settings"
import { chosenView } from "@/app/settings"
import { handBack, markPage, reveal, ungate } from "@/ui/mount"
import { whenLocationChanges } from "@/ui/navigation"
import { REPO_PULLS } from "@/ui/place"
import { standAScreen } from "@/shell/screen"
import { settings, throughGitHub } from "@/shell/supplied"
import { RepoPullsScreen } from "@/ui/RepoPullsScreen"
import "@/ui/styles.css"

/**
 * Every repository the reader has, as the store already knows them.
 *
 * For the palette in the bar. Cache only: a page asking GitHub for the whole list on the chance
 * somebody presses ⌘K would be spending a request a reader never asked for.
 */
const recallRepositories = () => rememberedRepositories().pipe(throughGitHub)

/**
 * One page of one repository's list, told apart from every other.
 *
 * The search and the page are in it because they are what the address is a view
 * of: page four of "closed, authored by me" is not page one of the default
 * search, and coming back to the one must not draw the other.
 */
const addressOf = (list: RepoList): string =>
  `${list.repo.owner}/${list.repo.repo}?${list.query}#${list.page}`

/**
 * The list as the reader last saw it, kept for as long as this document lives.
 *
 * Leaving a row for a pull request does not load a page, so this script is still
 * holding the whole of what was on the screen when the reader comes back to it —
 * stacks, sizes, check counts and all.
 *
 * That is worth more than the store can offer. Only GitHub's payloads for the
 * search and the six shelves are kept between visits, so a remembered list has
 * rows and nothing else: the stacks are read one merge box at a time and the
 * sizes come from a route of their own, and neither is ever in there. Coming
 * back to a list that has lost its shape reads as a list that has been reloaded,
 * which is precisely what did not happen.
 *
 * One page held rather than every page visited: going back means the page just
 * left, and a document open for an afternoon should not accumulate every list
 * its reader has passed through.
 */
let asLastSeen: { readonly address: string; readonly listed: Listed } | undefined

/**
 * Puts one page of a repository's list on the page, and hands back the way to take
 * it off again.
 *
 * The closing half is not tidiness. GitHub navigates within a repository without
 * loading a page, so the list would otherwise still be standing over the Code tab,
 * and the attribute holding GitHub's own content out of sight would still be set.
 */
const open = (list: RepoList): (() => void) => {
  // Started before anything is waited on. Reading the list and waiting for GitHub to
  // render a region to stand in have nothing to say to each other.
  const reading = (partly: (listed: Listed) => void) =>
    loadRepoList(list, partly).pipe(
      throughGitHub,
      // Held as it lands, so that coming back to this page is this page rather
      // than a paler copy of it read out of the store.
      Effect.tap((listed) =>
        Effect.sync(() => {
          asLastSeen = { address: addressOf(list), listed }
        })
      ),
      Effect.tapError((error) => Effect.sync(() => reportError(error)))
    )

  /*
   * The stages of that first read, kept until there is a screen to give them to.
   *
   * The read is started before React has drawn anything, so the search can easily
   * answer first — and a stage announced to nobody is the whole point of the exercise
   * thrown away. The latest one is held here and replayed to the screen the moment it
   * asks, after which stages go straight through.
   */
  /** This very page, as this document last had it up. */
  const held = asLastSeen?.address === addressOf(list) ? asLastSeen.listed : undefined

  /*
   * What to show while the live read finds out what is there now, asked for at the
   * same moment as the read rather than after it: the whole value of it is
   * arriving first, and a storage read is a few milliseconds against most of a
   * second for a search.
   *
   * Whatever was last on the screen, where this document has had this very page up
   * before — instantly, from memory, and complete. Otherwise what the last visit
   * left in the store, which is rows without their stacks or their sizes.
   */
  const remembered = () =>
    held !== undefined
      ? Effect.succeed(Option.some(held))
      : rememberedRepoList(list).pipe(
          throughGitHub,
          // Nothing was remembered, or the store refused to say. Neither is worth
          // reporting: the live read is on its way and is the answer either way.
          Effect.catch(() => Effect.succeed(Option.none<Listed>()))
        )

  let sofar: Listed | undefined
  let tell: ((listed: Listed) => void) | undefined

  /*
   * Whether the stages of the read are worth showing, or only its answer.
   *
   * They are what makes a page arrived at cold appear in a round trip instead of
   * four. But a complete list is already on the screen when this page was up a
   * moment ago, and the first stage of a fresh read is rows with no Courts, no
   * stacks and no sizes: showing it would take the reader's list apart and put it
   * back together over the next three seconds. Same reason a re-read shows nothing
   * partial, and the same rule — never backwards.
   */
  const staged = held === undefined

  // Forked rather than described: the search is in the air from here, and its
  // better answers are kept for whoever mounts in time to want them.
  const first = Effect.runFork(
    reading((listed) => {
      if (!staged) return
      sofar = listed
      tell?.(listed)
    })
  )

  // The first ask joins what is already in flight; every ask after it is somebody
  // saying the list has changed, and joining that same finished fiber would answer
  // with the page they are trying to leave.
  let started = false
  const read = (partly: (listed: Listed) => void) => {
    if (!started) {
      started = true
      if (staged) {
        tell = partly
        if (sofar !== undefined) partly(sofar)
      }
      return Fiber.join(first)
    }
    return reading(partly)
  }

  /**
   * Enter, rather than a press.
   *
   * A press is a link and the browser handles it, which is what puts the prefetch
   * script's gating and injection in the path. The keyboard has no link to press, so
   * this asks for the same navigation by hand.
   */
  const goTo = (reference: PullRequestRef): void => {
    window.location.assign(`/${reference.owner}/${reference.repo}/pull/${reference.number}`)
  }

  /**
   * Another page of the same list, asked for the way the address asks for it.
   *
   * Written into the address rather than read straight off GitHub, because the address
   * is what this page is a view of: a reader who pages to the fourth page and sends
   * somebody the link has sent them the fourth page.
   */
  const goToPage = (page: number): void => {
    const address = new URL(window.location.href)
    if (page <= 1) address.searchParams.delete("page")
    else address.searchParams.set("page", String(page))
    window.location.assign(address.toString())
  }

  return standAScreen({
    place: REPO_PULLS,
    draw: (standing) => (
      <RepoPullsScreen
        repo={list.repo}
        load={read}
        recallRepositories={recallRepositories}
        preload={remembered}
        onOpen={goTo}
        onPage={goToPage}
        seed={seeding(list)}
        onStepAside={standing.stepAside}
      />
    )
  }).close
}

/**
 * Puts this screen in charge of the document, once.
 *
 * Called by the shell, which is the one script GitHub cannot navigate away from —
 * see `src/entrypoints/shell.content.ts`. It decides from the address that this is
 * the screen wanted and imports this file; a second press of the same page finds it
 * already imported and already following the address on its own, so there is
 * nothing here to guard against being started twice.
 *
 * This used to be a content script's `main`, which meant it only ran when a
 * document loaded on a repository's list — and GitHub loads no documents. Every
 * other way in went through the worker, and what the worker took to wake was
 * GitHub's own list on the screen: 587 milliseconds of it, measured, when it had
 * been asleep.
 */
export const start = (): void => {
  // Before anything else, because the rules that hide GitHub's list are written
  // per page and hang on this. Synchronous and first: an attribute set a frame
  // late is a frame of their list on the screen.
  markPage(document, REPO_PULLS)

  initialiseErrorReporting("repo-pulls")

  const store = settings()

  let close = (): void => {}
  let view: View = "ours"

  const show = (url: string): void => {
    close()
    close = () => {}

    const list = repoListIn(url)

    /*
     * Somewhere else in the repository — the Code tab, an issue, a pull request.
     * The stylesheet is gating this page too, because a stylesheet cannot read a
     * URL, so handing it back is the first thing this does.
     *
     * Handed back rather than revealed, and deliberately not ungated. This also
     * runs the instant a reader leaves for a pull request or an issue, while
     * GitHub is still on its way there: whatever screen is arriving has already
     * gated for it, and revealing over that gate shows GitHub's own page for as
     * long as the arriving screen takes to mount.
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

    close = open(list.value)
  }

  // The whole address, not the path: which page of which search this is lives in the
  // query, and a reader pressing Next changes nothing else.
  whenLocationChanges(window, () => show(window.location.href))

  Effect.runFork(
    chosenView(store).pipe(
      Effect.map((chosen) => {
        view = chosen

        /*
         * What the address says, or — while GitHub is still fetching and the
         * address still names the page being left — what the reader pressed.
         *
         * The intended path is a path where the address is a whole URL, so it
         * is read against this origin. A press carries no query, which is
         * right: pressing "Pull requests" asks for the first page of the
         * default search.
         */
        const here = window.location.href
        const promise = intendedPath(window)
        forgetIntent(window)

        if (Option.isSome(repoListIn(here))) show(here)
        else if (promise !== null) {
          const asked = new URL(promise, window.location.origin).toString()
          if (Option.isSome(repoListIn(asked))) show(asked)
          else reveal(document)
        } else reveal(document)
      })
    )
  )
}
