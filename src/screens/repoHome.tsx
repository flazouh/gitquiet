import { Effect, Fiber, Option } from "effect"
import { loadBranches } from "@/app/commitList"
import { rememberedRepositories } from "@/app/destinations"
import { forgetIntent, intendedPath } from "@/app/intent"
import {
  loadRepoHome,
  loadFile,
  loadFolderTouches,
  loadReadme,
  loadStanding,
  loadTreePaths,
  rememberedRepoHome,
  starRepo
} from "@/app/repoHome"
import { chosenView } from "@/app/settings"
import { shelfOf } from "@/app/shelf"
import type { Front, RepoHome, Touch } from "@/domain/repoHome"
import { repoHomeIn } from "@/domain/repoHome"
import type { View } from "@/domain/Settings"
import { frontInDocument, repoHomeInDocument } from "@/github/repoHome"
import { initialiseErrorReporting, reportError } from "@/observability/sentry"
import { standAScreen } from "@/shell/screen"
import { settings, throughGitHub } from "@/shell/supplied"
import { repoNamed } from "@/ui/lastDrawn"
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
let asLastSeen:
  | { readonly address: string; readonly branch: string | null; readonly front: Front }
  | undefined

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
  readonly retarget: (reading: string | null, branch: string | null) => void
}

const open = (home: RepoHome, onMove: (path: string) => void): Open => {
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
    frontInDocument(home.repo, home.branch, document).pipe(
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
      Effect.flatMap((inPage) => loadRepoHome(home.repo, home.branch, inPage, partly)),
      throughGitHub,
      Effect.tap((front) =>
        Effect.sync(() => {
          asLastSeen = { address: addressOf(home), branch: home.branch, front }
          branchNow = front.branch
        })
      ),
      Effect.tapError((error) => Effect.sync(() => reportError(error)))
    )

  /** This very page, as this document last had it up. */
  const held =
    asLastSeen?.address === addressOf(home) && asLastSeen.branch === home.branch
      ? asLastSeen.front
      : undefined

  const remembered = () =>
    held !== undefined
      ? Effect.succeed(Option.some(held))
      : rememberedRepoHome(home.repo, home.branch).pipe(
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
  const touches = (
    sha: string,
    folder: string,
    partly: (found: ReadonlyMap<string, Touch>) => void
  ) => loadFolderTouches(home.repo, sha, folder, partly).pipe(throughGitHub)

  /** The branches, once the picker over the tree is opened and not before. */
  const branches = (partly: (names: ReadonlyArray<string>) => void) =>
    loadBranches(home.repo, partly).pipe(throughGitHub)

  /** The README's own text, which the screen parses in place of GitHub's HTML. */
  const readme = (branch: string, path: string) =>
    loadReadme(home.repo, branch, path).pipe(throughGitHub)

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
    onMove(at)
    window.history.pushState(null, "", at)
    show(reading, branchNow)
  }

  // Which file is open in the reading pane, or the README where none is.
  let showing = home.reading
  let showingBranch = home.branch ?? undefined

  const page = standAScreen({
    place: REPO_HOME,
    draw: (standing) => (
      <RepoHomeScreen
        repo={home.repo}
        load={read}
        preload={remembered}
        where={repoNamed(home.repo, home.branch)}
        recallRepositories={recallRepositories}
        onStepAside={standing.stepAside}
        onStar={(to) => starRepo(home.repo, to).pipe(throughGitHub)}
        loadStanding={standingOf}
        loadPaths={paths}
        loadTouches={touches}
        loadBranches={branches}
        loadReadme={readme}
        shelf={shelf}
        reading={showing}
        readingBranch={showingBranch}
        onRead={goTo}
      />
    )
  })

  /** Another file in the same tree, which is a redraw rather than a new page. */
  function show(reading: string | null, branch: string | null): void {
    showing = reading
    showingBranch = branch ?? undefined
    page.redraw()
  }

  return {
    close: page.close,
    retarget: (reading, branch) => {
      if (reading !== showing || (branch ?? undefined) !== showingBranch) show(reading, branch)
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
  let handledPath: string | undefined
  let waiting: MutationObserver | undefined
  let waitingFor: string | undefined

  const stopWaiting = (): void => {
    waiting?.disconnect()
    waiting = undefined
    waitingFor = undefined
  }

  const waitForDocument = (url: string): void => {
    if (waitingFor === url) return
    stopWaiting()
    waitingFor = url

    waiting = new MutationObserver(() => {
      if (URL.parse(url)?.pathname !== window.location.pathname) {
        stopWaiting()
        return
      }

      if (Option.isSome(repoHomeInDocument(url, document))) {
        stopWaiting()
        show(url)
      }
    })
    waiting.observe(document.documentElement, { childList: true, subtree: true, characterData: true })
  }

  const show = (url: string): void => {
    const address = repoHomeIn(url)
    const home = repoHomeInDocument(url, document)

    if (Option.isNone(home)) {
      up?.close()
      up = undefined
      on = undefined
      handBack(document)
      if (Option.isSome(address) && address.value.branch !== null) waitForDocument(url)
      else stopWaiting()
      return
    }

    stopWaiting()

    /*
     * The same page with another document in one column, which is a press in
     * the tree and the back button out of it. The screen stays up and is told;
     * see `Open`. Anything else — another repository, another branch — is a
     * different page and is built again.
     */
    if (up !== undefined && on !== undefined && sameTree(on, home.value)) {
      on = home.value
      up.retarget(home.value.reading, home.value.branch)
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

    up = open(home.value, (path) => {
      handledPath = path
    })
    on = home.value
  }

  whenLocationChanges(window, (path) => {
    if (path === handledPath) {
      handledPath = undefined
      return
    }
    handledPath = undefined
    show(window.location.href)
  })

  Effect.runFork(
    chosenView(store).pipe(
      Effect.map((chosen) => {
        view = chosen

        const arrive = () => {
          const here = window.location.href
          const promise = intendedPath(window)
          forgetIntent(window)

          if (Option.isSome(repoHomeIn(here))) show(here)
          else if (promise !== null) {
            const asked = new URL(promise, window.location.origin).toString()
            if (Option.isSome(repoHomeIn(asked))) show(asked)
            else reveal(document)
          } else reveal(document)
        }

        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", arrive, { once: true })
        } else {
          arrive()
        }
      })
    )
  )
}
