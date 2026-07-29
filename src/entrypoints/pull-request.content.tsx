import { Effect, Option } from "effect"
import { createRoot } from "react-dom/client"
import { defineContentScript } from "wxt/utils/define-content-script"
import {
  cancelAutoMerge,
  closePullRequest,
  convertToDraft,
  dequeuePullRequest,
  enqueuePullRequest,
  markReadyForReview,
  loadCheckLog,
  loadCheckTail,
  loadCheckNotes,
  loadCommit,
  loadCommitDiffs,
  loadDiffs,
  loadPullRequest,
  mergePullRequest,
  postReviewComment,
  rememberedPullRequest,
  updatePullRequestBranch
} from "@/app/pullRequest"
import { forgetIntent, intendedPath } from "@/app/intent"
import type { Check, NewComment } from "@/domain/PullRequest"
import { fromPathname, type PullRequestRef } from "@/domain/PullRequestRef"
import { listen, socketUrl } from "@/github/alive"
import { layer as gatewayLayer } from "@/github/GitHubGateway"
import { initialiseErrorReporting, reportError } from "@/observability/sentry"
import type { View } from "@/settings/Settings"
import { browserSettings, rememberView, type Store } from "@/settings/store"
import { PullRequestScreen } from "@/ui/PullRequestScreen"
import { gate, interfaceContainer, reveal, takeOverSlotWhenReady, ungate } from "@/ui/mount"
import { whenLocationChanges } from "@/ui/navigation"
import { offerOurPage } from "@/ui/theirTabs"
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

/**
 * How long to wait for the stored choice of page before assuming it is ours.
 *
 * The choice has to be read before anything is drawn, because drawing first
 * and retreating on the answer would mean a reader who wants GitHub's page
 * paying four requests to this extension on every pull request they open, for
 * an interface they then never see.
 *
 * A read of extension storage is a few milliseconds, so this number is not a
 * wait anybody experiences: it is what happens if storage never answers at
 * all. Ours is the right thing to assume then — it is what all but a few
 * readers have chosen, and the header has the way out of it.
 */
const CHOICE = 250

const chosenView = (store: Store): Promise<View> =>
  Promise.race([
    store.read().then((settings) => settings.page.view),
    new Promise<View>((wake) => setTimeout(() => wake("ours"), CHOICE))
  ])

const open = (reference: PullRequestRef, ahead = false, onUseGitHub?: () => void): (() => void) => {
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

  const readCommitDiffs = (sha: string, paths: ReadonlyArray<string>) =>
    Effect.runPromise(loadCommitDiffs(reference, sha, paths).pipe(Effect.provide(gatewayLayer)))

  const readNotes = (check: Check) =>
    Effect.runPromise(loadCheckNotes(reference, check).pipe(Effect.provide(gatewayLayer)))

  // The head commit is what the checks ran against, and what their logs are
  // filed under; it is read from the snapshot rather than from the page, which
  // may have been left open across a push.
  const readLog = (check: Check, step: number) =>
    reading.then(({ snapshot }) =>
      Effect.runPromise(
        loadCheckLog(reference, snapshot.headSha, check, step).pipe(Effect.provide(gatewayLayer))
      )
    )

  const readTail = (check: Check, keep: number) =>
    reading.then(({ snapshot }) =>
      Effect.runPromise(
        loadCheckTail(reference, snapshot.headSha, check, keep).pipe(Effect.provide(gatewayLayer))
      )
    )

  const merge = () =>
    Effect.runPromise(mergePullRequest(reference).pipe(Effect.provide(gatewayLayer))).catch(
      (error: unknown) => {
        reportError(error)
        throw error
      }
    )

  const enqueue = () =>
    Effect.runPromise(enqueuePullRequest(reference).pipe(Effect.provide(gatewayLayer))).catch(
      (error: unknown) => {
        reportError(error)
        throw error
      }
    )

  const dequeue = () =>
    Effect.runPromise(dequeuePullRequest(reference).pipe(Effect.provide(gatewayLayer))).catch(
      (error: unknown) => {
        reportError(error)
        throw error
      }
    )

  const cancel = () =>
    Effect.runPromise(cancelAutoMerge(reference).pipe(Effect.provide(gatewayLayer))).catch(
      (error: unknown) => {
        reportError(error)
        throw error
      }
    )

  const closeIt = () =>
    Effect.runPromise(closePullRequest(reference).pipe(Effect.provide(gatewayLayer))).catch(
      (error: unknown) => {
        reportError(error)
        throw error
      }
    )

  const markReady = () =>
    Effect.runPromise(markReadyForReview(reference).pipe(Effect.provide(gatewayLayer))).catch(
      (error: unknown) => {
        reportError(error)
        throw error
      }
    )

  const toDraft = () =>
    Effect.runPromise(convertToDraft(reference).pipe(Effect.provide(gatewayLayer))).catch(
      (error: unknown) => {
        reportError(error)
        throw error
      }
    )

  // How is GitHub's own verdict, read off the snapshot the card is showing:
  // it says which of the two it would use, and a rebase it has already ruled
  // out comes back refused.
  const update = () =>
    latest
      .then(({ snapshot }) =>
        Effect.runPromise(
          updatePullRequestBranch(
            reference,
            Option.isSome(snapshot.merge.update) ? snapshot.merge.update.value.how : "MERGE"
          ).pipe(Effect.provide(gatewayLayer))
        )
      )
      .catch((error: unknown) => {
        reportError(error)
        throw error
      })

  // The read above was started before this function had anything to render
  // into, so the first ask is given what is already in flight. Every ask after
  // it is somebody saying the pull request has changed, and handing them that
  // same settled promise would answer with the page they are trying to leave.
  let started = false
  // The newest answer, for the writes that need to know what they are acting
  // on. Which way a branch is caught up is decided by the pull request as it
  // is now, and after a re-read that is no longer the first read.
  let latest = reading
  const read = () => {
    if (!started) {
      started = true
      return reading
    }

    latest = Effect.runPromise(loadPullRequest(reference).pipe(Effect.provide(gatewayLayer)))
    return latest
  }

  const postComment = (note: NewComment) =>
    Effect.runPromise(postReviewComment(reference, note).pipe(Effect.provide(gatewayLayer))).catch(
      (error: unknown) => {
        reportError(error)
        throw error
      }
    )

  /**
   * Listens on GitHub's own socket for the channels this pull request carries.
   *
   * The socket's address is signed per session and printed in their markup, so
   * a page that has none — signed out, or a GitHub that stopped publishing it
   * — simply is not listened to. Nothing else changes: the pull request is
   * read on arrival and after every write either way.
   */
  const watch = (channels: ReadonlyArray<string>, onFire: () => void) => {
    const url = socketUrl(document)
    if (url === undefined) return () => {}

    return listen({ open: () => new WebSocket(url), channels, onFire })
  }

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
      load={read}
      preload={() => remembered}
      fetchDiffs={fetchDiffs}
      onStepAside={() => stepAside()}
      onUseGitHub={onUseGitHub}
      loadCommit={readCommit}
      fetchCommitDiffs={readCommitDiffs}
      loadNotes={readNotes}
      loadLog={readLog}
      loadTail={readTail}
      postComment={postComment}
      watch={watch}
      actions={{
        merge,
        enqueue,
        dequeue,
        cancel,
        update,
        close: closeIt,
        markReady,
        toDraft,
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

    const store = browserSettings()

    let close = (): void => {}
    /** Takes the way back off GitHub's tab row, when one is on it. */
    let unoffer = (): void => {}
    /** The pull request drawn ahead of the address, if this is one. */
    let promised: string | null = null
    let abandoning: ReturnType<typeof setTimeout> | undefined
    /**
     * Whose page this reader wants. Assumed until storage answers, which it
     * does before the first of these functions is called.
     */
    let view: View = "ours"

    // Declared rather than assigned, because the three of them call each other
    // in a ring — showing a page can hand it over, handing it over leaves the
    // way back, and the way back shows a page — and a ring of consts is a ring
    // of variables used before they exist.

    /**
     * Leaves GitHub to it, putting one control on their own tab row so this is
     * a choice rather than a trapdoor.
     *
     * Not a reload. Their conversation was only ever hidden, so handing it back
     * is lifting two attributes, and a reader who changes their mind twice in a
     * row never waits for the network to agree with them.
     */
    function handOver(): void {
      close()
      close = () => {}
      clearTimeout(abandoning)
      promised = null
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

    /** Pressed in our header: theirs from here on, starting with this one. */
    function useGitHub(): void {
      view = "github"
      void rememberView(store, "github")
      handOver()
    }

    function show(path: string, ahead = false): void {
      close()
      close = () => {}
      unoffer()
      unoffer = () => {}
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

      // Their page, because that is what was asked for last time. Nothing is
      // read, nothing is drawn, and the gate comes off at once.
      if (view === "github") {
        handOver()
        return
      }

      close = open(reference.value, ahead, useGitHub)

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

    // Nothing is drawn until the choice is known, so that a reader who wants
    // GitHub's page is not charged four requests for an interface they have
    // already turned off.
    void chosenView(store).then((chosen) => {
      view = chosen

      // What the address says, or — while GitHub is still fetching and the
      // address still names the page being left — what the reader pressed.
      const here = window.location.pathname
      const promise = intendedPath(window)
      forgetIntent(window)

      if (Option.isSome(fromPathname(here))) show(here)
      else if (promise !== null && Option.isSome(fromPathname(promise))) show(promise, true)
      else reveal(document)
    })
  }
})
