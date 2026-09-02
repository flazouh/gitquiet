import { Effect, Fiber, Option } from "effect"
import { loadBranches } from "@/app/commitList"
import { rememberedRepositories } from "@/app/destinations"
import { repoEntitled } from "@/app/entitling"
import { forgetIntent, intendedPath } from "@/app/intent"
import { keptReads } from "@/app/kept"
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
import { type Shelf, shelfOf } from "@/app/shelf"
import type { RepoRef } from "@/domain/PullRequestRef"
import type { Front, RepoHome, Touch } from "@/domain/repoHome"
import { repoHomeIn } from "@/domain/repoHome"
import type { View } from "@/domain/Settings"
import { frontInDocument, repoHomeInDocument } from "@/github/repoHome"
import { initialiseErrorReporting, reportError } from "@/observability/sentry"
import { standAScreen } from "@/shell/screen"
import { settings, throughGitHub } from "@/shell/supplied"
import { lastDrawn, repoNamed } from "@/ui/lastDrawn"
import { handBack, markPage, reveal, ungate } from "@/ui/mount"
import { whenLocationChanges } from "@/ui/navigation"
import { REPO_HOME } from "@/ui/place"
import { RepoHomeScreen } from "@/ui/RepoHomeScreen"
import "@/ui/styles.css"

const recallRepositories = () => rememberedRepositories().pipe(throughGitHub)

const addressOf = (home: RepoHome): string => `${home.repo.owner}/${home.repo.repo}`

/**
 * A branch name or file path as an address writes it: each segment escaped on
 * its own, so a `#` or a space survives and a slash keeps meaning a slash.
 */
const escaped = (name: string): string =>
  name.split("/").map(encodeURIComponent).join("/")

/**
 * Whether two addresses are the same tree, and differ only in what is open in it.
 *
 * A bare address means the default branch, so it can only be called the same
 * tree as a named one when the default is known and is that name. It used to be
 * read as "whatever branch is standing", which was true while the only way to
 * stand on a branch was to load its document — and stopped being true when the
 * picker learnt to switch in place: back from `/tree/next` to the front page
 * matched, and the reader was shown `next` under an address that means `main`.
 */
const sameTree = (
  one: RepoHome,
  two: RepoHome,
  defaultBranch: string | undefined
): boolean => {
  if (one.repo.owner !== two.repo.owner || one.repo.repo !== two.repo.repo) return false
  if (one.branch === two.branch) return true

  const first = one.branch ?? defaultBranch
  const second = two.branch ?? defaultBranch
  return first !== undefined && first === second
}

/**
 * What a revisit can reuse without a single request, keyed the way each answer
 * is immutable or as good as: tree lists by the sha that names them, files and
 * READMEs by branch and path, branches and standing by the repository for the
 * life of this document. The fronts above refresh quietly behind what is shown;
 * these answer as they are, because a contributors card or a branch list that
 * moved mid-session was never what a reader was watching for.
 */
const readmes = keptReads(
  ({ repo, branch, path }: { repo: RepoRef; branch: string; path: string }) =>
    loadReadme(repo, branch, path).pipe(throughGitHub),
  ({ repo, branch, path }) => `${repo.owner}/${repo.repo}@${branch}:${path}`
)
const standings = keptReads(
  (repo: RepoRef) => loadStanding(repo).pipe(throughGitHub),
  (repo) => `${repo.owner}/${repo.repo}`
)
const treePaths = keptReads(
  ({ repo, sha }: { repo: RepoRef; sha: string }) =>
    loadTreePaths(repo, sha).pipe(throughGitHub),
  ({ repo, sha }) => `${repo.owner}/${repo.repo}:${sha}`
)
/** The two staged reads keep their stages on a first ask, and the final answer here. */
const folderTouches = new Map<string, ReadonlyMap<string, Touch>>()
const branchLists = new Map<string, ReadonlyArray<string>>()
/** One shelf per repository, so files survive the page being rebuilt. */
const shelves = new Map<string, Shelf>()

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
  readonly retarget: (reading: string | null, branch: string | null, path: string) => void
}

const open = (
  home: RepoHome,
  /** The exact pathname this screen is stood up for. See `DrawnAt` in `drawnAt.tsx`. */
  at: string,
  /**
   * A push this screen made, told with what the pushed address means, so the
   * caller can answer it if the address is ever walked back into: the address
   * alone cannot be read back — a slashed branch makes `/blob/a/b/c` ambiguous
   * — and GitHub's document, the other way of settling it, is exactly what
   * these pushes avoid loading.
   */
  onMove: (path: string, meaning: RepoHome) => void,
  onBranch?: (branch: string) => void,
  /** The branch GitHub resolved for this tree, once the read says. */
  onResolved?: (branch: string) => void
): Open => {
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
          branchNow = front.branch
          onResolved?.(front.branch)

          /*
           * The tab's fuller words, now that the description is known. Only
           * while the address is still this tree's front page: the read can
           * land after the reader has moved on, or opened a file whose name
           * the shell has already put on the tab — see `titleAt`, which said
           * the bare name the moment the address moved.
           */
          const at = Option.getOrNull(repoHomeIn(window.location.href))
          if (
            at !== null &&
            at.repo.owner === home.repo.owner &&
            at.repo.repo === home.repo.repo &&
            at.reading === null
          ) {
            document.title = repoEntitled(
              home.repo,
              Option.getOrNull(front.about.description)
            )
          }
        })
      ),
      Effect.tapError((error) => Effect.sync(() => reportError(error)))
    )

  /**
   * This very page, as this document last had it up.
   *
   * A peek at the memory `useLive` itself keeps and will draw from — see
   * `lastDrawn` — asked here only to answer one question: whether the read's
   * first stage is worth showing. It used to be a copy of that memory, one
   * slot wide, kept by this module for itself; the copy is gone and the one
   * memory answers for both.
   */
  const held = Option.getOrUndefined(
    lastDrawn<Front>(repoNamed(home.repo, home.branch))
  )

  const remembered = () =>
    rememberedRepoHome(home.repo, home.branch).pipe(
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
  const standingOf = () => standings.ask(home.repo)
  const paths = (sha: string) => treePaths.ask({ repo: home.repo, sha })
  /*
   * A folder's commit column is named by the tree's sha, so an answer once in
   * hand is the answer for good — kept whole, and the staged read only runs on
   * a folder this document has never opened.
   */
  const touches = (
    sha: string,
    folder: string,
    partly: (found: ReadonlyMap<string, Touch>) => void
  ) => {
    const key = `${addressOf(home)}:${sha}:${folder}`
    const known = folderTouches.get(key)
    if (known !== undefined) return Effect.succeed(known)
    return loadFolderTouches(home.repo, sha, folder, partly).pipe(
      throughGitHub,
      Effect.tap((all) => Effect.sync(() => folderTouches.set(key, all)))
    )
  }

  /** The branches, once the picker over the tree is opened and not before. */
  const branches = (partly: (names: ReadonlyArray<string>) => void) => {
    const known = branchLists.get(addressOf(home))
    if (known !== undefined) return Effect.succeed(known)
    return loadBranches(home.repo, partly).pipe(
      throughGitHub,
      Effect.tap((all) => Effect.sync(() => branchLists.set(addressOf(home), all)))
    )
  }

  /** The README's own text, which the screen parses in place of GitHub's HTML. */
  const readme = (branch: string, path: string) =>
    readmes.ask({ repo: home.repo, branch, path })

  /*
   * One shelf per repository rather than per page, so a file read once is never
   * read again — not on this visit, and not on the next one either.
   */
  const shelf =
    shelves.get(addressOf(home)) ??
    shelfOf((on, path) => loadFile(home.repo, on, path).pipe(throughGitHub))
  shelves.set(addressOf(home), shelf)

  /*
   * Pushed, so the file has a link and the back button returns to the README.
   * Their router is not told: this is our screen either way, and handing them a
   * navigation for it is the round trip this page exists to avoid.
   */
  const goTo = (reading: string | null): void => {
    /*
     * Closing a file returns to the tree it was open in, which is the bare
     * address only while the tree is the default branch's. On a chosen branch
     * the bare address means a different tree, so the way back is `/tree/…`.
     */
    const root = home.branch === null
      ? `/${home.repo.owner}/${home.repo.repo}`
      : `/${home.repo.owner}/${home.repo.repo}/tree/${escaped(home.branch)}`
    const at = reading === null
      ? root
      : `/${home.repo.owner}/${home.repo.repo}/blob/${branchNow}/${escaped(reading)}`
    if (window.location.pathname === at) return
    claimAt = at
    onMove(at, {
      repo: home.repo,
      branch: reading === null ? home.branch : branchNow,
      reading
    })
    window.history.pushState(null, "", at)
    show(reading, branchNow)
  }

  // Which file is open in the reading pane, or the README where none is.
  let showing = home.reading
  let showingBranch = home.branch ?? undefined
  /*
   * The pathname the claim below says, mutable because this screen outlives an
   * address change: a file opening in the tree and the way back out of it are
   * redraws of the same page. See `DrawnAt` in `drawnAt.tsx` for what a claim
   * gone stale would cost.
   */
  let claimAt = at

  const page = standAScreen({
    place: REPO_HOME,
    draw: (standing) => (
      <RepoHomeScreen
        repo={home.repo}
        load={read}
        preload={remembered}
        where={repoNamed(home.repo, home.branch)}
        recallRepositories={recallRepositories}
        at={claimAt}
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
        onBranch={onBranch}
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
    retarget: (reading, branch, path) => {
      claimAt = path
      if (reading !== showing || (branch ?? undefined) !== showingBranch) show(reading, branch)
      // Nothing else moved, so nothing else redraws this tree: the claim's own
      // prop has to be carried to the screen all the same.
      else page.redraw()
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
  /**
   * The branch the bare address resolves to, learnt from the first read of a
   * front page. `sameTree` needs it to say whether `/tree/main` and the front
   * page are one tree, now that the tree on the screen is not always the
   * document's.
   */
  let defaultBranch: string | undefined
  /**
   * What each address this screen pushed means, kept so the back and forward
   * buttons can walk into one. A pushed `/tree/…` or `/blob/…` never has
   * GitHub's document behind it, and the address alone cannot be read back —
   * a slashed branch makes it ambiguous — so re-entering one used to strand
   * the reader on whatever page was underneath.
   */
  const pushed = new Map<string, RepoHome>()

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

  /** One record for every push this screen makes, and the mark that skips answering it. */
  const moved = (path: string, meaning: RepoHome): void => {
    handledPath = path
    pushed.set(path, meaning)
  }

  const show = (url: string): void => {
    const address = repoHomeIn(url)
    const inDocument = repoHomeInDocument(url, document)

    /*
     * The document's own word first, then this screen's memory of its own
     * pushes. An address walked back into by the history buttons was pushed by
     * this screen, so no document ever loaded for it — the memory is the only
     * thing on the page that can say what it means.
     */
    const home = Option.isSome(inDocument)
      ? inDocument.value
      : pushed.get(URL.parse(url)?.pathname ?? "")

    if (home === undefined) {
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
    if (up !== undefined && on !== undefined && sameTree(on, home, defaultBranch)) {
      on = home
      up.retarget(home.reading, home.branch, new URL(url, window.location.origin).pathname)
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

    const repo = home.repo
    up = open(
      home,
      new URL(url, window.location.origin).pathname,
      moved,
      (name) => toBranch(repo, name),
      (branch) => {
        if (home.branch === null) defaultBranch = branch
      }
    )
    on = home
  }

  /**
   * Another branch of the same tree, chosen in the picker, which is a rebuild in
   * place rather than a page: pushed and redrawn exactly as a file opening is,
   * because a whole document load for a page this screen draws itself is the
   * cost the picker used to pay.
   *
   * Told the name rather than left to read it back off the address, because the
   * address cannot say it: a branch may carry a slash, and `show` above rightly
   * refuses to guess at `/tree/feat/one` without GitHub's document to settle it.
   * Here there is nothing to guess — the reader pressed the name.
   *
   * Told the repository as well, rather than reading `on`, and tolerant of the
   * address already being right — both for the same reason: the shell hears the
   * press too, from the top of the document, and may have pushed this address
   * and had `show` above stand the screen down before this runs. Whatever
   * happened first, what the press means is the same: this address, this
   * branch, one rebuild.
   */
  const toBranch = (
    repo: { readonly owner: string; readonly repo: string },
    name: string
  ): void => {
    const at = `/${repo.owner}/${repo.repo}/tree/${escaped(name)}`

    if (on !== undefined && on.branch === name && window.location.pathname === at) return

    const home = { repo, branch: name, reading: null }
    // Marked handled and remembered before the push, so the change this makes
    // is not answered a second time by the watcher below, and walking back into
    // the address later finds what it meant.
    moved(at, home)
    if (window.location.pathname !== at) window.history.pushState(null, "", at)
    // A `show` that ran first left an observer waiting for a document that is
    // now never coming; the rebuild below is its answer.
    stopWaiting()

    up?.close()
    up = open(home, at, moved, (chosen) => toBranch(repo, chosen))
    on = home
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
