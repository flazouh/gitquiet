import { Effect, Fiber, Option } from "effect"
import { rememberedRepositories } from "@/app/destinations"
import { forgetIntent, intendedPath } from "@/app/intent"
import { loadBuilds, loadReleases, rememberedReleases } from "@/app/releases"
import { chosenView } from "@/app/settings"
import type { RepoRef } from "@/domain/PullRequestRef"
import { downloadable } from "@/domain/release"
import type { View } from "@/domain/Settings"
import { releasesIn } from "@/domain/release"
import { initialiseErrorReporting, reportError } from "@/observability/sentry"
import { standAScreen } from "@/shell/screen"
import { settings, throughGitHub } from "@/shell/supplied"
import { handBack, markPage, reveal, ungate } from "@/ui/mount"
import { whenLocationChanges } from "@/ui/navigation"
import { RELEASES } from "@/ui/place"
import { ReleasesScreen, type Shown } from "@/ui/ReleasesScreen"
import { thisMachine } from "@/ui/thisMachine"
import { openedNamed } from "@/ui/lastDrawn"
import "@/ui/styles.css"

/**
 * Every repository the reader has, as the store already knows them, for the palette in the bar.
 * Cache only, for the reason a repository's pull request list reads it that way.
 */
const recallRepositories = () => rememberedRepositories().pipe(throughGitHub)

/** Nothing known about the reader's machine, which is what the first stage draws with. */
const UNKNOWN = { machine: null, chip: null } as const

/**
 * Puts one repository's releases on the page, and hands back the way to take them off again.
 *
 * Staged on purpose, and the stage is the whole shape of this screen: the list is one request and
 * is the page, while the files of the newest Version are a second request their own page defers
 * behind an `include-fragment` and cannot be asked for until the list has named a tag. So the
 * Changes are drawn as soon as they land and the download row appears over the top of them a
 * moment later, rather than the reader waiting on a fragment to read a release note.
 */
const open = (repo: RepoRef): (() => void) => {
  const reading = (partly: (shown: Shown) => void) =>
    loadReleases(repo).pipe(
      throughGitHub,
      Effect.tap((versions) =>
        Effect.sync(() => partly({ versions, attached: Option.none(), machine: UNKNOWN }))
      ),
      Effect.flatMap((versions) => {
        const offered = downloadable(versions)
        if (Option.isNone(offered)) {
          return Effect.succeed<Shown>({ versions, attached: Option.none(), machine: UNKNOWN })
        }

        /*
         * The fragment and the reader's own machine together, since neither waits on the other.
         * The fragment is allowed to fail without taking the page down: a Version with no files
         * is a real answer, and so is a fragment GitHub declined to serve. The list is on the
         * screen either way and it is the part somebody came to read.
         */
        return Effect.all(
          [
            loadBuilds(repo, offered.value.tag).pipe(
              throughGitHub,
              Effect.map(Option.some),
              Effect.tapError((error) => Effect.sync(() => reportError(error))),
              Effect.catch(() => Effect.succeed(Option.none()))
            ),
            thisMachine()
          ],
          { concurrency: "unbounded" }
        ).pipe(Effect.map(([attached, machine]): Shown => ({ versions, attached, machine })))
      }),
      Effect.tapError((error) => Effect.sync(() => reportError(error)))
    )

  // Started before anything is waited on. Reading the list and waiting for GitHub to render a
  // region to stand in have nothing to say to each other.
  let report: (shown: Shown) => void = () => {}
  const first = Effect.runFork(reading((shown) => report(shown)))

  // The first ask joins what is already in flight; every ask after it is somebody saying the list
  // has changed, and joining that same finished fiber would answer with what it had.
  let started = false
  const read = (partly: (shown: Shown) => void) => {
    if (!started) {
      started = true
      report = partly
      return Fiber.join(first)
    }
    return reading(partly)
  }

  /*
   * What to show while the live read finds out what is there now, asked for beside it rather than
   * after it: arriving first is the whole of its value. The files are not kept, because a
   * remembered filename is a link to a file that may no longer be the newest one.
   */
  const remembered = () =>
    rememberedReleases(repo).pipe(
      throughGitHub,
      Effect.map(
        Option.map((versions): Shown => ({ versions, attached: Option.none(), machine: UNKNOWN }))
      ),
      // Nothing kept, or a store that would not answer. Neither is worth reporting: the live read
      // is on its way and is the answer either way.
      Effect.catch(() => Effect.succeed(Option.none<Shown>()))
    )

  return standAScreen({
    place: RELEASES,
    draw: (standing) => (
      <ReleasesScreen
        repo={repo}
        where={openedNamed("releases", repo)}
        load={read}
        preload={remembered}
        recallRepositories={recallRepositories}
        onStepAside={standing.stepAside}
      />
    )
  }).close
}

/**
 * Puts this screen in charge of the document, once.
 *
 * Called by the shell, which is the one script GitHub cannot navigate away from: see
 * `src/entrypoints/shell.content.ts`.
 */
export const start = (): void => {
  // Before anything else, because the rules that hide GitHub's list are written per page and hang
  // on this. Synchronous and first: an attribute set a frame late is a frame of their list on the
  // screen.
  markPage(document, RELEASES)

  initialiseErrorReporting("releases")

  const store = settings()

  let close = (): void => {}
  let on: string | undefined
  let view: View = "ours"

  const show = (url: string): void => {
    const repo = releasesIn(url)

    /*
     * Somewhere else in the repository: one Version, their tags, the Code tab. The stylesheet is
     * gating this page too, because a stylesheet cannot read a URL, so handing it back is the
     * first thing this does.
     */
    if (Option.isNone(repo)) {
      close()
      close = () => {}
      on = undefined
      handBack(document)
      return
    }

    const address = `${repo.value.owner}/${repo.value.repo}`
    // The same list, arrived at again: their own search lives in the query and this screen reads
    // none of it, so rebuilding for one would be a read of the same page.
    if (on === address) return

    close()
    close = () => {}
    on = undefined

    // Their list, because that is what was asked for last time.
    if (view === "github") {
      reveal(document)
      ungate(document)
      return
    }

    close = open(repo.value)
    on = address
  }

  whenLocationChanges(window, () => show(window.location.href))

  Effect.runFork(
    chosenView(store).pipe(
      Effect.map((chosen) => {
        view = chosen

        /*
         * What the address says, or, while GitHub is still fetching and the address still names
         * the page being left, what the reader pressed.
         */
        const here = window.location.href
        const promise = intendedPath(window)
        forgetIntent(window)

        if (Option.isSome(releasesIn(here))) show(here)
        else if (promise !== null) {
          const asked = new URL(promise, window.location.origin).toString()
          if (Option.isSome(releasesIn(asked))) show(asked)
          else reveal(document)
        } else reveal(document)
      })
    )
  )
}
