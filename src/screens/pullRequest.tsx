import { Effect, Fiber, Option } from "effect"
import {
  cancelAutoMerge,
  closePullRequest,
  convertToDraft,
  deleteHeadBranch,
  dequeuePullRequest,
  enqueuePullRequest,
  markReadyForReview,
  loadCheckLog,
  loadCheckSteps,
  loadCheckTail,
  loadCheckNotes,
  loadCommit,
  loadCommitDiffs,
  loadDiffs,
  loadPullRequest,
  makeStack,
  mergePullRequest,
  postRemark,
  postReviewComment,
  rememberedPullRequest,
  replyInThread,
  settleThread,
  submitReview,
  unsettleThread,
  updatePullRequestBranch
} from "@/app/pullRequest"
import { rememberedRepositories } from "@/app/destinations"
import { layerSizes } from "@/app/sizes"
import { uploadFile } from "@/app/attaching"
import { loadSuggesting } from "@/app/suggesting"
import { forgetIntent, intendedPath } from "@/app/intent"
import { answerPressesIn, ourOwnRowsDrawn } from "@/ui/going"
import { isDashboard } from "@/domain/pages"
import type { Check, NewComment } from "@/domain/PullRequest"
import { fromPathname, type PullRequestRef } from "@/domain/PullRequestRef"
import type { Size } from "@/domain/workingSet"
import type { GitHubGateway, Review } from "@/ports/GitHubGateway"
import { initialiseErrorReporting, reportError } from "@/observability/sentry"
import type { View } from "@/domain/Settings"
import { chosenView, rememberView } from "@/app/settings"
import { standAScreen } from "@/shell/screen"
import { liveUpdates, settings, throughGitHub } from "@/shell/supplied"
import { type Loaded, PullRequestScreen } from "@/ui/PullRequestScreen"
import { handBack, markPage, reveal, ungate } from "@/ui/mount"
import { CONVERSATION } from "@/ui/place"
import { whenLocationChanges } from "@/ui/navigation"
import { offerOurPage } from "@/ui/theirTabs"
import "@/ui/styles.css"

/**
 * Every repository the reader has, as the store already knows them.
 *
 * For the palette in the bar. Cache only: a pull request page asking GitHub for the whole list
 * on the chance somebody presses ⌘K would be spending a request a reader never asked for.
 */
const recallRepositories = () => rememberedRepositories().pipe(throughGitHub)

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

const open = (
  reference: PullRequestRef,
  ahead = false,
  onUseGitHub?: () => void,
  /**
   * Whether this extension moved the address itself, so no document is on its
   * way and the surface to stand on is the one our last screen is standing on.
   */
  inPlace = false
): (() => void) => {
  /**
   * A read or a write, reported here and still failed for the caller to see.
   *
   * Every ask on this page ends this way, and each of them used to write the
   * reporting out again: a refusal is something the reader has to be told about
   * where they asked — GitHub's sentence for it is the useful part — and
   * something worth having in the log either way.
   */
  const writing = <A, E>(work: Effect.Effect<A, E, GitHubGateway>) =>
    work.pipe(
      throughGitHub,
      Effect.tapError((error) => Effect.sync(() => reportError(error)))
    )

  const asking = (partly: (loaded: Loaded) => void) =>
    writing(loadPullRequest(reference, partly))

  /*
   * The pull request as its own routes have it, which lands a whole read before
   * the runs behind its failing checks do.
   *
   * Held here as well as reported, because this read starts before the screen
   * exists: the card can be complete by the time React asks, and a stage nobody
   * was there to hear is a card that waits on run pages to draw its checks.
   */
  let sofar: Loaded | undefined
  let tell: ((loaded: Loaded) => void) | undefined

  // Started before anything is waited on. Reading the pull request and parsing
  // GitHub's HTML have nothing to say to each other, and running them one after
  // the other — which is what awaiting the takeover first did — spent the whole
  // of GitHub's page load doing nothing.
  //
  // A running fiber rather than an effect nobody has started: the read has to be
  // in the air while the takeover is being worked out, and joining it later is
  // how anything that needs the answer waits without asking GitHub again.
  const reading = Effect.runFork(
    asking((loaded) => {
      sofar = loaded
      tell?.(loaded)
    })
  )

  // Started in the same breath, and normally finished long before: one storage
  // read against four requests to GitHub. On any pull request opened before,
  // this is what the reader actually sees.
  const remembered = Effect.runFork(
    rememberedPullRequest(reference).pipe(throughGitHub)
  )

  const fetchDiffs = (paths: ReadonlyArray<string>, head: string) =>
    loadDiffs(reference, head, paths).pipe(throughGitHub)

  const readCommit = (sha: string) =>
    loadCommit(reference, sha).pipe(throughGitHub)

  const readCommitDiffs = (sha: string, paths: ReadonlyArray<string>) =>
    loadCommitDiffs(reference, sha, paths).pipe(throughGitHub)

  const readNotes = (check: Check) =>
    loadCheckNotes(reference, check).pipe(throughGitHub)

  // The head commit is what the checks ran against, and what their logs are
  // filed under; it is read from the snapshot rather than from the page, which
  // may have been left open across a push.
  const readLog = (check: Check, step: number) =>
    Effect.gen(function* () {
      const { snapshot } = yield* Fiber.join(reading)
      return yield* loadCheckLog(reference, snapshot.headSha, check, step)
    }).pipe(throughGitHub)

  const readTail = (check: Check, keep: number) =>
    Effect.gen(function* () {
      const { snapshot } = yield* Fiber.join(reading)
      return yield* loadCheckTail(reference, snapshot.headSha, check, keep)
    }).pipe(throughGitHub)

  const readSteps = (check: Check) =>
    loadCheckSteps(reference, check).pipe(throughGitHub)

  // Which of GitHub's two merge routes this press goes to, read off the
  // snapshot the card is showing: a layer of a stack lands through one and
  // everything else through the other, and each refuses the other's pull
  // request with a sentence about the branch being out of date.
  const merge = () =>
    writing(
      Effect.gen(function* () {
        const { snapshot } = yield* Fiber.join(latest)
        return yield* mergePullRequest(reference, Option.isSome(snapshot.merge.stack))
      })
    )
  const enqueue = () => writing(enqueuePullRequest(reference))
  const dequeue = () => writing(dequeuePullRequest(reference))
  const cancel = () => writing(cancelAutoMerge(reference))
  const closeIt = () => writing(closePullRequest(reference))
  const deleteBranch = () => writing(deleteHeadBranch(reference))
  const markReady = () => writing(markReadyForReview(reference))
  const toDraft = () => writing(convertToDraft(reference))

  // How is GitHub's own verdict, read off the snapshot the card is showing:
  // it says which of the two it would use, and a rebase it has already ruled
  // out comes back refused.
  const update = () =>
    writing(
      Effect.gen(function* () {
        const { snapshot } = yield* Fiber.join(latest)
        return yield* updatePullRequestBranch(
          reference,
          Option.isSome(snapshot.merge.update) ? snapshot.merge.update.value.how : "MERGE"
        )
      })
    )

  // The read above was started before this function had anything to render
  // into, so the first ask is given what is already in flight. Every ask after
  // it is somebody saying the pull request has changed, and joining that same
  // finished fiber would answer with the page they are trying to leave.
  let started = false
  // The newest read, for the writes that need to know what they are acting on.
  // Which way a branch is caught up is decided by the pull request as it is
  // now, and after a re-read that is no longer the first read.
  let latest = reading
  const read = (partly: (loaded: Loaded) => void) =>
    Effect.suspend(() => {
      if (!started) {
        started = true
        tell = partly
        if (sofar !== undefined) partly(sofar)
        return Fiber.join(reading)
      }

      latest = Effect.runFork(asking(partly))
      return Fiber.join(latest)
    })

  const postComment = (note: NewComment) => writing(postReviewComment(reference, note))
  const remark = (body: string) => writing(postRemark(reference, body))
  const settle = (threadId: string) => writing(settleThread(reference, threadId))
  const unsettle = (threadId: string) => writing(unsettleThread(reference, threadId))
  /*
   * An answer inside a thread, which comes back as the whole thread. Their route hands back
   * every comment in it, so what was just written is on the screen without another read.
   */
  const reply = (commentId: string, body: string) =>
    writing(replyInThread(reference, commentId, body))
  /*
   * The verdict carries the commit the panel was showing, rather than the newest one: a reader
   * approves what they read, and GitHub records the commit so that the approval cannot be
   * inherited by whatever is pushed next.
   */
  const judge = (review: Review) => writing(submitReview(reference, review))

  // Nothing is read off the snapshot for this one, unlike the merge and the
  // branch update above. What is in the chain is GitHub's answer rather than the
  // card's, and the gateway asks them for it as part of the write.
  const stack = () => writing(makeStack(reference))

  /**
   * How big each of the other layers of that proposal is, said as each lands.
   *
   * Not through `writing`, which reports what it could not do. A count that does
   * not arrive is one number missing from one row of a strip about other pull
   * requests, and the row is on the screen and readable without it — where a
   * report would put a failure in the log for every reader whose network dropped
   * seventy bytes.
   */
  const countLayers = (
    references: ReadonlyArray<PullRequestRef>,
    tell: (number: number, size: Size) => void
  ) => layerSizes(references, tell).pipe(throughGitHub, Effect.catch(() => Effect.void))

  return standAScreen({
    place: CONVERSATION,
    // Their own dashboard is hidden rather than gone, so it is still there to stand in
    // when the reader asks for it — where another pull request would have to stand in a
    // region GitHub has never rendered, and asking them for the document is the honest
    // way to one of those.
    holding: (container) => answerPressesIn(container, window, isDashboard),
    borrowing: inPlace,
    settling: ahead ? GLANCE : undefined,
    draw: (standing) => (
      <PullRequestScreen
        reference={reference}
        load={read}
        recallRepositories={recallRepositories}
        preload={() => Fiber.join(remembered)}
        fetchDiffs={fetchDiffs}
        onStepAside={standing.stepAside}
        onUseGitHub={onUseGitHub}
        loadCommit={readCommit}
        fetchCommitDiffs={readCommitDiffs}
        loadNotes={readNotes}
        loadLog={readLog}
        loadTail={readTail}
        loadSteps={readSteps}
        postComment={postComment}
        postRemark={remark}
        /*
         * Who can be mentioned and what can be referred to, read once when a box opens.
         * Their own suggester, asked for the repository this pull request is in.
         */
        suggest={() => writing(loadSuggesting(reference))}
        /*
         * A screenshot pasted into any box here, put where GitHub keeps them. See
         * `attaching.md` for their three requests.
         */
        onUpload={(file) => writing(uploadFile(reference, file))}
        onSettle={settle}
        onUnsettle={unsettle}
        onReply={reply}
        onReview={judge}
        makeStack={stack}
        layerSizes={countLayers}
        watch={liveUpdates}
        actions={{
          merge,
          enqueue,
          dequeue,
          cancel,
          update,
          close: closeIt,
          markReady,
          toDraft,
          deleteBranch,
          // Everything on the page describes a pull request that is now merged —
          // the checks, the merge card, GitHub's own header behind ours — and
          // reading it again is both simpler and more honest than patching a
          // snapshot to say so.
          onMerged: () => window.location.reload()
        }}
      />
    )
  }).close
}

/**
 * Puts the card in charge of the document, once.
 *
 * Called by the shell, which is on every GitHub page and knows from the address
 * that a pull request is what is wanted. Between pull requests — a stack, a base
 * branch, their own Conversation and Files tabs — this follows the address itself,
 * which is why it is started once and not per pull request.
 */
export const start = (): void => {
  // Before anything else, because the rules that hide GitHub's conversation are
  // written per page and hang on this.
  markPage(document, CONVERSATION)

  initialiseErrorReporting("content-script")

  const store = settings()

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

  function show(path: string, ahead = false, inPlace = false): void {
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
      handBack(document)
      return
    }

    // Their page, because that is what was asked for last time. Nothing is
    // read, nothing is drawn, and the gate comes off at once.
    if (view === "github") {
      handOver()
      return
    }

    close = open(reference.value, ahead, useGitHub, inPlace)

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
    // Asked again here rather than kept from the first arrival: this script
    // outlives every page it draws, and whether a press is ours to answer is a
    // fact about the screen on the page now. A reader back on the Working Set
    // and pressing a second row is this, and it is not the same answer as the
    // one that was true when this script started on a pull request.
    show(path, false, ourOwnRowsDrawn(window))
  })

  // Nothing is drawn until the choice is known, so that a reader who wants
  // GitHub's page is not charged four requests for an interface they have
  // already turned off.
  Effect.runFork(
    chosenView(store).pipe(
      Effect.map((chosen) => {
        view = chosen

        // What the address says, or — while GitHub is still fetching and the
        // address still names the page being left — what the reader pressed.
        const here = window.location.pathname
        const promise = intendedPath(window)
        // Whether the screen being left is one of ours drawing its own rows, in
        // which case this arrival is not waiting on a document and has a surface
        // to stand on already.
        const inPlace = ourOwnRowsDrawn(window)
        forgetIntent(window)

        if (Option.isSome(fromPathname(here))) show(here, false, inPlace)
        /*
         * Drawn on the promise of a press, ahead of the address agreeing — but
         * only where the address is being moved by a document that is on its way.
         *
         * A press this extension answers itself moves the address in the same
         * gesture, milliseconds later, so there is nothing here worth racing. And
         * drawing ahead of it has a failure this does not: where the press is
         * swallowed and no address ever moves — GitHub cancelling it from the top
         * of the document, a drag that was not a press — the card stands over a
         * list at an address that never changed, until it gives up and takes that
         * list down with it. Waiting costs nothing and leaves the reader on the
         * page they were already reading.
         */
        else if (!inPlace && promise !== null && Option.isSome(fromPathname(promise))) {
          show(promise, true, inPlace)
        } else reveal(document)
      })
    )
  )
}
