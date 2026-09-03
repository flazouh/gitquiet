import { Effect, Fiber, Option } from "effect"
import { rememberedRepositories } from "@/app/destinations"
import { forgetIntent, intendedPath } from "@/app/intent"
import { chosenView } from "@/app/settings"
import { loadStrands, rememberedStrands } from "@/app/strands"
import type { RepoRef } from "@/domain/PullRequestRef"
import type { View } from "@/domain/Settings"
import { actionsIn, type Strand } from "@/domain/strand"
import { reportError } from "@/observability/report"
import { standAScreen } from "@/shell/screen"
import { settings, throughGitHub } from "@/shell/supplied"
import { handBack, markPage, reveal, ungate } from "@/ui/mount"
import { whenLocationChanges } from "@/ui/navigation"
import { ACTIONS } from "@/ui/place"
import { StrandsScreen } from "@/ui/StrandsScreen"
import { openedNamed } from "@/ui/lastDrawn"
import "@/ui/styles.css"

/**
 * Every repository the reader has, as the store already knows them, for the palette in the
 * bar. Cache only, for the reason a repository's pull request list reads it that way.
 */
const recallRepositories = () => rememberedRepositories().pipe(throughGitHub)

/**
 * Puts one repository's runs on the page, and hands back the way to take them off again.
 *
 * Everything about standing on a GitHub page — the gate, the container, the surface to
 * borrow, the wait for the address, the failsafe — belongs to `standAScreen`. What is left
 * here is what this screen alone knows: what it reads and what it draws.
 */
const open = (
  repo: RepoRef,
  /** The exact pathname this screen is stood up for. See `DrawnAt` in `drawnAt.tsx`. */
  at: string
): (() => void) => {
  const reading = () =>
    loadStrands(repo).pipe(
      throughGitHub,
      Effect.tapError((error) => Effect.sync(() => reportError(error)))
    )

  // Started before anything is waited on. Reading the list and waiting for GitHub to render a
  // region to stand in have nothing to say to each other.
  const first = Effect.runFork(reading())

  // The first ask joins what is already in flight; every ask after it is somebody saying the
  // list has changed, and joining that same finished fiber would answer with what it had.
  let started = false
  const read = () => {
    if (!started) {
      started = true
      return Fiber.join(first)
    }
    return reading()
  }

  /*
   * What to show while the live read finds out what is there now, asked for beside it
   * rather than after it: arriving first is the whole of its value.
   */
  const remembered = () =>
    rememberedStrands(repo).pipe(
      throughGitHub,
      // Nothing kept, or a store that would not answer. Neither is worth reporting: the
      // live read is on its way and is the answer either way.
      Effect.catch(() => Effect.succeed(Option.none<ReadonlyArray<Strand>>()))
    )

  return standAScreen({
    place: ACTIONS,
    draw: (standing) => (
      <StrandsScreen
        at={at}
        repo={repo}
        where={openedNamed("actions", repo)}
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
  // Before anything else, because the rules that hide GitHub's list are written per page and
  // hang on this. Synchronous and first: an attribute set a frame late is a frame of their
  // list on the screen.
  markPage(document, ACTIONS)


  const store = settings()

  let close = (): void => {}
  let on: string | undefined
  let view: View = "ours"

  const show = (url: string): void => {
    const repo = actionsIn(url)

    /*
     * Somewhere else in the repository: the Code tab, one run, a pull request. The stylesheet
     * is gating this page too, because a stylesheet cannot read a URL, so handing it back is
     * the first thing this does.
     */
    if (Option.isNone(repo)) {
      close()
      close = () => {}
      on = undefined
      handBack(document)
      return
    }

    const address = `${repo.value.owner}/${repo.value.repo}`
    // The same list, arrived at again: their own filters live in the query and this screen
    // reads none of them, so rebuilding for one would be a read of the same page.
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

    close = open(repo.value, new URL(url, window.location.origin).pathname)
    on = address
  }

  whenLocationChanges(window, () => show(window.location.href))

  Effect.runFork(
    chosenView(store).pipe(
      Effect.map((chosen) => {
        view = chosen

        /*
         * What the address says, or, while GitHub is still fetching and the address still
         * names the page being left, what the reader pressed.
         */
        const here = window.location.href
        const promise = intendedPath(window)
        forgetIntent(window)

        if (Option.isSome(actionsIn(here))) show(here)
        else if (promise !== null) {
          const asked = new URL(promise, window.location.origin).toString()
          if (Option.isSome(actionsIn(asked))) show(asked)
          else reveal(document)
        } else reveal(document)
      })
    )
  )
}
