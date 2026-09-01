import { Effect, Option } from "effect"
import { useState } from "react"
import type {
  BlockerAbout,
  ChangedFile,
  HeadRef,
  MergeMethod,
  MergeQueue,
  MergeState,
  PullRequestState,
  Review,
  ReviewDecision,
  UpdateWay
} from "../domain/PullRequest"
import { faceOf, type MergeFace } from "../domain/doable"
import { holdingItUp, wouldLand } from "../domain/pressing"
import {
  Ask,
  type Asking,
  type MergeActions,
  type Merging,
  mergeWord,
  type Otherwise,
  Overflow,
  UPDATE_WORD
} from "./Ask"
import type { ArtName } from "./art"
import { useArt } from "./art"
import { changeWord, FileMark } from "./FileHeading"
import { MergeUnread } from "./MergeUnread"
import { reasonFor } from "./refusal"
import { Section } from "./Section"
import { TheStack } from "./TheStack"
import { Who } from "./Who"

/**
 * What each way of landing leaves behind, as a picture.
 *
 * Written here rather than in the menu because the menu is handed the drawing
 * and never the method — see {@link Otherwise}. The pictures are what the ways
 * do: two lines joining, the single commit a squash leaves, the branch a rebase
 * moves. Neither icon set ships a squash or a rebase of its own, so these are
 * the nearest true thing each has rather than GitHub's own drawing.
 */
const LANDS_AS: Record<MergeMethod, ArtName> = {
  MERGE: "merge-commit",
  SQUASH: "squash",
  REBASE: "rebase"
}

/** The same for catching a branch up, which GitHub does two of the three ways. */
const CAUGHT_UP_AS: Record<UpdateWay, ArtName> = {
  MERGE: "merge-commit",
  REBASE: "rebase"
}

/**
 * Merging and closing, in the one place someone looks for them.
 *
 * The buttons are disabled while nothing can act on them rather than hidden:
 * hiding a control makes a reader hunt for it, and a merge button that GitHub
 * would refuse is worse than one that says why it would.
 *
 * Merging asks twice. Not a dialog — a dialog is dismissed without being read —
 * but the same button, saying what it is about to do, so the second press is a
 * decision rather than the end of a double-click.
 */
export const Merge = ({
  merge,
  running = 0,
  url,
  files = [],
  reviews = NONE_GIVEN,
  state,
  headRef = { mayDelete: false, mayRestore: false },
  actions,
  prepareThrough = 4
}: {
  /**
   * What GitHub said about landing this, where GitHub would say.
   *
   * None means the merge box did not answer, and the card wears its unread face —
   * unless the pull request has already landed or been closed, which is decided by
   * the state alone and needs no merge box at all. See `faceOf`.
   */
  readonly merge: Option.Option<MergeState>
  /** Checks that have not finished, which merging now would not wait for. */
  readonly running?: number
  /** This pull request on GitHub, where the queue is joined. */
  readonly url?: string
  /**
   * Every file this pull request changes, for the rows a conflict draws.
   *
   * Read off the same snapshot the card is, rather than asked for: a conflicted
   * path is a changed path, so how it changed and how big it is are already in
   * hand. Defaulted empty, which draws the paths and no metadata — a card handed
   * no files is not a card that should guess at counts.
   */
  readonly files?: ReadonlyArray<ChangedFile>
  /**
   * Everyone who has given a verdict, so the card says whether it has one.
   *
   * None where the merge box did not answer, which the card says rather than draws as
   * an empty list. Defaulted to the empty list and not to None: a card nobody handed
   * reviews to has not been told there are none, and a test that is about a queue
   * should not have to deny knowing about verdicts to make its point.
   */
  readonly reviews?: Option.Option<ReadonlyArray<Review>>
  /**
   * Open, draft, closed or merged.
   *
   * Required, and the fact this card was missing for a long time: without it the
   * card offered to merge, queue and close things that had already landed, since
   * every control read the merge state and none of them asked whether there was
   * still a decision to make.
   */
  readonly state: PullRequestState
  /**
   * What is left to do with the head branch, which is all the settled face has
   * to offer.
   *
   * Defaulted to neither, so a screen that has not read it offers nothing rather
   * than offering to delete a branch it knows nothing about.
   */
  readonly headRef?: HeadRef
  readonly actions?: MergeActions
  /** How many parts a detached route has built so far. */
  readonly prepareThrough?: number
}) => {
  const [merging, setMerging] = useState<Merging>({ step: "idle" })
  const face = faceOf({ state, merge })

  /*
   * The ways the reader picked, and the pull request they picked them on.
   *
   * The address travels with the choice rather than being cleared when the card
   * moves on: this screen stays mounted from one pull request to the next, so a
   * rebase chosen on one would otherwise be waiting on the next, and a pair that
   * says which pull request it belongs to simply stops matching. The same shape
   * the file browser keeps its marked lines in, and for the same reason — an
   * effect that cleared them would run a render after the one it was correcting.
   *
   * Nothing at all until a reader picks, so the card follows GitHub while nobody
   * has disagreed with it: a pull request re-read after a rule changed can come
   * back allowing a different set, and a choice seeded from the old one would go
   * on naming a way this repository no longer takes.
   */
  const [picked, setPicked] = useState<{
    readonly url?: string
    readonly method?: MergeMethod
    readonly way?: UpdateWay
  }>({})
  const mine = picked.url === url ? picked : {}

  const live = face.kind === "live" ? Option.some(face.merge) : Option.none()
  /** The merge method on the button: the reader's, while the repository still allows it. */
  const method = Option.flatMap(live, (said) =>
    mine.method !== undefined && said.methods.includes(mine.method)
      ? Option.some(mine.method)
      : said.method
  )
  const catchUp = Option.flatMap(live, (said) => said.update)
  /** The same for catching the branch up. */
  const way = Option.map(catchUp, (said) =>
    mine.way !== undefined && said.ways.includes(mine.way) ? mine.way : said.how
  )
  /*
   * What this card may ask for, which is the domain's answer plus the branch.
   *
   * The branch is not in `face.can` and must not be: `whatCanBeDone` is about a
   * pull request that can still be acted on, and this is the one press that
   * makes sense precisely because it cannot be.
   */
  const may = new Set<Asking>([
    ...(face.kind === "live" ? face.can : []),
    ...(headRef.mayDelete ? (["deleteBranch"] as const) : [])
  ])

  /**
   * The action a verb stands for, with the merge's own argument bound to it.
   *
   * Nine of the ten take nothing. The merge takes the way this repository
   * merges, which is read here, off the state this card is already drawing the
   * button from — so the label and the write cannot disagree.
   *
   * Absent where no method is known, which is also where the domain refuses the
   * verb, so the two say no together rather than one of them guessing.
   */
  const actionFor = (doing: Asking): (() => Effect.Effect<void, unknown>) | undefined => {
    if (doing === "merge") {
      const merge = actions?.merge
      if (merge === undefined || Option.isNone(method)) return undefined
      return () => merge(method.value)
    }

    if (doing === "update") {
      const update = actions?.update
      if (update === undefined) return undefined
      // A merge where nothing said otherwise, which is the way that always
      // works: this button is drawn on a branch that is behind whether GitHub
      // named a way or not.
      return () => update(Option.getOrElse(way, () => "MERGE" as const))
    }

    return actions?.[doing]
  }

  /*
   * Whether one press lands more than this pull request.
   *
   * What the press lands rather than whether a stack exists: read from the last
   * open layer of a half-landed stack, the press is down to one pull request,
   * and a word saying stack would claim work that went in already.
   */
  const landsStack = Option.match(
    Option.flatMap(live, (said) => said.stack),
    { onNone: () => false, onSome: (stack) => wouldLand(stack).length > 1 }
  )

  /*
   * Whether a merge press here joins the queue rather than landing now.
   *
   * Both halves asked, rather than the queue alone. A queued repository offers
   * this button for one thing — a layer of a stack, which posts `enqueue_stack`
   * and so joins the line by the stack's own route — but that is `whatCanBeDone`'s
   * rule and not this card's to assume. Read from the queue alone, the word would
   * be right only for as long as that rule holds somewhere else, which is how the
   * button came to say "Merge when ready" over a press already sent elsewhere.
   */
  const queued = Option.match(live, {
    onNone: () => false,
    onSome: (said) => Option.isSome(said.queue) && Option.isSome(said.stack)
  })

  /*
   * The other ways each of the two buttons could land, or nothing to offer.
   *
   * Nothing where the repository allows one way in, which is most of them: a
   * caret over a menu of one is a control that looks like a choice and is not.
   */
  const otherMethods = Option.flatMap(live, (said) =>
    said.methods.length > 1 && Option.isSome(method)
      ? Option.some<Otherwise>(
          said.methods.map((one) => ({
            word: mergeWord(one, landsStack),
            art: LANDS_AS[one],
            on: one === method.value,
            pick: () => setPicked({ ...mine, url, method: one })
          }))
        )
      : Option.none()
  )
  const otherWays = Option.flatMap(catchUp, (said) =>
    said.ways.length > 1 && Option.isSome(way)
      ? Option.some<Otherwise>(
          said.ways.map((one) => ({
            word: UPDATE_WORD[one],
            art: CAUGHT_UP_AS[one],
            on: one === way.value,
            pick: () => setPicked({ ...mine, url, way: one })
          }))
        )
      : Option.none()
  )

  const press = (doing: Asking) => {
    const act = actionFor(doing)
    // Refused here as well as greyed out in the button: a keyboard, a stale
    // render or a second window all reach this, and the domain's answer is the
    // one that counts either way.
    if (act === undefined || !may.has(doing)) return
    if (merging.step !== "asking" || merging.doing !== doing) {
      setMerging({ step: "asking", doing })
      return
    }

    setMerging({ step: "working", doing })
    Effect.runFork(
      act().pipe(
        // The page reads itself again on its own: every verb here is wired
        // through `meanwhile`, which shows the change and then confirms it with
        // GitHub. This card only has to say the press landed.
        Effect.map(() => setMerging({ step: "done", doing })),
        Effect.catch((cause) =>
          Effect.sync(() => setMerging({ step: "refused", said: reasonFor(cause) }))
        )
      )
    )
  }

  return (
    <MergeCard
      face={face}
      running={running}
      merging={merging}
      url={url}
      files={files}
      reviews={reviews}
      headRef={headRef}
      may={may}
      actions={actions}
      prepareThrough={prepareThrough}
      press={press}
      method={method}
      landsStack={landsStack}
      queued={queued}
      otherMethods={otherMethods}
      otherWays={otherWays}
      onCancel={() => setMerging({ step: "idle" })}
    />
  )
}

/**
 * What the summary line says on a repository with a queue.
 *
 * The queue outranks everything else that could be said there. "ready to merge"
 * beside a pull request that is third in a line, or that has to be enqueued
 * before anything happens at all, is not a shade of wrong — it is the reader
 * being told they can land it now.
 */
const queueWord = (queue: MergeQueue, armed: boolean): string =>
  queue.waiting
    ? Option.isSome(queue.position)
      ? `waiting in the merge queue, position ${queue.position.value}`
      : "waiting in the merge queue"
    : armed
      ? // Nothing has visibly moved and something has happened: GitHub is
        // holding this and will queue it the moment its requirements pass.
        // Without saying so, the card reads as if the press did nothing.
        "merges when it is ready"
      : "merges through a merge queue"

/** Which section on this page answers a blocker of each kind. */
const SECTION_FOR: Record<BlockerAbout, string> = {
  checks: "Checks",
  conversation: "Conversation"
}

/**
 * Puts the part of the page that answers a blocker in front of the reader.
 *
 * By the section's own label rather than an identifier threaded down through
 * four components: these sections are one column apart, and the label is
 * already there because a screen reader needs it.
 *
 * Searched outward from the button rather than across the document, because
 * GitHub's own page is still underneath this one — hidden, not removed — and
 * it labels its regions the same words. Asked of the document, this found
 * theirs, and scrolling to something with `display: none` is indistinguishable
 * from a button that does nothing. The first ancestor holding a section of
 * that name is ours, since ours are siblings in one column.
 */
const jumpTo = (about: Option.Option<BlockerAbout>, from: Element): void => {
  if (Option.isNone(about)) return

  const wanted = `section[aria-label="${SECTION_FOR[about.value]}"]`
  for (let here = from.parentElement; here !== null; here = here.parentElement) {
    const section = here.querySelector(wanted)
    // Absent in a test environment that stops short of layout. Not worth
    // throwing over: the reader pressed a link, not a control.
    // Instantly, not smoothly. A smooth scroll is an animation some Chromium
    // builds decline to run — it did nothing at all in the one this was tested
    // in — and a jump that silently does not happen is worse than an abrupt
    // one that does.
    if (section !== null) return void section.scrollIntoView?.({ block: "start" })
  }
}

/**
 * The queue's own page, named for what it is.
 *
 * GitHub's page when they gave one — it shows what is ahead of this — and the
 * pull request otherwise, where their own controls live. Nothing at all if
 * neither is known: a link to nowhere is worse than no link.
 */
const QueueLink = ({ queue, url }: { readonly queue: MergeQueue; readonly url?: string }) => {
  const art = useArt()
  const External = art["external"]
  const target = Option.getOrUndefined(queue.url) ?? url
  if (target === undefined) return <>the merge queue</>

  return (
    <a
      href={target}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-link underline"
    >
      the merge queue
      <External size={12} />
    </a>
  )
}

/** What each verdict is called, in GitHub's own words for it. */
const VERDICT_WORD: Record<ReviewDecision, string> = {
  approved: "approved",
  "changes-requested": "requested changes",
  commented: "commented",
  dismissed: "review dismissed"
}

/** A card nobody handed reviews to, which is not a card told there are none. */
const NONE_GIVEN: Option.Option<ReadonlyArray<Review>> = Option.some([])

const VERDICT_TONE: Record<ReviewDecision, string> = {
  approved: "text-pass",
  "changes-requested": "text-fail",
  commented: "text-ink-muted",
  dismissed: "text-ink-muted"
}

/**
 * An objection outranks an approval, and both outrank a remark.
 *
 * One reviewer asking for changes is the fact that decides whether this lands,
 * so it goes first however many approvals are stacked on top of it.
 */
const RANK: Record<ReviewDecision, number> = {
  "changes-requested": 0,
  approved: 1,
  commented: 2,
  dismissed: 3
}

/**
 * Whether anyone has passed judgement, in the card that asks to merge.
 *
 * GitHub has been sending this all along and nothing on this screen showed it,
 * which left "has anyone actually reviewed this" as a question the interface
 * could not answer — asked directly above the button that lands the change.
 */
const Verdicts = ({ reviews }: { readonly reviews: Option.Option<ReadonlyArray<Review>> }) => {
  const art = useArt()
  const Err = art.error
  const Tick = art.tick

  /*
   * Said out loud, where the list at rest draws nothing at all.
   *
   * The two absences are opposite facts and the row is the only place either shows.
   * An empty list is GitHub saying nobody has judged this, and a card asking to merge
   * something nobody has looked at is a card with nothing to add. None is the merge
   * box not answering, and drawing nothing there would be this card reporting an
   * unread pull request as unreviewed — under a merge button.
   */
  if (Option.isNone(reviews)) {
    return (
      <p className="border-b border-line-muted px-3 py-2 text-xs leading-snug text-ink-muted">
        GitHub did not say who has reviewed this.
      </p>
    )
  }

  if (reviews.value.length === 0) return null

  const ordered = [...reviews.value].sort((one, other) => RANK[one.decision] - RANK[other.decision])

  return (
    <ul className="divide-y divide-line-muted border-b border-line-muted">
      {ordered.map((review) => {
        const Art = review.decision === "changes-requested" ? Err : Tick

        return (
          <li
            key={`${review.reviewer.login}:${review.decision}`}
            className="flex items-center gap-2 px-3 py-2 text-xs text-ink-muted"
          >
            <Art size={12} className={`shrink-0 ${VERDICT_TONE[review.decision]}`} />
            <Who
              login={review.reviewer.login}
              src={Option.getOrUndefined(review.reviewer.faceUrl)}
            />
            <span className="font-semibold text-ink">{review.reviewer.login}</span>
            <span>{VERDICT_WORD[review.decision]}</span>
          </li>
        )
      })}
    </ul>
  )
}

/** What a pull request past deciding says, in place of everything below. */
const SETTLED: Record<
  "merged" | "closed",
  { readonly word: string; readonly tone: string; readonly said: string }
> = {
  merged: {
    word: "merged",
    tone: "text-done",
    said: "This one has landed. Nothing on this card is a decision any more."
  },
  closed: {
    word: "closed",
    tone: "text-fail",
    said: "This one ended without landing. GitHub keeps the branch, the comments and the diff, and reopening it is on their own page."
  }
}

/**
 * A pull request past deciding, wearing the one face it can.
 *
 * Split out because the two faces share almost nothing: the whole middle of the
 * live card — blockers to clear, a queue to join, a branch to catch up — is
 * about a decision that has already been made, and the row of controls is about
 * making it. The type the card is handed carries no merge state for a settled
 * one, so this cannot accidentally read any of it.
 */
const Settled = ({
  how,
  reviews,
  headRef,
  merging,
  may,
  actions,
  prepareThrough,
  press,
  onCancel
}: {
  readonly how: "merged" | "closed"
  readonly reviews: Option.Option<ReadonlyArray<Review>>
  readonly headRef: HeadRef
  readonly merging: Merging
  readonly may: ReadonlySet<Asking>
  readonly actions?: MergeActions
  readonly prepareThrough: number
  readonly press: (doing: Asking) => void
  readonly onCancel: () => void
}) => {
  const art = useArt()
  const GitMerge = art["pull-request-merged"]
  const settled = SETTLED[how]
  const went = merging.step === "done" && merging.doing === "deleteBranch"

  return (
    <Section
      name="Merge"
      summary={
        <span className="flex items-center gap-1.5">
          <GitMerge size={12} className={settled.tone} />
          {settled.word}
        </span>
      }
    >
      {/* Kept, unlike everything else: who reviewed it is a fact about the
          reading, and reading is what is left to do with this one. */}
      {prepareThrough >= 1 ? <Verdicts reviews={reviews} /> : null}
      {prepareThrough >= 2 ? (
        <p className="px-3 py-2 text-xs leading-snug text-ink-muted">{settled.said}</p>
      ) : null}
      {/* The one loose end a finished pull request leaves, and the only control
          on this face. GitHub offers the same press on their own page and puts
          the branch back from there, which is why the sentence beside it says
          so: nothing here restores one. */}
      {prepareThrough < 4 ? null : headRef.mayDelete ? (
        <div className="flex flex-col gap-1.5 border-t border-line-muted px-3 py-2">
          <p className="text-xs leading-snug text-ink-muted">
            The branch this was made from is still there. GitHub can put it back
            afterwards, from their own page.
          </p>
          <Ask
            doing="deleteBranch"
            merging={merging}
            can={may}
            actions={actions}
            press={press}
            onCancel={onCancel}
            className="self-start"
          />
        </div>
      ) : went || headRef.mayRestore ? (
        <p className="border-t border-line-muted px-3 py-2 text-xs leading-snug text-ink-muted">
          The branch it was made from has gone.
        </p>
      ) : null}
      {merging.step === "refused" ? (
        <p className="border-t border-line-muted px-3 py-2 text-xs leading-snug text-fail">
          {merging.said}
        </p>
      ) : null}
    </Section>
  )
}

/**
 * The files a conflict is about, with what this page already knows about each.
 *
 * GitHub names the paths and stops there, which left the card saying two paths in
 * a column of prose. Everything else on these rows is out of the pull request's
 * own changed files, already read and already on the screen a column to the left:
 * how the file changed, and how big the change is. That is the difference between
 * a conflict in a lock file nobody reads and one in the file this pull request is
 * actually about, and it was a trip to GitHub's page to find out which.
 *
 * A path GitHub named that is not among the changed files gets its name and
 * nothing else. It happens — a file deleted on the base branch conflicts with a
 * branch that never touched it — and inventing `+0 −0` for it would be this card
 * answering a question it was not told the answer to.
 *
 * The dress is `FileHeading`'s, down to the icon and the pair of boxes the name is
 * split into: the same file over its own diff and on this card has to look like
 * the same file. Plain icons rather than the reader's choice, because the choice
 * is the tree's and reaches neither this card nor the screen this card is on.
 */
const Conflicted = ({
  paths,
  changed
}: {
  readonly paths: ReadonlyArray<string>
  readonly changed: ReadonlyArray<ChangedFile>
}) => (
  <ul className="mt-0.5 flex flex-col overflow-hidden rounded-md bg-canvas">
    {paths.map((path) => {
      const file = changed.find((one) => one.path === path)
      const change = file === undefined ? null : changeWord(file)

      return (
        <li key={path} className="flex items-center gap-2 px-2 py-1">
          <FileMark path={path} icons="plain" />
          {change === null ? null : (
            <span className="shrink-0 rounded-full bg-surface px-1.5 text-xs text-ink-muted">
              {change}
            </span>
          )}
          {file === undefined ? null : (
            <span className="ml-auto shrink-0 text-xs tabular-nums">
              <span className="text-pass">+{file.linesAdded}</span>{" "}
              <span className="text-fail">−{file.linesDeleted}</span>
            </span>
          )}
        </li>
      )
    })}
  </ul>
)

const MergeCard = ({
  face,
  running,
  merging,
  url,
  files,
  reviews,
  headRef,
  may,
  actions,
  prepareThrough,
  press,
  method,
  landsStack,
  queued,
  otherMethods,
  otherWays,
  onCancel
}: {
  readonly face: MergeFace
  readonly running: number
  readonly merging: Merging
  readonly url?: string
  /** This pull request's changed files, for the metadata on a conflicted path. */
  readonly files: ReadonlyArray<ChangedFile>
  readonly reviews: Option.Option<ReadonlyArray<Review>>
  readonly headRef: HeadRef
  /** Everything this card may ask for, the branch included. */
  readonly may: ReadonlySet<Asking>
  readonly actions?: MergeActions
  readonly prepareThrough: number
  readonly press: (doing: Asking) => void
  /**
   * The way the merge button would land this, which is the reader's where they
   * picked one and the repository's where they did not.
   *
   * Read above rather than off the face here, because the choice is a piece of
   * state and this card is the drawing. The two used to be one read of one
   * field, and the field is still what a reader who has not touched the menu
   * gets — see the card above, where the picked one is held.
   */
  readonly method: Option.Option<MergeMethod>
  readonly landsStack: boolean
  /**
   * Whether the merge press joins a queue rather than landing now.
   *
   * True only where the repository has a queue, which after `whatCanBeDone` is
   * only ever a layer of a stack: everything else there is offered the queue's
   * own verb instead. It changes the word on the button and nothing else.
   */
  readonly queued: boolean
  /** The other merge methods, where the repository allows more than one. */
  readonly otherMethods: Option.Option<Otherwise>
  /** The other ways to catch the branch up, where GitHub allows both. */
  readonly otherWays: Option.Option<Otherwise>
  readonly onCancel: () => void
}) => {
  const art = useArt()
  const GitMerge = art["pull-request-merged"]
  const Err = art.error
  const Alert = art["check-failed"]
  const External = art["external"]

  if (face.kind === "settled") {
    return (
      <Settled
        how={face.how}
        reviews={reviews}
        headRef={headRef}
        merging={merging}
        may={may}
        actions={actions}
        prepareThrough={prepareThrough}
        press={press}
        onCancel={onCancel}
      />
    )
  }

  // Third and last, so a pull request that has landed keeps its settled card whether
  // or not the merge box answered — the state that decides that comes off another
  // route. See `faceOf`, which is where the order is argued.
  if (face.kind === "unread") return <MergeUnread />

  const merge = face.merge
  const wiring = {
    merging,
    can: face.can,
    actions,
    press,
    onCancel,
    method,
    landsStack,
    queued
  }
  // A stack makes GitHub's own word for this pull request the wrong answer for
  // the card. Asked about the top of a stack with a draft under it they say
  // MERGEABLE, which is true of the pull request being read and not true of the
  // press: the draft is part of what the press lands, and a draft cannot land.
  const held = Option.match(merge.stack, { onNone: () => [], onSome: holdingItUp })
  const ready = merge.isMergeable && held.length === 0

  return (
    <Section
      name="Merge"
      summary={
        <span className="flex items-center gap-1.5">
          <GitMerge size={12} className={ready ? "text-pass" : "text-ink-muted"} />
          {/* Whether a check is still running is read off the checks, not off
              GitHub's word for mergeable: a repository with required checks
              answers MERGEABLE_IF_STATUSES_PASS even when every one of them has
              already passed, and this said they were running for hours. */}
          {Option.isSome(merge.queue)
            ? queueWord(merge.queue.value, Option.isSome(merge.autoMerge))
            : ready
              ? running > 0
                ? `ready, ${running === 1 ? "one check" : `${running} checks`} still running`
                : "ready to merge"
              : "blocked"}
        </span>
      }
    >
      {/* Above everything, because it changes what everything below it is about.
          Each of the blockers, the reviews and the button is a fact about one
          pull request, and on a layer of a stack the press lands several — so
          the reader is told how many before they read a word of the rest. */}
      {prepareThrough >= 1 && Option.isSome(merge.stack) ? (
        <TheStack stack={merge.stack.value} />
      ) : null}
      {/* Above the blockers: a human saying no is a different kind of fact to a
          rule saying no, and it is the one a reader acts on first. */}
      {prepareThrough >= 1 ? <Verdicts reviews={reviews} /> : null}
      {prepareThrough < 2 || merge.blockers.length === 0 ? null : (
        // One blocker to a row, its reason under its name rather than beside it:
        // these are two full sentences each, and side by side they wrapped into a
        // paragraph nobody could tell apart from the next one.
        <ul className="divide-y divide-line-muted">
          {merge.blockers.map((blocker) => (
            <li key={blocker.name} className="flex items-start gap-2 px-3 py-2">
              <Err size={12} className="mt-1 shrink-0 text-fail" />
              <span className="flex min-w-0 flex-col gap-0.5">
                {/* A blocker with somewhere to go is a link to it. "A
                    conversation must be resolved" is only half an instruction
                    while finding the conversation is the reader's problem. */}
                {Option.isSome(blocker.about) ? (
                  <button
                    type="button"
                    onClick={(pressed) => jumpTo(blocker.about, pressed.currentTarget)}
                    className="text-left text-xs font-semibold text-link underline"
                  >
                    {blocker.name}
                  </button>
                ) : (
                  <span className="text-xs font-semibold">{blocker.name}</span>
                )}
                <span className="text-xs leading-snug text-ink-muted">{blocker.explanation}</span>
                {blocker.files.length === 0 ? null : (
                  <Conflicted paths={blocker.files} changed={files} />
                )}
                {/* Their editor is the only thing that can resolve a conflict from
                    a browser, so a list of files with nowhere to go is half an
                    answer. Offered only where GitHub said it could take them and
                    where somebody said where this pull request is.

                    A tab of its own, and marked as leaving, exactly as the link to
                    their queue is: this extension draws no conflict editor and
                    `placeOwning` claims that address for nobody, so following it
                    in place would spend the reader's page on a screen that does
                    not exist. */}
                {blocker.mayResolve && url !== undefined ? (
                  <a
                    href={`${url}/conflicts`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-link underline"
                  >
                    Resolve them on GitHub
                    <External size={12} />
                  </a>
                ) : null}
                {/* Only where both are true. A rule that may be bypassed is not
                    worth mentioning to someone without the permission, and the
                    permission is not worth mentioning against a rule nobody may
                    go past — either half alone is a promise this cannot keep. */}
                {blocker.bypassable && merge.mayBypass ? (
                  <span className="text-xs leading-snug text-ink-muted">
                    Your permissions let you merge past this one, on GitHub.
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
      {prepareThrough >= 3 && Option.isSome(merge.queue) ? (
        // Said once, plainly, because a queue changes what the button beneath it
        // means: pressing it hands the pull request to GitHub rather than landing
        // it, and a reader who does not know that reads a delay as a failure.
        <p className="flex items-start gap-2 px-3 py-2 text-xs leading-snug text-ink-muted">
          <GitMerge size={12} className="mt-0.5 shrink-0" />
          <span>
            {merge.queue.value.waiting
              ? "GitHub is holding this in its queue and will land it when its turn comes and the checks ahead of it pass. Its place in "
              : "This repository lands pull requests through a queue, which tests each one against whatever is ahead of it and merges it in turn. What is already in "}
            <QueueLink queue={merge.queue.value} url={url} />
            {merge.queue.value.waiting ? " is GitHub's own page." : " is on GitHub's own page."}
          </span>
        </p>
      ) : null}
      {/* The button is on this line rather than down in the row, because this
          line is the whole reason to press it.

          Every blocker above carries its own explanation directly underneath
          it, and this warning follows the same shape — but its answer used to be
          swept into a row of verbs about the pull request's fate, two lines
          away, where a reader looking at the sentence had to find it among
          Convert to draft and Close. An action belongs beside its cause. */}
      {prepareThrough >= 3 && Option.isSome(merge.update) ? (
        <div className="flex items-start gap-2 px-3 py-2 text-xs leading-snug text-ink-muted">
          <Alert size={12} className="mt-0.5 shrink-0 text-warn" />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span>The base branch has moved on since this one left it.</span>
            {/* GitHub's own words for why not. Without them the button is grey
                for a reason the reader has to go to GitHub to find out, which
                is the trip this extension exists to save. */}
            {Option.isSome(merge.update.value.refusal) ? (
              <span>{merge.update.value.refusal.value}</span>
            ) : null}
          </span>
          {prepareThrough >= 4 ? (
            <Ask
              doing="update"
              {...wiring}
              otherwise={Option.getOrUndefined(otherWays)}
              className="shrink-0"
            />
          ) : null}
        </div>
      ) : null}
      {prepareThrough >= 3 && merging.step === "refused" ? (
        <p className="flex items-start gap-2 px-3 py-2 text-xs leading-snug text-fail">
          <Err size={12} className="mt-0.5 shrink-0" />
          {merging.said}
        </p>
      ) : null}
      {/* Wrapping rather than shrinking, and no label allowed to break inside
          itself: this column is four hundred pixels wide, and "Squash and merge"
          split over two lines beside "Close pull request" split over two lines
          was four lines of button and no way to tell which word belonged to
          which. */}
      {/* One line, at every width worth reading a diff in.

          This row held four controls in a four-hundred pixel column, so it
          wrapped — and what wrapped was never chosen: the two that fell to the
          second line were the two nobody presses, and Close ended up stranded in
          a corner of its own by a margin meant for a width this card never has.

          So the row keeps the one act the card exists for, and the rest are
          behind the glyph at the end of it. Catching the branch up is not here
          at all any more; it is beside the sentence that says why to press it. */}
      {prepareThrough >= 4 ? (
        <div className="flex items-center gap-2 px-3 py-2.5">
          {/* One way in, never two. Where a queue exists the direct merge is
              something GitHub refuses, so the domain names the queue verb instead
              and there is one button either way: the paragraph above has already
              said why. */}
          {(() => {
            const doing = Option.getOrElse(face.queueing, () => "merge" as const)
            return (
              <Ask
                doing={doing}
                {...wiring}
                /* Only the direct merge chooses. A repository with a queue is not
                   sent a method at all — joining the line posts its own word —
                   so a caret on that button would offer three answers to a
                   question GitHub is not asking. */
                otherwise={doing === "merge" ? Option.getOrUndefined(otherMethods) : undefined}
              />
            )
          })()}
          {/* Rarest last, and both of them rare: a pull request is drafted or
              closed once in its life, where the button beside them is the reason
              this card is on the screen. */}
          <span className="ml-auto flex shrink-0 items-center">
            <Overflow verbs={[face.drafting, "close"]} {...wiring} />
          </span>
        </div>
      ) : null}
    </Section>
  )
}
