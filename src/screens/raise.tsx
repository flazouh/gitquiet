import { Effect, Option } from "effect"
import { rememberedRepositories } from "@/app/destinations"
import { forgetIntent, intendedPath } from "@/app/intent"
import { raiseIssue } from "@/app/raising"
import { chosenView } from "@/app/settings"
import type { RepoRef } from "@/domain/PullRequestRef"
import { type Raised, type Raising, raisingIn, seeding } from "@/domain/raising"
import type { View } from "@/domain/Settings"
import { reportError } from "@/observability/report"
import { standAScreen } from "@/shell/screen"
import { settings, throughGitHub } from "@/shell/supplied"
import { goTo } from "@/ui/going"
import { handBack, markPage, reveal, ungate } from "@/ui/mount"
import { whenLocationChanges } from "@/ui/navigation"
import { RAISE } from "@/ui/place"
import { RaiseScreen } from "@/ui/RaiseScreen"
import "@/ui/styles.css"

/**
 * Every repository the reader has, as the store already knows them, for the
 * palette in the bar. Cache only, for the reason every other screen reads it
 * that way.
 */
const recallRepositories = () => rememberedRepositories().pipe(throughGitHub)

/**
 * Puts the form on the page, and hands back the way to take it off again.
 *
 * Shorter than every other screen's, and the whole of the difference is that
 * this one reads nothing. There is no live read to start before the takeover, no
 * remembered copy to draw first and no fiber to join on a second ask, because
 * everything this screen shows is two empty boxes and what the address seeded
 * them with.
 */
const open = (reference: RepoRef, seed: Raising): (() => void) => {
  /**
   * Where the issue GitHub just made is, which is where the reader goes next.
   *
   * Pushed rather than loaded. The issue that now exists has a page of its own
   * with its own screen, and that screen reads GitHub's API rather than this
   * document — so nothing about it needs a load. The shell hears the address
   * move and opens it, and `goTo` keeps the honest fallback: a screen that
   * never arrives becomes the load this used to always be.
   */
  const goToIssue = (raised: Raised): void => {
    goTo(window, `/${raised.owner}/${raised.repo}/issues/${raised.number}`)
  }

  return standAScreen({
    place: RAISE,
    draw: (standing) => (
      <RaiseScreen
        repo={reference}
        seed={seed}
        onRaise={(draft) =>
          raiseIssue(reference, draft).pipe(
            throughGitHub,
            // Reported and still failed, so the log has the refusal and the form
            // can say it over the boxes the words are still in.
            Effect.tapError((error) => Effect.sync(() => reportError(error)))
          )
        }
        onRaised={goToIssue}
        onStepAside={standing.stepAside}
        recallRepositories={recallRepositories}
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
  // Before anything else, because the rules that hide GitHub's own form are
  // written per page and hang on this. An attribute set a frame late is a frame
  // of their form on the screen.
  markPage(document, RAISE)


  const store = settings()

  let close = (): void => {}
  let view: View = "ours"

  const show = (href: string): void => {
    close()
    close = () => {}

    const reference = raisingIn(href)

    /*
     * Somewhere else in the repository. The stylesheet is gating this page too,
     * because a stylesheet cannot read a URL, so handing it back is the first
     * thing this does.
     */
    if (Option.isNone(reference)) {
      handBack(document)
      return
    }

    // Their form, because that is what was asked for last time.
    if (view === "github") {
      reveal(document)
      ungate(document)
      return
    }

    close = open(reference.value, seeding(href))
  }

  /*
   * The whole address, not the path: a "report this" link arrives with the title
   * and the body in the query, and they are what the boxes open with.
   */
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

        if (Option.isSome(raisingIn(here))) show(here)
        else if (promise !== null) {
          const asked = new URL(promise, window.location.origin).toString()
          if (Option.isSome(raisingIn(asked))) show(asked)
          else reveal(document)
        } else reveal(document)
      })
    )
  )
}
