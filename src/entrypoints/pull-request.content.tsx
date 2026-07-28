import { Effect, Option } from "effect"
import { createRoot } from "react-dom/client"
import { defineContentScript } from "wxt/utils/define-content-script"
import {
  loadCheckNotes,
  loadCommit,
  loadDiffs,
  loadPullRequest,
  mergePullRequest,
  rememberedPullRequest
} from "@/app/pullRequest"
import { forgetIntent, intendedPath } from "@/app/intent"
import type { Check } from "@/domain/PullRequest"
import { fromPathname, type PullRequestRef } from "@/domain/PullRequestRef"
import { layer as gatewayLayer } from "@/github/GitHubGateway"
import { initialiseErrorReporting, reportError } from "@/observability/sentry"
import { PullRequestScreen } from "@/ui/PullRequestScreen"
import { gate, interfaceContainer, reveal, takeOverSlotWhenReady, ungate } from "@/ui/mount"
import { whenLocationChanges } from "@/ui/navigation"
import "@/ui/styles.css"

/**
 * The last resort that stops a gated page staying blank.
 *
 * `gate.css` hides GitHub's conversation from the first paint and this script
 * is what lifts it again. Anything that stops the script reaching that point —
 * a throw, a hang, a GitHub deploy that moves the region — would otherwise
 * leave a reader looking at nothing at all, which is far worse than looking at
 * the page we meant to replace. Longer than the wait for the region itself, so
 * it fires only when that wait is not going to end.
 */
const FAILSAFE = 20_000

/**
 * How long a pull request drawn on the strength of a press has to be confirmed
 * by the address before it is taken back down.
 *
 * Normally the address agrees in about a second. It never will if the press did
 * not turn into a navigation — a cancelled drag, a link GitHub decided to
 * handle another way — and the page then has our pull request standing over
 * whatever the reader was actually looking at. Generous, because taking the
 * interface away from somebody who really is arriving would be much the ruder
 * mistake.
 */
const ABANDON = 6_000

/**
 * Puts the interface on the page for one pull request, and hands back the way
 * to take it off again.
 *
 * The closing half is not tidiness. GitHub navigates without loading a page, so
 * the interface for the pull request being left is still standing when the next
 * one arrives, and the attribute holding GitHub's conversation out of sight is
 * still set over a page that is no longer a conversation at all.
 */
/**
 * How long to look for a conversation region when drawing ahead of the address.
 *
 * Barely at all. The page on the screen is still the one being left — a list,
 * usually — so its regions belong to that page and the pull request's does not
 * exist yet. The full wait is for arrivals, where a region really might be a
 * moment away; here it is six hundred milliseconds spent watching a page that
 * is about to be replaced.
 */
const GLANCE = 100

const open = (reference: PullRequestRef, ahead = false): (() => void) => {
  // On a page load this changes nothing — the rule is already in force. On a
  // soft navigation it is the difference between arriving in our hand and
  // arriving in GitHub's and being replaced a moment later.
  gate(document)
  const failsafe = setTimeout(() => {
    reveal(document)
    ungate(document)
  }, FAILSAFE)

  // Started before anything is waited on. Reading the pull request and parsing
  // GitHub's HTML have nothing to say to each other, and running them one after
  // the other — which is what awaiting the takeover first did — spent the whole
  // of GitHub's page load doing nothing.
  const reading = Effect.runPromise(
    loadPullRequest(reference).pipe(Effect.provide(gatewayLayer))
  ).catch((error: unknown) => {
    reportError(error)
    throw error
  })

  // Started in the same breath, and normally finished long before: one storage
  // read against four requests to GitHub. On any pull request opened before,
  // this is what the reader actually sees.
  const remembered = Effect.runPromise(
    rememberedPullRequest(reference).pipe(Effect.provide(gatewayLayer))
  )

  const fetchDiffs = (paths: ReadonlyArray<string>, head: string) =>
    Effect.runPromise(loadDiffs(reference, head, paths).pipe(Effect.provide(gatewayLayer)))

  const readCommit = (sha: string) =>
    Effect.runPromise(loadCommit(reference, sha).pipe(Effect.provide(gatewayLayer)))

  const readNotes = (check: Check) =>
    Effect.runPromise(loadCheckNotes(reference, check).pipe(Effect.provide(gatewayLayer)))

  const merge = () =>
    Effect.runPromise(mergePullRequest(reference).pipe(Effect.provide(gatewayLayer))).catch(
      (error: unknown) => {
        reportError(error)
        throw error
      }
    )

  // Assigned once there is a page to step aside from. Until then the button
  // that calls it cannot be on the screen, because nothing is.
  let stepAside = (): void => {}

  // Reads false the moment this pull request stops being the one on the screen.
  // The takeover below is waiting on GitHub's parser and can finish long after
  // that, and a takeover that lands for a pull request nobody is looking at
  // puts a stale interface over a live page.
  let watching = true

  const container = interfaceContainer(document)
  const root = createRoot(container)
  root.render(
    <PullRequestScreen
      reference={reference}
      load={() => reading}
      preload={() => remembered}
      fetchDiffs={fetchDiffs}
      onStepAside={() => stepAside()}
      loadCommit={readCommit}
      loadNotes={readNotes}
      actions={{
        merge,
        // Everything on the page describes a pull request that is now merged —
        // the checks, the merge card, GitHub's own header behind ours — and
        // reading it again is both simpler and more honest than patching a
        // snapshot to say so.
        onMerged: () => window.location.reload()
      }}
    />
  )

  void (async () => {
    try {
      const takeover = await takeOverSlotWhenReady(
        document,
        container,
        undefined,
        ahead ? GLANCE : undefined
      )
      if (!watching) return
      if (takeover === null) {
        // The page is GitHub's now. Nothing is going to look at this tree.
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
    // Whatever is on this page next, it is not ours to hide.
    reveal(document)
  }
}

export default defineContentScript({
  // Wider than the interface itself, because GitHub navigates between the tabs
  // without reloading: the script has to already be running when someone comes
  // back to the conversation from Files.
  matches: ["*://github.com/*/*/pull/*"],
  // Their page is server-rendered, so at `document_end` their conversation has
  // already been on the screen for some time and every takeover is visible as a
  // flash. This runs before the parser has produced anything to flash.
  runAt: "document_start",
  main() {
    // Two ways in now: matched against a page loaded on a pull request, or
    // injected by the worker onto one navigated to without a load. Both can
    // happen to the same document — load a pull request, leave it, come back —
    // and the second copy has nothing to add, because the first is still
    // watching. The flag lives on the window shared by everything this
    // extension runs in the page, which is exactly the scope wanted: one
    // interface per document.
    const world = window as typeof window & { githubproOpen?: true }
    if (world.githubproOpen === true) return
    world.githubproOpen = true

    initialiseErrorReporting("content-script")

    let close = (): void => {}
    /** The pull request drawn ahead of the address, if this is one. */
    let promised: string | null = null
    let abandoning: ReturnType<typeof setTimeout> | undefined

    const show = (path: string, ahead = false): void => {
      close()
      close = () => {}
      clearTimeout(abandoning)
      promised = null

      // Only the conversation. Files, Commits and Checks are GitHub's own, and
      // they are good — but the stylesheet is gating them too, because a
      // stylesheet cannot read a URL. Handing those back is the first thing this
      // does, before anything slower has a chance to delay it past a paint.
      //
      // Revealed, but deliberately not ungated. This also runs the instant the
      // worker injects the interface, which can be while GitHub is still on its
      // way to a pull request from somewhere else: the address then says list,
      // and the conversation about to be rendered is precisely the thing the
      // other gate is holding back for us.
      const reference = fromPathname(path)
      if (Option.isNone(reference)) {
        reveal(document)
        return
      }

      close = open(reference.value, ahead)

      if (!ahead) return
      promised = path
      abandoning = setTimeout(() => {
        if (window.location.pathname === path) return
        // The press never became a navigation. Give the reader back the page
        // they are still on.
        close()
        close = () => {}
        promised = null
        ungate(document)
      }, ABANDON)
    }

    whenLocationChanges(window, (path) => {
      // Arriving where the interface already is. Drawing it again would throw
      // away a pull request that is on the screen and correct.
      if (promised === path) {
        promised = null
        clearTimeout(abandoning)
        return
      }
      show(path)
    })

    // What the address says, or — while GitHub is still fetching and the
    // address still names the page being left — what the reader pressed.
    const here = window.location.pathname
    const promise = intendedPath(window)
    forgetIntent(window)

    if (Option.isSome(fromPathname(here))) show(here)
    else if (promise !== null && Option.isSome(fromPathname(promise))) show(promise, true)
    else reveal(document)
  }
})
