import { Effect, Option } from "effect"
import type { Uploaded } from "../domain/attaching"
import type { Suggesting } from "../domain/suggesting"
import { useEffect, useMemo } from "react"
import type {
  Check,
  CheckNote,
  CommitDetail,
  JobStep,
  LogLine,
  FetchedDiff,
  NewComment,
  Remark,
  PullRequestSnapshot,
  ReviewThread
} from "../domain/PullRequest"
import { pathOf, type PullRequestRef } from "../domain/PullRequestRef"
import { type Doing, DOINGS, stateAfter } from "../domain/doable"
import { useWaiting } from "./useWaiting"
import { Waiting } from "./Waiting"
import type { MergeActions } from "./Ask"
import { Shell } from "./Shell"
import type { Answering } from "./ThreadView"
import type { Review as Said } from "../ports/GitHubGateway"
import type { Repository } from "../domain/repositories"
import { TheBar } from "./TheBar"
import { useUpdated } from "./useUpdated"
import type { AskLayerSizes } from "./useLayerSizes"
import { useDrawnAt } from "./drawnAt"
import { type Load, useLive } from "./useLive"
import { ReadFailed } from "./ReadFailed"

export type Loaded = {
  readonly snapshot: PullRequestSnapshot
}

export type PullRequestScreenProps = {
  readonly reference: PullRequestRef
  /**
   * The pull request, said as soon as GitHub's own routes answer and again once
   * the runs behind its failing checks have been read.
   *
   * Staged like every list here that lands in pieces: what a failing check's run
   * says about it is a document per run, and holding the card back for those
   * meant the pull request with three failing runs — the one somebody is in a
   * hurry about — drew nothing until all three had answered.
   */
  readonly load: Load<Loaded>
  /**
   * The pull request as it was last time, for the screen to show while
   * {@link load} finds out what it is now. Answers in about as long as a
   * storage read, so on any pull request read before there is nothing to wait
   * for and no loading message to show. Whatever it gives goes the moment the
   * live read answers, either way: a read that failed leaves the failure rather
   * than what was remembered, which is the only age nothing here can bound.
   */
  readonly preload?: () => Effect.Effect<Option.Option<Loaded>>
  /** What this page is called in this document's memory. See {@link useLive}. */
  readonly where?: string
  /** Content for a file the page arrived without, fetched when it is opened. */
  readonly fetchDiffs: (
    paths: ReadonlyArray<string>,
    head: string
  ) => Effect.Effect<ReadonlyArray<FetchedDiff>, unknown>
  /** Restores GitHub's own conversation, which is still on the page behind this. */
  readonly onStepAside: () => void
  /**
   * The same, but meant: hands the page back and remembers that GitHub's is the
   * page to open from now on. Kept apart from {@link onStepAside}, which is
   * what a failure does and must not be read as a preference.
   */
  readonly onUseGitHub?: () => void
  /** Merging and closing, which reach GitHub rather than the page. */
  readonly actions?: MergeActions
  /** Writes a remark on some lines to GitHub. */
  readonly postComment?: (note: NewComment) => Effect.Effect<ReviewThread, unknown>
  /** Writes something about the pull request itself, which hangs on no line. */
  readonly postRemark?: (body: string) => Effect.Effect<Remark, unknown>
  /** Who can be mentioned and what can be referred to, for every box here. See `Writing`. */
  readonly suggest?: () => Effect.Effect<Suggesting, unknown>
  /**
   * A file pasted or dropped into a box here, put where GitHub keeps them.
   *
   * Handed down beside `suggest` and for the same reason: the box is the only thing that knows
   * a file arrived in it. See `attaching.ts`.
   */
  readonly onUpload?: (file: File) => Effect.Effect<Uploaded, unknown>
  /** Marks one thread resolved, which is how a finding leaves the owed panel. */
  readonly onSettle?: (threadId: string) => Effect.Effect<unknown, unknown>
  /** Opens a resolved thread again, which is the other half of resolving one. */
  readonly onUnsettle?: Answering["onUnsettle"]
  /** Answers inside a thread, and says what it holds afterwards. */
  readonly onReply?: Answering["onReply"]
  /** Says what this reader thinks of it, from the panel under the conversation. */
  readonly onReview?: (review: Said) => Effect.Effect<unknown, unknown>
  /** Makes the stack GitHub offers, for the strip above the header. */
  readonly makeStack?: () => Effect.Effect<void, unknown>
  /** Counts the lines of the layers on that strip, one answer at a time. */
  readonly layerSizes?: AskLayerSizes
  /** Reads one commit of the branch, for the panel that shows it on its own. */
  readonly loadCommit?: (sha: string) => Effect.Effect<CommitDetail, unknown>
  /** Content for a file that commit arrived without, fetched when it is opened. */
  readonly fetchCommitDiffs?: (
    sha: string,
    paths: ReadonlyArray<string>
  ) => Effect.Effect<ReadonlyArray<FetchedDiff>, unknown>
  /** Reads what GitHub wrote against a check, for the dialog that shows it. */
  readonly loadNotes?: (check: Check) => Effect.Effect<ReadonlyArray<CheckNote>, unknown>
  /** Reads one step's log, for the note in that dialog that points into it. */
  readonly loadLog?: (check: Check, step: number) => Effect.Effect<ReadonlyArray<LogLine>, unknown>
  /** Reads the end of a check's whole log, for a check no note points into. */
  readonly loadTail?: (check: Check, keep: number) => Effect.Effect<ReadonlyArray<LogLine>, unknown>
  /** Reads the steps a check ran as, which is what its dialog opens as. */
  readonly loadSteps?: (check: Check) => Effect.Effect<ReadonlyArray<JobStep>, unknown>
  /**
   * Holds GitHub's own socket open for the channels a pull request carries,
   * and says when one fires. Returns whatever stops it again.
   *
   * Passed in rather than opened here: a websocket is not something a screen
   * should know how to build, and a test that had to stand one up would be
   * testing the socket instead of the screen.
   */
  readonly watch?: (
    channels: ReadonlyArray<string>,
    onFire: () => void
  ) => () => void
  /**
   * Whether GitHub has anyone signed in, asked only when a read has failed.
   * Overridden in tests; in the browser it is the page's own answer.
   */
  /**
   * The repository list as the last visit to Home left it, for the palette behind ⌘K.
   *
   * Out of the store rather than off the network: this page has no business asking GitHub for a
   * hundred and fifty repositories, and a reader who has never opened Home is offered no search
   * at all rather than made to wait for one.
   */
  readonly recallRepositories?: () => Effect.Effect<Option.Option<ReadonlyArray<Repository>>>
  readonly signedIn?: () => boolean
}


/**
 * Who GitHub thinks is here, read off the page rather than asked for.
 *
 * Their own markup carries it on every page, signed in or out, so this costs
 * nothing and cannot itself fail — which matters, because the only time it is
 * asked is when everything else already has.
 */
const viewerOnPage = (): boolean =>
  (document.querySelector('meta[name="user-login"]')?.getAttribute("content") ?? "") !== ""

const READING = "Reading this pull request…"

const UPDATED = "Pull request updated"

/**
 * The card as it will be, the moment a verb is asked for.
 *
 * Only the state, and only where the verb names one. Everything else on a card
 * that has just changed — the checks against a new head commit, a place in a
 * queue, the branch it would land on — is GitHub's to say, and inventing any of
 * it is how a card comes to disagree with the read arriving behind it.
 *
 * The state is not an invention: `faceOf` reads it and nothing else to decide
 * whether this pull request is still a decision, so a closed one wears the
 * settled face immediately and its controls go with it.
 */
const asDone = (loaded: Loaded, doing: Doing): Loaded =>
  Option.match(stateAfter(doing), {
    onNone: () => loaded,
    onSome: (state) => ({ ...loaded, snapshot: { ...loaded.snapshot, state } })
  })

/**
 * A write, with the read a refusal of it calls for.
 *
 * Every refusal GitHub sends is a fact this screen does not have. The offer to
 * stack has moved, somebody pushed to the branch, a rule started applying — and
 * the card in front of the reader is a picture of the world as it was before any
 * of that. Saying only what GitHub said leaves them the sentence and the same
 * wrong card under it.
 *
 * A write that never reached GitHub is the one exception, because the read that
 * would follow goes over the same wire and fails too, and it fails over a page
 * that is otherwise still worth having. Nothing changed at GitHub either, which
 * is the whole reason there is nothing new to read.
 *
 * The success is somebody else's here: the strip pipes its own, and the merge
 * card's verbs are read again by `meanwhile`.
 */
const alsoOnRefusal = (
  write: Effect.Effect<void, unknown>,
  again: () => void
): Effect.Effect<void, unknown> =>
  write.pipe(
    Effect.tapError((cause) =>
      Effect.sync(() => {
        if ((cause as { reason?: unknown })?.reason !== "unreachable") again()
      })
    )
  )

export const PullRequestScreen = ({
  reference,
  recallRepositories,
  load,
  preload,
  where,
  fetchDiffs,
  onStepAside,
  onUseGitHub,
  actions,
  postComment,
  postRemark,
  suggest,
  onUpload,
  onSettle,
  onUnsettle,
  onReply,
  onReview,
  makeStack,
  layerSizes,
  loadCommit,
  fetchCommitDiffs,
  loadNotes,
  loadLog,
  loadTail,
  loadSteps,
  watch,
  signedIn = viewerOnPage
}: PullRequestScreenProps) => {
  /*
   * The same three states the lists have, from the same hook.
   *
   * What this replaced was a hundred lines saying it again by hand: a race
   * between the memory and the answer, a ref to tell whether the screen is
   * still on the page, and a `visibilitychange` listener. All three are what
   * `useLive` is, and the two it does better than the copy here did — a read
   * that fails keeps the card that is on the screen, and two of our screens in
   * the same second cost one read rather than two.
   *
   * What was remembered does not stand in for an answer, here as everywhere: it
   * is worth showing for the half second before GitHub replies and not worth
   * resting on, because it came out of another session and there is no bound on
   * its age. This card is read to decide whether to merge, and one quietly half
   * an hour out of date answers that wrongly while looking exactly like one that
   * is right.
   */
  const live = useLive(load, preload, where)
  const { read, again, meanwhile } = live
  /*
   * Once the card on the screen is this pull request's, which a refusal is as much
   * as an answer: `ReadFailed` below is drawn for this reference, so the reader is
   * looking at this pull request's page and the press is over. Only `loading` leaves
   * the pull request they came from standing, and that is the one to keep quiet for.
   */
  useDrawnAt(read.status === "loading" ? null : pathOf(reference))
  const waiting = useWaiting(read.status)
  useUpdated(live.catchingUp, read.status === "ready" ? read.value : undefined, UPDATED)

  /**
   * Every verb the shell wired, asked for against a card that has already moved.
   *
   * Five of the nine end in a state the domain can name — closing a pull request
   * is exactly what makes it closed — so the card wears it at once and GitHub is
   * asked behind it. The queue verbs name nothing, because a place in a line and
   * a branch caught up are facts only GitHub has; they go through here all the
   * same, for the read that follows a write of ours either way.
   *
   * Which is what replaced the re-read this screen used to wire by hand: a
   * refusal rolls the card back, and a success refreshes it without anybody
   * having to remember to ask.
   *
   * The rollback alone was not enough. It restores the card GitHub has just
   * disagreed with, which is the picture the refusal was about — so the read of
   * `alsoOnRefusal` goes out behind it, and the reader gets the sentence over a
   * card that has caught up with it.
   */
  const acting = useMemo<MergeActions | undefined>(() => {
    if (actions === undefined) return undefined

    const through = (doing: Doing, act: () => Effect.Effect<void, unknown>) => () =>
      meanwhile((loaded) => asDone(loaded, doing), alsoOnRefusal(act(), again))

    return {
      ...actions,
      ...Object.fromEntries(
        DOINGS.filter((doing) => actions[doing] !== undefined).map((doing) => [
          doing,
          through(doing, actions[doing] as () => Effect.Effect<void, unknown>)
        ])
      )
    }
  }, [actions, meanwhile, again])

  /**
   * The press on the strip above the header, and the read that has to follow it.
   *
   * Not through `meanwhile`, which every verb on the merge card goes through.
   * That one shows a change before GitHub has agreed to it, and there is no
   * change to show here: what the reader gets is a stack with a number in it and
   * a chain on the merge state, neither of which this screen can invent. So the
   * strip says GitHub is being asked, and the answer is the read.
   *
   * The read is the whole of what makes the strip go. It comes back with no
   * proposal — their preview route answers `null` once a stack exists — and with
   * the layers on `merge.stack`, so the header's tree draws the chain that was on
   * the strip a second ago and the strip itself has nothing left to draw.
   *
   * A refusal is read again too, by the rule `alsoOnRefusal` holds for every
   * write on this screen. The commonest refusal here is the offer having moved
   * under the reader — somebody stacked these from another tab — and GitHub
   * answers it by saying to read the pull request again. Declining to do that
   * left the reader holding an instruction and a button that could only fail a
   * second time.
   */
  const stacking = useMemo(
    () =>
      makeStack === undefined
        ? undefined
        : () => alsoOnRefusal(makeStack(), again).pipe(Effect.tap(() => Effect.sync(again))),
    [makeStack, again]
  )

  /*
   * The tokens GitHub's own socket is joined with, which the merge box carries.
   *
   * Undefined where the merge box did not answer, exactly as it is before the first
   * read lands: there is no socket to open, because the thing it would report changes
   * to is not on the screen. The next read that gets a merge box opens it.
   */
  const channels =
    read.status === "ready"
      ? Option.getOrUndefined(Option.map(read.value.snapshot.merge, (said) => said.channels))
      : undefined

  useEffect(() => {
    if (watch === undefined || channels === undefined || channels.length === 0) return

    return watch(channels, again)
    // Joined because the channels themselves are the identity: a re-read that
    // hands back the same tokens must not close and reopen the socket, and one
    // that hands back different tokens must.
  }, [watch, channels?.join(" "), again])

  /*
   * The same card every other screen shows, which this one drew for itself until it
   * was measured against a real failure.
   *
   * `useLive` says what a screen does with a failure and it is this; a copy of the
   * two cases here meant the two written since — an organisation waiting to be
   * signed on to, and GitHub itself being down — reached every list and never
   * reached a pull request. Blocking `/changes` on a live page still drew "something
   * GitHub sends has changed" over a 503 that had been asked three times.
   *
   * The wording is the screen's own, because a pull request is answered as if it
   * were not there where a list is answered as if it were empty, and what is behind
   * this is their conversation rather than a page.
   */
  if (read.status === "failed") {
    return (
      <ReadFailed
        signedOut={!signedIn()}
        what="This pull request"
        why={read.why}
        asIf="this pull request does not exist"
        theirs="conversation"
        onStepAside={onStepAside}
        asideLabel="Show GitHub's conversation"
      />
    )
  }

  return (
    // One wrapper for the wait and for the pull request, holding both in the same
    // two slots throughout. The wait has to be the same element before and after
    // GitHub answers or there is nothing for the dissolve to start from: React
    // would take the resting one off the page and mount a second already faded
    // out, which reads as the wait simply disappearing.
    //
    // Relative for that dissolve, which spends its last four hundred
    // milliseconds lying over the card. The wait comes second so it is painted on
    // top without a stacking order to maintain.
    <div className="relative">
      {/*
       * Ours at the top of the document, theirs hidden by the fact of it. Their repository nav
       * comes with it — this bar carries Code, Issues and Pull requests itself and puts the
       * other six behind the repository's name, read off their own row rather than reproduced.
       */}
      <TheBar
        where={{
          kind: "repository",
          owner: reference.owner,
          repo: reference.repo
        }}
        recall={recallRepositories}
        onStepAside={onUseGitHub}
      />
      {read.status === "ready" ? (
        <Shell
          snapshot={read.value.snapshot}
          fetchDiffs={fetchDiffs}
          actions={acting}
          postComment={postComment}
          postRemark={postRemark}
          suggest={suggest}
          onUpload={onUpload}
          onSettle={onSettle}
          onUnsettle={onUnsettle}
          onReply={onReply}
          onReview={onReview}
          makeStack={stacking}
          layerSizes={layerSizes}
          loadCommit={loadCommit}
          fetchCommitDiffs={fetchCommitDiffs}
          loadNotes={loadNotes}
          loadLog={loadLog}
          loadTail={loadTail}
          loadSteps={loadSteps}
          onUseGitHub={onUseGitHub}
        />
      ) : null}
      {waiting ? (
        <Waiting
          what={READING}
          detail={`${reference.owner}/${reference.repo} #${reference.number}`}
          leaving={read.status === "ready"}
        />
      ) : null}
    </div>
  )
}
