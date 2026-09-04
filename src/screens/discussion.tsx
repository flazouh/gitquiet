import { Effect, Fiber, Option } from "effect"
import { rememberedRepositories } from "@/app/destinations"
import { loadDiscussion, rememberedDiscussion } from "@/app/discussion"
import { discussionDoings } from "@/app/discussionDoings"
import { pressDiscussion } from "@/app/discussionPress"
import { forgetIntent, intendedPath } from "@/app/intent"
import { chosenView } from "@/app/settings"
import { type DiscussionPress } from "@/domain/discussions"
import { addressOf, discussionIn, type DiscussionRef } from "@/domain/discussionRoutes"
import type { View } from "@/domain/Settings"
import { reportError } from "@/observability/report"
import { standAScreen } from "@/shell/screen"
import { settings, throughGitHub } from "@/shell/supplied"
import { DiscussionScreen } from "@/ui/DiscussionScreen"
import { openedNamed } from "@/ui/lastDrawn"
import { handBack, markPage, reveal, ungate } from "@/ui/mount"
import { whenLocationChanges } from "@/ui/navigation"
import { DISCUSSION } from "@/ui/place"
import "@/ui/styles.css"

/**
 * Every repository the reader has, as the store already knows them, for the palette in the bar.
 * Cache only, for the reason a repository's pull request list reads it that way.
 */
const recallRepositories = () => rememberedRepositories().pipe(throughGitHub)

/**
 * Puts one discussion on the page, and hands back the way to take it off again.
 *
 * One read and no stage, as the list beside it is. Their page is Rails end to end, so the body,
 * every comment and every reply are in the one document.
 */
const open = (
  reference: DiscussionRef,
  /** The exact pathname this screen is stood up for. See `DrawnAt` in `drawnAt.tsx`. */
  at: string
): (() => void) => {
  const reading = () =>
    loadDiscussion(reference).pipe(
      throughGitHub,
      Effect.tapError((error) => Effect.sync(() => reportError(error)))
    )

  // Started before anything is waited on. Reading the discussion and waiting for GitHub to render
  // a region to stand in have nothing to say to each other.
  const first = Effect.runFork(reading())

  // The first ask joins what is already in flight; every ask after it is somebody saying the page
  // has changed, and joining that same finished fiber would answer with what it had.
  let started = false
  const read = () => {
    if (!started) {
      started = true
      return Fiber.join(first)
    }
    return reading()
  }

  /*
   * What to show while the live read finds out what is there now, asked for beside it rather than
   * after it: arriving first is the whole of its value.
   */
  const remembered = () =>
    rememberedDiscussion(reference).pipe(
      throughGitHub,
      // Nothing kept, or a store that would not answer. Neither is worth reporting: the live read
      // is on its way and is the answer either way.
      Effect.catch(() => Effect.succeed(Option.none()))
    )

  /*
   * A press, sent as GitHub's own form and answered with the discussion again. Reported when it
   * fails, because every one of these is offered only where their form was on the page: a refusal
   * means something moved underneath the reader.
   */
  const press = (asked: DiscussionPress) =>
    pressDiscussion(reference, asked).pipe(
      throughGitHub,
      Effect.tapError((error) => Effect.sync(() => reportError(error)))
    )

  /*
   * Their own menu, read from the route their markup names. Refused quietly rather than reported:
   * a reader who may do nothing to a comment gets an empty menu from GitHub too, and that is not
   * a fault worth a card.
   */
  const ask = (on: "Discussion" | "DiscussionComment", id: string) =>
    discussionDoings(reference, on, id).pipe(throughGitHub)

  return standAScreen({
    place: DISCUSSION,
    draw: (standing) => (
      <DiscussionScreen
        at={at}
        reference={reference}
        where={openedNamed("discussion", reference.home)}
        load={read}
        preload={remembered}
        onPress={press}
        onAsk={ask}
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
  // Before anything else, because the rules that hide GitHub's page are written per page and hang
  // on this. Synchronous and first: an attribute set a frame late is a frame of their page on the
  // screen.
  markPage(document, DISCUSSION)

  const store = settings()

  let close = (): void => {}
  let on: string | undefined
  let view: View = "ours"

  const show = (url: string): void => {
    const reference = discussionIn(url)

    /*
     * Somewhere else in the repository: the list, the form for raising one, the Code tab. The
     * stylesheet is gating this page too, because a stylesheet cannot read a URL, so handing it
     * back is the first thing this does.
     */
    if (Option.isNone(reference)) {
      close()
      close = () => {}
      on = undefined
      handBack(document)
      return
    }

    // The discussion's own address, which is the whole of what tells one visit from another:
    // their page carries no state in its query that this screen reads.
    const named = addressOf(reference.value)
    if (on === named) return

    close()
    close = () => {}
    on = undefined

    // Their page, because that is what was asked for last time.
    if (view === "github") {
      reveal(document)
      ungate(document)
      return
    }

    close = open(reference.value, new URL(url, window.location.origin).pathname)
    on = named
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

        if (Option.isSome(discussionIn(here))) show(here)
        else if (promise !== null) {
          const asked = new URL(promise, window.location.origin).toString()
          if (Option.isSome(discussionIn(asked))) show(asked)
          else reveal(document)
        } else reveal(document)
      })
    )
  )
}
