import { Effect, Option } from "effect"
import { rememberedRepositories } from "@/app/destinations"
import { loadBlame } from "@/app/blame"
import { forgetIntent, intendedPath } from "@/app/intent"
import { chosenView } from "@/app/settings"
import { blameIn, type BlameAt } from "@/domain/blame"
import type { View } from "@/domain/Settings"
import { initialiseErrorReporting, reportError } from "@/observability/sentry"
import { standAScreen } from "@/shell/screen"
import { settings, throughGitHub } from "@/shell/supplied"
import { BlameScreen } from "@/ui/BlameScreen"
import { openedNamed } from "@/ui/lastDrawn"
import { handBack, markPage, reveal, ungate } from "@/ui/mount"
import { whenLocationChanges } from "@/ui/navigation"
import { BLAME } from "@/ui/place"
import "@/ui/styles.css"

/**
 * Every repository the reader has, as the store already knows them, for the palette in the bar.
 * Cache only, for the reason a repository's pull request list reads it that way.
 */
const recallRepositories = () => rememberedRepositories().pipe(throughGitHub)

/** The three parts of a blame address, as one string, for telling one visit from the next. */
const key = (at: BlameAt): string => `${at.repo.owner}/${at.repo.repo}/${at.branch}/${at.path}`

/**
 * Puts one file's blame on the page, and hands back the way to take it off again.
 */
const open = (at: BlameAt, path: string): (() => void) => {
  const read = () =>
    loadBlame(at.repo, at.branch, at.path).pipe(
      throughGitHub,
      Effect.tapError((error) => Effect.sync(() => reportError(error)))
    )

  return standAScreen({
    place: BLAME,
    draw: (standing) => (
      <BlameScreen
        repo={at.repo}
        branch={at.branch}
        path={at.path}
        at={path}
        where={openedNamed("blame", at)}
        load={read}
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
  // Before anything else, because the rules that hide GitHub's blame are written per
  // page and hang on this.
  markPage(document, BLAME)

  initialiseErrorReporting("blame")

  const store = settings()

  let close = (): void => {}
  let on: string | undefined
  let view: View = "ours"

  const show = (url: string): void => {
    const at = blameIn(url)

    /*
     * Somewhere else in the repository: the tree, a blob, the Code tab. The stylesheet is
     * gating this page too, because a stylesheet cannot read a URL, so handing it back is the
     * first thing this does.
     */
    if (Option.isNone(at)) {
      close()
      close = () => {}
      on = undefined
      handBack(document)
      return
    }

    const address = key(at.value)
    // The same file's blame, arrived at again — a re-render Turbo fired for a reason
    // that changed nothing this screen reads.
    if (on === address) return

    close()
    close = () => {}
    on = undefined

    // Their page, because that is what was asked for last time.
    if (view === "github") {
      reveal(document)
      ungate(document)
      return
    }

    close = open(at.value, new URL(url, window.location.origin).pathname)
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

        if (Option.isSome(blameIn(here))) show(here)
        else if (promise !== null) {
          const asked = new URL(promise, window.location.origin).toString()
          if (Option.isSome(blameIn(asked))) show(asked)
          else reveal(document)
        } else reveal(document)
      })
    )
  )
}
