import { Effect, Option } from "effect"
import { chosenSettings, rememberView } from "@/app/settings"
import { handOverToGitHub } from "@/shell/handOver"
import { compareIn, fileListRoute, type Changed, type Comparing } from "@/domain/compare"
import { changedInCompare } from "@/github/compare"
import { DEFAULT_SPOT, type Spot, type View } from "@/domain/Settings"
import { reportError } from "@/observability/report"
import { standAScreen, type Standing } from "@/shell/screen"
import { settings } from "@/shell/supplied"
import { CompareScreen } from "@/ui/CompareScreen"
import { gate, handBack, markPage } from "@/ui/mount"
import { whenLocationChanges } from "@/ui/navigation"
import { COMPARE } from "@/ui/place"
import "@/ui/styles.css"

/**
 * Two refs compared, and what stands between them.
 *
 * Their own page carries no file list at all — no embedded payload, and no filename
 * anywhere in the document — and defers it to a fragment. So this screen reads the
 * fragment, which is the only thing on that address worth reading. See
 * `plans/008-the-two-pages-left.md` for how that address was found.
 */

/** Their fragment, fetched the way their own page fetches it. */
const readFileList = (comparing: Comparing): Effect.Effect<ReadonlyArray<Changed>, unknown> =>
  Effect.gen(function* () {
    const route = fileListRoute(comparing)
    const answer = yield* Effect.tryPromise({
      try: () =>
        fetch(`https://github.com${route}`, {
          credentials: "include",
          headers: { Accept: "text/html", "X-Requested-With": "XMLHttpRequest" }
        }),
      catch: (cause) => cause
    })
    if (!answer.ok) return yield* Effect.fail(new Error(`${route} answered ${answer.status}`))

    const html = yield* Effect.tryPromise({ try: () => answer.text(), catch: (cause) => cause })
    return changedInCompare(new DOMParser().parseFromString(html, "text/html"))
  })

export const start = (): void => {

  const store = settings()
  let view: View = "ours"
  /** Takes the way back off the page, where one of ours is on it. */
  let unoffer = (): void => {}
  /** Where the reader left the way back, so it comes back where they put it. */
  let spot: Spot = DEFAULT_SPOT
  let standing: Standing | null = null
  let stood: string | null = null

  const stepAside = (): void => {
    standing?.close()
    standing = null
    stood = null
    handBack(document)
  }

  const show = (path: string): void => {
    const comparing = compareIn(`https://github.com${path}${window.location.search}`)
    if (Option.isNone(comparing)) {
      stepAside()
      return
    }

    // Their page, because that is what was asked for last time — with the way back
    // on it, because a page that hands over and offers nothing is a door that only
    // opens one way.
    if (view === "github") {
      unoffer()
      unoffer = handOverToGitHub(store, document, spot, takeBack)
      return
    }

    unoffer()
    unoffer = () => {}

    if (stood === path) return
    standing?.close()
    stood = path

    let changed: ReadonlyArray<Changed> = []
    let reading = true
    let failed = false

    markPage(document, COMPARE)
    standing = standAScreen({
      place: COMPARE,
      draw: () => (
        <CompareScreen
          comparing={comparing.value}
          changed={changed}
          reading={reading}
          failed={failed}
          onStepAside={stepAside}
        />
      )
    })

    Effect.runFork(
      readFileList(comparing.value).pipe(
        Effect.match({
          onSuccess: (found) => {
            changed = found
            reading = false
            standing?.redraw()
          },
          onFailure: (cause) => {
            reading = false
            failed = true
            standing?.redraw()
            reportError(cause)
          }
        })
      )
    )
  }

  /** Pressed on GitHub's page: ours from here on, starting with this one. */
  function takeBack(): void {
    view = "ours"
    rememberView(store, "ours")
    unoffer()
    unoffer = () => {}
    gate(document)
    /*
     * Cleared, unlike the other screens, because this one asks which path it is
     * standing for after the hand-over rather than before it. Left holding this
     * path, the press asking for the interface back is answered by a screen that
     * decides it is already showing what was asked for.
     */
    stood = null
    show(window.location.pathname)
  }

  whenLocationChanges(window, show)

  // Nothing is drawn until the choice is known, so a reader who wants GitHub's page is
  // not charged a fragment for an interface they turned off.
  Effect.runFork(
    chosenSettings(store).pipe(
      Effect.map((chosen) => {
        view = chosen.page.view
        spot = chosen.wayBack
        show(window.location.pathname)
      })
    )
  )
}
