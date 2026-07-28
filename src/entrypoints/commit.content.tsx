import { Effect, Option } from "effect"
import { createRoot } from "react-dom/client"
import { defineContentScript } from "wxt/utils/define-content-script"
import { loadCommit, loadCommitDiffs } from "@/app/pullRequest"
import { fromPathname, type CommitRef } from "@/domain/CommitRef"
import { layer as gatewayLayer } from "@/github/GitHubGateway"
import { initialiseErrorReporting, reportError } from "@/observability/sentry"
import type { View } from "@/settings/Settings"
import { browserSettings, rememberView, type Store } from "@/settings/store"
import { CommitScreen } from "@/ui/CommitScreen"
import { gate, interfaceContainer, reveal, takeOverSlotWhenReady, ungate } from "@/ui/mount"
import { whenLocationChanges } from "@/ui/navigation"
import "@/ui/styles.css"

/**
 * The last resort that stops a gated page staying blank. The same reasoning as
 * the pull request's, and the same number: whatever goes wrong, GitHub's own
 * page is a far better thing to be looking at than nothing.
 */
const FAILSAFE = 20_000

/** How long to wait for the stored choice of page before assuming it is ours. */
const CHOICE = 250

const chosenView = (store: Store): Promise<View> =>
  Promise.race([
    store.read().then((settings) => settings.page.view),
    new Promise<View>((wake) => setTimeout(() => wake("ours"), CHOICE))
  ])

/**
 * Puts the interface on the page for one commit, and hands back the way to
 * take it off again.
 */
const open = (reference: CommitRef, onUseGitHub: () => void): (() => void) => {
  gate(document)
  const failsafe = setTimeout(() => {
    reveal(document)
    ungate(document)
  }, FAILSAFE)

  const read = (sha: string) =>
    Effect.runPromise(loadCommit(reference, sha).pipe(Effect.provide(gatewayLayer))).catch(
      (error: unknown) => {
        reportError(error)
        throw error
      }
    )

  // The files their page sent as names rather than content, which on a commit
  // of any size is most of them.
  const fetchDiffs = (paths: ReadonlyArray<string>) =>
    Effect.runPromise(
      loadCommitDiffs(reference, reference.sha, paths).pipe(Effect.provide(gatewayLayer))
    )

  let stepAside = (): void => {}
  let watching = true

  const container = interfaceContainer(document)
  const root = createRoot(container)
  root.render(
    <CommitScreen
      reference={reference}
      load={read}
      fetchDiffs={fetchDiffs}
      onUseGitHub={onUseGitHub}
    />
  )

  void (async () => {
    try {
      const takeover = await takeOverSlotWhenReady(document, container)
      if (!watching) return
      if (takeover === null) {
        root.unmount()
        return
      }
      stepAside = takeover.stepAside
    } catch (error) {
      reveal(document)
      ungate(document)
      reportError(error)
    } finally {
      clearTimeout(failsafe)
    }
  })()

  return () => {
    watching = false
    clearTimeout(failsafe)
    stepAside()
    root.unmount()
    reveal(document)
  }
}

export default defineContentScript({
  // A commit named as one. The list of commits and a commit read inside a pull
  // request are other pages, and the pattern is deliberately wider than the
  // parser: what a content script matches cannot say what a sha looks like, so
  // the address is read again in `main` and anything else is left alone.
  matches: ["*://github.com/*/*/commit/*"],
  runAt: "document_start",
  main() {
    // One interface per document, shared with the pull request's script: both
    // can end up in the same page, and the second has nothing to add.
    const world = window as typeof window & { githubproOpen?: true }
    if (world.githubproOpen === true) return
    world.githubproOpen = true

    initialiseErrorReporting("content-script")

    const store = browserSettings()

    let close = (): void => {}
    let view: View = "ours"

    /**
     * Leaves GitHub to it.
     *
     * No control is planted on their page to come back with, as there is on a
     * pull request: a commit's page has no tab row to put one in, and the
     * choice is the same one either way — it is made again, and undone, from
     * the header of any pull request this opens.
     */
    function handOver(): void {
      close()
      close = () => {}
      reveal(document)
      ungate(document)
    }

    function useGitHub(): void {
      view = "github"
      void rememberView(store, "github")
      handOver()
    }

    function show(path: string): void {
      close()
      close = () => {}

      const reference = fromPathname(path)
      if (Option.isNone(reference)) {
        reveal(document)
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

    void chosenView(store).then((chosen) => {
      view = chosen
      show(window.location.pathname)
    })
  }
})
