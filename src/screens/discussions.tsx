import { Effect, Fiber, Option } from "effect"
import { rememberedRepositories } from "@/app/destinations"
import { loadDiscussions, rememberedDiscussions } from "@/app/discussions"
import { forgetIntent, intendedPath } from "@/app/intent"
import { chosenView } from "@/app/settings"
import { discussionListIn, listRouteOf, type DiscussionList } from "@/domain/discussions"
import type { View } from "@/domain/Settings"
import { reportError } from "@/observability/report"
import { standAScreen } from "@/shell/screen"
import { settings, throughGitHub } from "@/shell/supplied"
import { DiscussionsScreen, type Shown } from "@/ui/DiscussionsScreen"
import { openedNamed } from "@/ui/lastDrawn"
import { handBack, markPage, reveal, ungate } from "@/ui/mount"
import { whenLocationChanges } from "@/ui/navigation"
import { DISCUSSIONS } from "@/ui/place"
import "@/ui/styles.css"

/**
 * Every repository the reader has, as the store already knows them, for the palette in the bar.
 * Cache only, for the reason a repository's pull request list reads it that way.
 */
const recallRepositories = () => rememberedRepositories().pipe(throughGitHub)

/**
 * Puts one repository's discussions on the page, and hands back the way to take them off again.
 *
 * One read and no stage, unlike the releases screen: their discussions list is still rendered by
 * Rails end to end, so the rows, the categories and the paging are in the one document and there
 * is nothing for a second request to add.
 */
const open = (
  list: DiscussionList,
  /** The exact pathname this screen is stood up for. See `DrawnAt` in `drawnAt.tsx`. */
  at: string
): (() => void) => {
  const reading = () =>
    loadDiscussions(list).pipe(
      throughGitHub,
      Effect.tapError((error) => Effect.sync(() => reportError(error)))
    )

  // Started before anything is waited on. Reading the list and waiting for GitHub to render a
  // region to stand in have nothing to say to each other.
  const first = Effect.runFork(reading())

  // The first ask joins what is already in flight; every ask after it is somebody saying the list
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
   * after it: arriving first is the whole of its value. Keyed by the whole route, so a category
   * is never painted with the rows of the list above it.
   */
  const remembered = () =>
    rememberedDiscussions(list).pipe(
      throughGitHub,
      Effect.map(Option.map((found): Shown => found)),
      // Nothing kept, or a store that would not answer. Neither is worth reporting: the live read
      // is on its way and is the answer either way.
      Effect.catch(() => Effect.succeed(Option.none<Shown>()))
    )

  return standAScreen({
    place: DISCUSSIONS,
    draw: (standing) => (
      <DiscussionsScreen
        at={at}
        list={list}
        where={openedNamed("discussions", list.home)}
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
  markPage(document, DISCUSSIONS)

  const store = settings()

  let close = (): void => {}
  let on: string | undefined
  let view: View = "ours"

  const show = (url: string): void => {
    const list = discussionListIn(url)

    /*
     * Somewhere else in the repository: one discussion, the form for raising one, the Code tab.
     * The stylesheet is gating this page too, because a stylesheet cannot read a URL, so handing
     * it back is the first thing this does.
     */
    if (Option.isNone(list)) {
      close()
      close = () => {}
      on = undefined
      handBack(document)
      return
    }

    // The whole address, which is what tells one visit from another: a reader pressing Help
    // from All is on a different page, and so is a reader on page three.
    const named = listRouteOf(list.value)
    if (on === named) return

    close()
    close = () => {}
    on = undefined

    // Their list, because that is what was asked for last time.
    if (view === "github") {
      reveal(document)
      ungate(document)
      return
    }

    close = open(list.value, new URL(url, window.location.origin).pathname)
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

        if (Option.isSome(discussionListIn(here))) show(here)
        else if (promise !== null) {
          const asked = new URL(promise, window.location.origin).toString()
          if (Option.isSome(discussionListIn(asked))) show(asked)
          else reveal(document)
        } else reveal(document)
      })
    )
  )
}
