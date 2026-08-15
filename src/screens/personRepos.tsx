import { Effect, Option } from "effect"
import { forgetIntent, intendedPath } from "@/app/intent"
import { type TheirList, theirWholeList } from "@/app/personRepos"
import { chosenView } from "@/app/settings"
import { type PersonPage, personReposIn } from "@/domain/person"
import type { View } from "@/domain/Settings"
import { initialiseErrorReporting, reportError } from "@/observability/sentry"
import { held, standAScreen } from "@/shell/screen"
import { settings, throughGitHub } from "@/shell/supplied"
import { theirColumn } from "./theirColumn"
import { handBack, markPage, reveal, ungate } from "@/ui/mount"
import { whenAddressChanges } from "@/ui/navigation"
import { PERSON_REPOS } from "@/ui/place"
import { PersonReposScreen, type Shown } from "@/ui/PersonReposScreen"
import "@/ui/styles.css"

/**
 * Puts one person's repositories on the page, and hands back the way to take them off.
 *
 * Staged, and the stage is what this screen is: page one is in the document GitHub
 * served, so the groups are drawn in the first frame, and the four or five pages behind
 * it arrive a second later and correct the counts. Nothing here waits on a request
 * before drawing anything.
 */
const open = (page: PersonPage): (() => void) => {
  const reading = (partly: (shown: Shown) => void) =>
    theirWholeList(page, document, (list: TheirList) =>
      // The first thirty rows, and the sentence that says they are the first thirty.
      partly({ rows: list.rows, reading: true, capped: false })
    ).pipe(
      throughGitHub,
      Effect.map((list): Shown => ({ rows: list.rows, reading: false, capped: list.capped })),
      Effect.tapError((error) => Effect.sync(() => reportError(error)))
    )

  // Started before anything is waited on, as on the releases screen: reading their list
  // and waiting for GitHub to render a frame to stand in have nothing to say to each other.
  const read = held(reading)

  /*
   * Their column, where the press that brought the reader here loaded no document and
   * there is none on the page to read. See `theirColumn`.
   */
  const column = theirColumn(page)

  /*
   * Who they are is not read here, and that is deliberate. The column is in the markup
   * the gate hides — the face, the name, the bio, the counts and every link they set —
   * so it costs nothing and is the whole reason the page can be taken whole rather than
   * in half. But this runs at `document_start`, where that markup is half a card at
   * best, so the screen does the reading and does it again when the page is parsed. See
   * `usePerson`.
   */
  return standAScreen({
    place: PERSON_REPOS,
    draw: (standing) => (
      <PersonReposScreen
        login={page.login}
        load={read}
        elsewhere={column}
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
  // First and synchronous, because the rules that hide their list are written per page and
  // hang on this attribute. A frame late is a frame of their list on the screen.
  markPage(document, PERSON_REPOS)

  initialiseErrorReporting("person-repos")

  const store = settings()

  let close = (): void => {}
  let on: string | undefined
  let view: View = "ours"

  const show = (url: string): void => {
    const page = personReposIn(url)

    /*
     * One of their other tabs, or somewhere else entirely. The stylesheet gates this
     * address and cannot read a URL, so handing the page back is the first thing to do.
     */
    if (Option.isNone(page)) {
      close()
      close = () => {}
      on = undefined
      handBack(document)
      return
    }

    /*
     * The same list, arrived at again. Their own page number and their own find are in the
     * query and both are read into this key: page one and page four of the same account are
     * one list here — the walk reads every page either way — but a reader who typed
     * something into their box has asked for a different list.
     */
    const address = `${page.value.login}?${page.value.narrowing}`
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

    close = open(page.value)
    on = address
  }

  /*
   * The address and not the path, unlike every other screen here. All three of a person's
   * pages are one path and differ in the query alone, so a watcher that fires on the path
   * would never fire on a press from Overview to Repositories — the one navigation this
   * screen exists to answer. See `whenAddressChanges`.
   */
  whenAddressChanges(window, () => show(window.location.href))

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

        if (Option.isSome(personReposIn(here))) show(here)
        else if (promise !== null) {
          const asked = new URL(promise, window.location.origin).toString()
          if (Option.isSome(personReposIn(asked))) show(asked)
          else reveal(document)
        } else reveal(document)
      })
    )
  )
}
