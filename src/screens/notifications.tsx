import { Effect, Fiber, Option } from "effect"
import { rememberedRepositories } from "@/app/destinations"
import { forgetIntent, intendedPath } from "@/app/intent"
import { loadNotices, pressNotice, rememberedNotices } from "@/app/notices"
import { chosenView } from "@/app/settings"
import type { Notice, Press } from "@/domain/notices"
import { noticesIn } from "@/domain/notices"
import type { View } from "@/domain/Settings"
import { initialiseErrorReporting, reportError } from "@/observability/sentry"
import { standAScreen } from "@/shell/screen"
import { settings, throughGitHub } from "@/shell/supplied"
import { handBack, markPage, reveal, ungate } from "@/ui/mount"
import { whenLocationChanges } from "@/ui/navigation"
import { NoticesScreen } from "@/ui/NoticesScreen"
import { NOTIFICATIONS } from "@/ui/place"
import { openedNamed } from "@/ui/lastDrawn"
import "@/ui/styles.css"

/**
 * Every repository the reader has, as the store already knows them, for the palette in the
 * bar. Cache only, for the reason every other screen reads it that way.
 */
const recallRepositories = () => rememberedRepositories().pipe(throughGitHub)

/**
 * Puts the reader's inbox on the page, and hands back the way to take it off again.
 *
 * Everything about standing on a GitHub page — the gate, the container, the surface to borrow,
 * the wait for the address, the failsafe — belongs to `standAScreen`. What is left here is what
 * this screen alone knows: what it reads, what it draws, and what a press on a row sends back.
 */
const open = (query: string): (() => void) => {
  const reading = () =>
    loadNotices(query).pipe(
      throughGitHub,
      Effect.tapError((error) => Effect.sync(() => reportError(error)))
    )

  // Started before anything is waited on. Reading the inbox and waiting for GitHub to render a
  // region to stand in have nothing to say to each other.
  const first = Effect.runFork(reading())

  // The first ask joins what is already in flight; every ask after it is somebody saying the
  // inbox has changed, and joining that same finished fiber would answer with what it had.
  let started = false
  const read = () => {
    if (!started) {
      started = true
      return Fiber.join(first)
    }
    return reading()
  }

  /*
   * What to show while the live read finds out what is there now, asked for beside it rather
   * than after it: arriving first is the whole of its value, and this is the page a reader
   * opens more often than any other.
   */
  const remembered = () =>
    rememberedNotices(query).pipe(
      throughGitHub,
      // Nothing kept, or a store that would not answer. Neither is worth reporting: the live
      // read is on its way and is the answer either way.
      Effect.catch(() => Effect.succeed(Option.none<ReadonlyArray<Notice>>()))
    )

  /*
   * One of their own forms, sent as their page sends it.
   *
   * Nothing comes back: their server answers with a zero-byte body, so the row is drawn the
   * way the reader asked for and a re-read is the only thing that could confirm it. The
   * refusal is handed back rather than swallowed, because the screen is what puts the row
   * right again — see `pressed` in `NoticesScreen`.
   */
  const press = (one: Press) =>
    pressNotice(one).pipe(
      throughGitHub,
      Effect.tapError((error) => Effect.sync(() => reportError(error)))
    )

  return standAScreen({
    place: NOTIFICATIONS,
    draw: (standing) => (
      <NoticesScreen
        load={read}
        preload={remembered}
        onPress={press}
        where={openedNamed("notices", query)}
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
  // Before anything else, because the rules that hide GitHub's inbox are written per page and
  // hang on this. Synchronous and first: an attribute set a frame late is a frame of their
  // list on the screen.
  markPage(document, NOTIFICATIONS)

  initialiseErrorReporting("notifications")

  const store = settings()

  let close = (): void => {}
  let on: string | undefined
  let view: View = "ours"

  const show = (url: string): void => {
    /*
     * Somewhere else — their subscriptions page, or another page entirely. The stylesheet is
     * gating this page too, because a stylesheet cannot read a URL, so handing it back is the
     * first thing this does.
     */
    if (!noticesIn(url)) {
      close()
      close = () => {}
      on = undefined
      handBack(document)
      return
    }

    /*
     * Their query, which is the one thing about this page that is theirs and still matters: a
     * link into `?query=is:unread` is a link to a smaller inbox, and it is read rather than
     * replaced. It is also what makes this page a different page, so it is what tells the same
     * inbox arrived at again from a different one.
     */
    const query = new URL(url).search.replace(/^\?/, "")
    if (on === query) return

    close()
    close = () => {}
    on = undefined

    // Their inbox, because that is what was asked for last time.
    if (view === "github") {
      reveal(document)
      ungate(document)
      return
    }

    close = open(query)
    on = query
  }

  // The whole address and not the path, because which inbox this is lives in the query.
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

        if (noticesIn(here)) show(here)
        else if (promise !== null) {
          const asked = new URL(promise, window.location.origin).toString()
          if (noticesIn(asked)) show(asked)
          else reveal(document)
        } else reveal(document)
      })
    )
  )
}
