import { Effect, Fiber, Option } from "effect"
import { loadBranches } from "@/app/commitList"
import { rememberedRepositories } from "@/app/destinations"
import { forgetIntent, intendedPath } from "@/app/intent"
import {
  loadRepoHome,
  loadFile,
  loadFolderTouches,
  loadStanding,
  loadTreePaths,
  rememberedRepoHome,
  starRepo
} from "@/app/repoHome"
import { chosenView } from "@/app/settings"
import { shelfOf } from "@/app/shelf"
import type { Front, RepoHome } from "@/domain/repoHome"
import { repoHomeIn } from "@/domain/repoHome"
import type { View } from "@/domain/Settings"
import { frontInDocument } from "@/github/repoHome"
import { initialiseErrorReporting, reportError } from "@/observability/sentry"
import { standAScreen } from "@/shell/screen"
import { settings, throughGitHub } from "@/shell/supplied"
import { handBack, markPage, reveal, ungate } from "@/ui/mount"
import { whenLocationChanges } from "@/ui/navigation"
import { REPO_HOME } from "@/ui/place"
import { RepoHomeScreen } from "@/ui/RepoHomeScreen"
import "@/ui/styles.css"

const recallRepositories = () => rememberedRepositories().pipe(throughGitHub)

const addressOf = (home: RepoHome): string => `${home.repo.owner}/${home.repo.repo}`

/** Whether two addresses are the same tree, and differ only in what is open in it. */
const sameTree = (one: RepoHome, two: RepoHome): boolean =>
  one.repo.owner === two.repo.owner &&
  one.repo.repo === two.repo.repo &&
  // The front page names no branch and `/tree/main` names the one it was
  // already on, so arriving at one from the other is not a new tree.
  (one.branch ?? two.branch) === (two.branch ?? one.branch)

/**
 * The page as the reader last saw it, kept for as long as this document lives.
 *
 * Held in memory and not in the store, which is the difference that matters here:
 * a rendered README is a third of a megabyte, and writing one per repository into
 * `browser.storage.local` would fill the reader's quota with markup GitHub renders
 * again on every visit. See `KeptFront` in `src/domain/repoHome.ts`, which is the
 * lighter thing the store does hold.
 */
let asLastSeen: { readonly address: string; readonly front: Front } | undefined

/**
 * A screen that is up, and the two things the shell can still do to it.
 *
 * `retarget` is here because a file opening is not a new page. The address does
 * change — a file has a link, and back returns to the README — but tearing the
 * screen down and building it again for it would re-read the repository, throw
 * away the tree's expanded folders and put the reader back at the top of the
 * page, all to change which document is in one column.
 */
type Open = {
  readonly close: () => void
  readonly retarget: (reading: string | null) => void
}

const open = (home: RepoHome): Open => {
  /*
   * The payload GitHub already put in this document, where it put one.
   *
   * The whole reason this page can cost nothing. A reader who loaded this address
   * has the tree, the rendered README and the About panel in the markup that is
   * already parsed, so the only request left is the commit column. Read fresh on
   * every open rather than once, because GitHub replaces the script's contents on
   * a soft navigation between repositories.
   */
  const having = () =>
    frontInDocument(home.repo, document).pipe(
      Effect.catch(() => Effect.succeed(Option.none<Front>()))
    )

  /*
   * The branch a file link is written on.
   *
   * The address names it on `/tree/<branch>` and does not on the front page, so
   * until the page is read this is a placeholder GitHub accepts in a blob
   * address. The read replaces it with the real name, which happens long before
   * a row can be pressed.
   */
  let branchNow = home.branch ?? "HEAD"

  const reading = (partly: (front: Front) => void) =>
    having().pipe(
      Effect.flatMap((inPage) => loadRepoHome(home.repo, inPage, partly)),
      throughGitHub,
      Effect.tap((front) =>
        Effect.sync(() => {
          asLastSeen = { address: addressOf(home), front }
          branchNow = front.branch
        })
      ),
      Effect.tapError((error) => Effect.sync(() => reportError(error)))
    )

  /** This very page, as this document last had it up. */
  const held = asLastSeen?.address === addressOf(home) ? asLastSeen.front : undefined

  const remembered = () =>
    held !== undefined
      ? Effect.succeed(Option.some(held))
      : rememberedRepoHome(home.repo).pipe(
          throughGitHub,
          Effect.catch(() => Effect.succeed(Option.none<Front>()))
        )

  let sofar: Front | undefined
  let tell: ((front: Front) => void) | undefined

  /*
   * Whether the first stage is worth showing, or only the answer.
   *
   * It is the file list without its commit column, which is most of the page and
   * arrives a whole request earlier. Worth showing to a reader arriving cold, and
   * not worth showing over a complete page this document already had up: that
   * would take the column off the rows and put it back a moment later.
   */
  const staged = held === undefined

  const first = Effect.runFork(
    reading((front) => {
      if (!staged) return
      sofar = front
      tell?.(front)
    })
  )

  let started = false
  const read = (partly: (front: Front) => void) => {
    if (!started) {
      started = true
      if (staged) {
        tell = partly
        if (sofar !== undefined) partly(sofar)
      }
      return Fiber.join(first)
    }
    return reading(partly)
  }

  /*
   * One read, held, rather than one per render.
   *
   * The card asks for this from an effect keyed on the function it was given,
   * so a new function on every render is a new request on every render.
   */
  const standingOf = () => loadStanding(home.repo).pipe(throughGitHub)
  const paths = (sha: string) => loadTreePaths(home.repo, sha).pipe(throughGitHub)
  const touches = (sha: string, folder: string) =>
    loadFolderTouches(home.repo, sha, folder).pipe(throughGitHub)

  /** The branches, once the picker over the tree is opened and not before. */
  const branches = (partly: (names: ReadonlyArray<string>) => void) =>
    loadBranches(home.repo, partly).pipe(throughGitHub)

  /*
   * One shelf for this page, so a file read once is never read again and the
   * pointer resting on a row pays for the press that follows it.
   */
  const shelf = shelfOf((on, path) => loadFile(home.repo, on, path).pipe(throughGitHub))

  /*
   * Pushed, so the file has a link and the back button returns to the README.
   * Their router is not told: this is our screen either way, and handing them a
   * navigation for it is the round trip this page exists to avoid.
   */
  const goTo = (reading: string | null): void => {
    const at = reading === null
      ? `/${home.repo.owner}/${home.repo.repo}`
      : `/${home.repo.owner}/${home.repo.repo}/blob/${branchNow}/${reading
          .split("/")
          .map(encodeURIComponent)
          .join("/")}`
    if (window.location.pathname === at) return
    window.history.pushState(null, "", at)
    show(reading)
  }

  // Which file is open in the reading pane, or the README where none is.
  let showing = home.reading

  const page = standAScreen({
    place: REPO_HOME,
    draw: (standing) => (
      <RepoHomeScreen
        repo={home.repo}
        load={read}
        preload={remembered}
        recallRepositories={recallRepositories}
        onStepAside={standing.stepAside}
        onStar={(to) => starRepo(home.repo, to).pipe(throughGitHub)}
        loadStanding={standingOf}
        loadPaths={paths}
        loadTouches={touches}
        loadBranches={branches}
        shelf={shelf}
        reading={showing}
        onRead={goTo}
      />
    )
  })

  /** Another file in the same tree, which is a redraw rather than a new page. */
  function show(reading: string | null): void {
    showing = reading
    page.redraw()
  }

  return {
    close: page.close,
    retarget: (reading) => {
      if (reading !== showing) show(reading)
    }
  }
}

/**
 * Puts this screen in charge of the document, once.
 *
 * Called by the shell, which is the one script GitHub cannot navigate away from —
 * see `src/entrypoints/shell.content.ts`.
 */
export const start = (): void => {
  markPage(document, REPO_HOME)

  initialiseErrorReporting("repo-home")

  const store = settings()

  let up: Open | undefined
  let on: RepoHome | undefined
  let view: View = "ours"

  const show = (url: string): void => {
    const home = repoHomeIn(url)

    if (Option.isNone(home)) {
      up?.close()
      up = undefined
      on = undefined
      handBack(document)
      return
    }

    /*
     * The same page with another document in one column, which is a press in
     * the tree and the back button out of it. The screen stays up and is told;
     * see `Open`. Anything else — another repository, another branch — is a
     * different page and is built again.
     */
    if (up !== undefined && on !== undefined && sameTree(on, home.value)) {
      on = home.value
      up.retarget(home.value.reading)
      return
    }

    up?.close()
    up = undefined
    on = undefined

    if (view === "github") {
      reveal(document)
      ungate(document)
      return
    }

    up = open(home.value)
    on = home.value
  }

  whenLocationChanges(window, () => show(window.location.href))

  Effect.runFork(
    chosenView(store).pipe(
      Effect.map((chosen) => {
        view = chosen

        const here = window.location.href
        const promise = intendedPath(window)
        forgetIntent(window)

        if (Option.isSome(repoHomeIn(here))) show(here)
        else if (promise !== null) {
          const asked = new URL(promise, window.location.origin).toString()
          if (Option.isSome(repoHomeIn(asked))) show(asked)
          else reveal(document)
        } else reveal(document)
      })
    )
  )
}
