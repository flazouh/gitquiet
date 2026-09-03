import { Effect, Option } from "effect"
import { rememberedRepositories } from "@/app/destinations"
import { loadCommit, loadCommitDiffs, rememberedCommit } from "@/app/pullRequest"
import { fromPathname, type CommitRef } from "@/domain/CommitRef"
import type { CommitDetail } from "@/domain/PullRequest"
import { reportError } from "@/observability/report"
import type { View } from "@/domain/Settings"
import { chosenView, rememberView } from "@/app/settings"
import { standAScreen } from "@/shell/screen"
import { settings, throughGitHub } from "@/shell/supplied"
import { CommitScreen } from "@/ui/CommitScreen"
import { handBack, markPage, reveal, ungate } from "@/ui/mount"
import { COMMIT } from "@/ui/place"
import { offerOurPage } from "@/ui/theirTabs"
import { whenLocationChanges } from "@/ui/navigation"
import "@/ui/styles.css"

/**
 * Every repository the reader has, as the store already knows them.
 *
 * For the palette in the bar. Cache only: a page asking GitHub for the whole list on the chance
 * somebody presses ⌘K would be spending a request a reader never asked for.
 */
const recallRepositories = () => rememberedRepositories().pipe(throughGitHub)

/**
 * Puts the interface on the page for one commit, and hands back the way to
 * take it off again.
 */
const open = (reference: CommitRef, onUseGitHub: () => void): (() => void) => {
  const read = (sha: string) =>
    loadCommit(reference, sha).pipe(
      throughGitHub,
      // Reported here and still failed: the screen says a commit would not
      // load, and the log says why.
      Effect.tapError((error) => Effect.sync(() => reportError(error)))
    )

  /**
   * The commit as the store has it, for the half second before GitHub answers.
   *
   * Nothing is reported when this fails or finds nothing. The live read is on its way and is
   * the answer either way, and a page that could not remember is not a fault worth a log line.
   */
  const recall = (sha: string) =>
    rememberedCommit(reference, sha).pipe(
      throughGitHub,
      Effect.catch(() => Effect.succeed(Option.none<CommitDetail>()))
    )

  // The files their page sent as names rather than content, which on a commit
  // of any size is most of them.
  const fetchDiffs = (paths: ReadonlyArray<string>) =>
    loadCommitDiffs(reference, reference.sha, paths).pipe(throughGitHub)

  return standAScreen({
    place: COMMIT,
    draw: () => (
      <CommitScreen
        reference={reference}
        load={read}
        preload={recall}
        recallRepositories={recallRepositories}
        fetchDiffs={fetchDiffs}
        onUseGitHub={onUseGitHub}
      />
    )
  }).close
}

/**
 * Puts the commit panel in charge of the document, once.
 *
 * Called by the shell, which is what decides that the address is a commit. Between
 * commits — a parent, the next one in a list — this follows the address itself.
 *
 * The flag this used to set against the window is gone with the reason for it: two
 * of these screens could be started in one document only because two content
 * scripts could match one page. Nothing imports a screen now except the shell, and
 * it starts one at a time.
 */
export const start = (): void => {
  // Before anything else, because the rules that hide GitHub's own commit header
  // are written per page and hang on this. A commit is its own page here rather
  // than a pull request with a different band: the two share a region, and a rule
  // for one firing on the other takes the title row off every pull request.
  markPage(document, COMMIT)


  const store = settings()

  let close = (): void => {}
  let unoffer = (): void => {}
  let view: View = "ours"

  /**
   * Leaves GitHub to it, putting one control beside the action in their own
   * header so this is a choice rather than a trapdoor.
   *
   * The preference this writes down holds for every commit after it, so a
   * page that took the interface away and offered nothing to bring it back
   * would be a door that only opens one way.
   */
  function handOver(): void {
    close()
    close = () => {}
    reveal(document)
    ungate(document)
    unoffer()
    unoffer = offerOurPage(document, takeBack)
  }

  /** Pressed on GitHub's page: ours from here on, starting with this one. */
  function takeBack(): void {
    view = "ours"
    void rememberView(store, "ours")
    show(window.location.pathname)
  }

  function useGitHub(): void {
    view = "github"
    void rememberView(store, "github")
    handOver()
  }

  function show(path: string): void {
    close()
    close = () => {}
    unoffer()
    unoffer = () => {}

    const reference = fromPathname(path)
    if (Option.isNone(reference)) {
      handBack(document)
      return
    }

    if (view === "github") {
      handOver()
      return
    }

    close = open(reference.value, useGitHub)
  }

  // Their own navigation between commits — a parent, the next one in a list —
  // never loads a page, so the address is what says which commit this is now.
  whenLocationChanges(window, (path) => show(path))

  Effect.runFork(
    chosenView(store).pipe(
      Effect.map((chosen) => {
        view = chosen
        show(window.location.pathname)
      })
    )
  )
}
