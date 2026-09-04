import { Effect, Fiber, Option } from "effect"
import { forgetIntent, intendedPath } from "@/app/intent"
import { cancelRun, loadRun, rememberedRun, rerunRun } from "@/app/run"
import { chosenView, rememberView } from "@/app/settings"
import { runAddressIn, type Pressing, type RunOpening, type RunRef } from "@/domain/run"
import type { View } from "@/domain/Settings"
import { reportError } from "@/observability/report"
import type { GitHubGateway } from "@/ports/GitHubGateway"
import { standAScreen } from "@/shell/screen"
import { settings, throughGitHub } from "@/shell/supplied"
import { handBack, markPage, reveal, ungate } from "@/ui/mount"
import { whenLocationChanges } from "@/ui/navigation"
import { RUN } from "@/ui/place"
import { RunScreen } from "@/ui/RunScreen"
import { offerOurPage } from "@/ui/theirTabs"
import { openedNamed } from "@/ui/lastDrawn"
import "@/ui/styles.css"

/**
 * Puts the interface on the page for one run, and hands back the way to take it off.
 *
 * The closing half is not tidiness. GitHub navigates between runs without loading a page,
 * so the interface for the run being left is still standing when the next arrives.
 */
const open = (
  reference: RunRef,
  /** The exact pathname this screen is stood up for. See `DrawnAt` in `drawnAt.tsx`. */
  at: string,
  onUseGitHub?: () => void
): (() => void) => {
  const reading = <A, E>(work: Effect.Effect<A, E, GitHubGateway>) =>
    work.pipe(
      throughGitHub,
      Effect.tapError((error) => Effect.sync(() => reportError(error)))
    )

  /*
   * Started before anything is waited on, as every other screen starts its read: the read
   * and the takeover have nothing to say to each other, and running them one after the
   * other spends the whole of GitHub's page load doing nothing.
   *
   * Nothing is remembered for a run, and nothing should be. A finished run never changes,
   * but the address of one is opened once and rarely again, so a store that held them
   * would spend the reader's quota on pages nobody returns to. A running run would be
   * wrong to keep at all.
   */
  const live = Effect.runFork(reading(loadRun(reference)))

  let started = false
  const read = () =>
    Effect.suspend(() => {
      if (!started) {
        started = true
        return Fiber.join(live)
      }

      return Fiber.join(Effect.runFork(reading(loadRun(reference))))
    })

  /*
   * What to show while the live read is in the air, started in the same breath: one
   * storage read against one fetch of a page half a megabyte wide.
   */
  const remembered = () =>
    rememberedRun(reference).pipe(
      throughGitHub,
      Effect.catch(() => Effect.succeed(Option.none<RunOpening>()))
    )

  /*
   * The three presses, each one their own form on the run page posted back. Reported
   * through the same wrapper the reads use, so a refused press reaches the screen as
   * the sentence GitHub gave it and lands in the error report either way.
   */
  const press = (what: Pressing) =>
    reading(
      what === "cancel"
        ? cancelRun(reference)
        : rerunRun(reference, what === "rerunFailed" ? "failed" : "all")
    )

  return standAScreen({
    place: RUN,
    draw: (standing) => (
      <RunScreen
        at={at}
        reference={reference}
        load={read}
        preload={remembered}
        onStepAside={standing.stepAside}
        onUseGitHub={onUseGitHub}
        press={press}
        where={openedNamed("run", reference)}
      />
    )
  }).close
}

/**
 * Puts the run in charge of the document, once.
 *
 * Called by the shell, which is on every GitHub page and knows from the address that a run
 * is what is wanted. Between runs this follows the address itself, which is why it is
 * started once and not per run.
 */
export const start = (): void => {
  markPage(document, RUN)


  const store = settings()

  let close = (): void => {}
  let unoffer = (): void => {}
  let view: View = "ours"

  // Declared rather than assigned, because the three call each other in a ring.

  function handOver(): void {
    close()
    close = () => {}
    reveal(document)
    ungate(document)
    unoffer()
    unoffer = offerOurPage(document, takeBack)
  }

  function takeBack(): void {
    view = "ours"
    void rememberView(store, "ours")
    show(window.location.href)
  }

  function useGitHub(): void {
    view = "github"
    void rememberView(store, "github")
    handOver()
  }

  function show(url: string): void {
    close()
    close = () => {}
    unoffer()
    unoffer = () => {}

    const reference = runAddressIn(url)
    if (Option.isNone(reference)) {
      handBack(document)
      return
    }

    if (view === "github") {
      handOver()
      return
    }

    close = open(reference.value, new URL(url, window.location.origin).pathname, useGitHub)
  }

  whenLocationChanges(window, () => show(window.location.href))

  // Nothing is drawn until the choice is known, so a reader who wants GitHub's page is
  // not charged a request for an interface they turned off.
  Effect.runFork(
    chosenView(store).pipe(
      Effect.map((chosen) => {
        view = chosen

        const here = window.location.href
        const promise = intendedPath(window)
        forgetIntent(window)

        if (Option.isSome(runAddressIn(here))) show(here)
        else if (promise !== null) {
          const asked = new URL(promise, window.location.origin).toString()
          if (Option.isSome(runAddressIn(asked))) show(asked)
          else reveal(document)
        } else reveal(document)
      })
    )
  )
}
