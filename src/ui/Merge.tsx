import {
  AlertFillIcon,
  CheckIcon,
  GitMergeIcon,
  LinkExternalIcon,
  XCircleFillIcon,
  XIcon
} from "@primer/octicons-react"
import { Option } from "effect"
import { useState } from "react"
import type {
  BlockerAbout,
  MergeQueue,
  MergeState,
  PullRequestState,
  Review,
  ReviewDecision
} from "../domain/PullRequest"
import { type Doing, faceOf, type MergeFace } from "../domain/doable"
import { Section } from "./Section"
import { Who } from "./Who"

export type MergeActions = {
  /** Merges it. Rejects with something worth reading when GitHub refuses. */
  readonly merge?: () => Promise<void>
  /** Puts it in the queue, on the repositories that land through one. */
  readonly enqueue?: () => Promise<void>
  /** Takes it back out of the queue it is standing in. */
  readonly dequeue?: () => Promise<void>
  /** Calls off a merge GitHub is holding until this becomes mergeable. */
  readonly cancel?: () => Promise<void>
  /** Catches the branch up with the one it would land on. */
  readonly update?: () => Promise<void>
  /** Called once the merge lands, for whoever wants the page read again. */
  readonly onMerged?: () => void
  /**
   * Called after a write that changed the pull request without ending it.
   *
   * Joining a queue and leaving one both move facts this card cannot work out
   * for itself — a place in the line is GitHub's to know — so the card asks to
   * be told again rather than guessing at the state it just caused.
   */
  readonly onChanged?: () => void
  /**
   * Closes it without merging.
   *
   * Asked for twice, like the merge, and for the same reason: it is the other
   * control here that ends the reading. Nothing is destroyed by it — GitHub
   * keeps the branch, the comments and the diff, and will reopen it — so what
   * the second press agrees to says so.
   */
  readonly close?: () => Promise<void>
  /**
   * Takes it out of draft.
   *
   * The one blocker on this card that is nobody's rule: a draft is a state its
   * author chose and can unchoose, and GitHub's own words for it — the pull
   * request must not be in draft mode — read like a condition being reported
   * rather than a switch being offered.
   */
  readonly markReady?: () => Promise<void>
  /** Puts it back into draft, so the offer above is a door both ways. */
  readonly toDraft?: () => Promise<void>
}

/**
 * Which of the things asked for is in flight.
 *
 * One state machine rather than eight, because they cannot overlap: a pull
 * request being queued is not also being merged, and a second machine would
 * only make that expressible. Which of them may be asked for at all is not this
 * card's to decide — see `whatCanBeDone` in the domain.
 */
type Merging =
  | { readonly step: "idle" }
  | { readonly step: "asking"; readonly doing: Doing }
  | { readonly step: "working"; readonly doing: Doing }
  | { readonly step: "done"; readonly doing: Doing }
  | { readonly step: "refused"; readonly said: string }

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
  reviews = [],
  state,
  actions
}: {
  readonly merge: MergeState
  /** Checks that have not finished, which merging now would not wait for. */
  readonly running?: number
  /** This pull request on GitHub, where the queue is joined. */
  readonly url?: string
  /** Everyone who has given a verdict, so the card says whether it has one. */
  readonly reviews?: ReadonlyArray<Review>
  /**
   * Open, draft, closed or merged.
   *
   * Required, and the fact this card was missing for a long time: without it the
   * card offered to merge, queue and close things that had already landed, since
   * every control read the merge state and none of them asked whether there was
   * still a decision to make.
   */
  readonly state: PullRequestState
  readonly actions?: MergeActions
}) => {
  const [merging, setMerging] = useState<Merging>({ step: "idle" })
  const face = faceOf({ state, merge })

  const press = (doing: Doing) => {
    const act = actions?.[doing]
    // Refused here as well as greyed out in the button: a keyboard, a stale
    // render or a second window all reach this, and the domain's answer is the
    // one that counts either way.
    if (act === undefined || face.kind !== "live" || !face.can.has(doing)) return
    if (merging.step !== "asking" || merging.doing !== doing) {
      setMerging({ step: "asking", doing })
      return
    }

    setMerging({ step: "working", doing })
    act().then(
      () => {
        setMerging({ step: "done", doing })
        // A merge ends the reading; the queue verbs only change what this card
        // has to say, and the page around it stays worth looking at. Closing is
        // in between: the pull request is still there to read, and everything
        // that says whether it is open has just become wrong.
        if (doing === "merge") actions?.onMerged?.()
        else actions?.onChanged?.()
      },
      (cause: unknown) => setMerging({ step: "refused", said: reasonFor(cause) })
    )
  }

  return (
    <MergeCard
      face={face}
      running={running}
      merging={merging}
      url={url}
      reviews={reviews}
      actions={actions}
      press={press}
      onCancel={() => setMerging({ step: "idle" })}
    />
  )
}

/**
 * What GitHub said, out of whatever the failure arrived wrapped in.
 *
 * The gateway's own error carries the sentence from their answer; anything else
 * is a network fault, and saying so plainly beats printing an object.
 */
const reasonFor = (cause: unknown): string => {
  const detail = (cause as { detail?: unknown })?.detail
  if (typeof detail === "string" && detail.length > 0) return detail
  return "GitHub could not be reached."
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
      <LinkExternalIcon size={12} />
    </a>
  )
}

/**
 * What each verb calls itself, at rest, while running, and once it is done.
 *
 * One table for the eight of them, keyed by the domain's own word for what is
 * being asked. Before this, every button carried its three words as three props
 * at the call site, and the queue's three were a second table beside it — so
 * whether a control existed, whether it could be pressed and what it said were
 * decided in three different places for each one.
 */
const WORDS: Record<
  Doing,
  { readonly rest: string; readonly working: string; readonly done: string }
> = {
  merge: { rest: "Squash and merge", working: "Merging…", done: "Merged" },
  enqueue: { rest: "Merge when ready", working: "Joining the queue…", done: "Queued" },
  dequeue: { rest: "Remove from the queue", working: "Removing…", done: "Removed" },
  cancel: { rest: "Cancel merge when ready", working: "Cancelling…", done: "Cancelled" },
  update: { rest: "Update branch", working: "Updating…", done: "Updated" },
  close: { rest: "Close pull request", working: "Closing…", done: "Closed" },
  markReady: {
    rest: "Mark ready for review",
    working: "Marking ready…",
    done: "Ready for review"
  },
  toDraft: { rest: "Convert to draft", working: "Converting…", done: "Draft" }
}

/**
 * How each verb is dressed, at rest and once it is armed.
 *
 * Green for the ones that land a change, red for the ones that end a pull
 * request or take it out of the line, blue for the rest. Never the same pair
 * twice over: a control that looks identical before and after a press has not
 * told anybody that the next one acts.
 */
const TONE: Record<Doing, { readonly rest: string; readonly armed: string }> = {
  merge: {
    rest: "bg-pass-emphasis text-ink-on-emphasis",
    armed: "bg-pass-emphasis text-ink-on-emphasis"
  },
  enqueue: {
    rest: "bg-pass-emphasis text-ink-on-emphasis",
    armed: "bg-pass-emphasis text-ink-on-emphasis"
  },
  dequeue: { rest: "bg-surface text-fail", armed: "bg-fail-emphasis text-ink-on-emphasis" },
  cancel: { rest: "bg-surface text-fail", armed: "bg-fail-emphasis text-ink-on-emphasis" },
  update: { rest: "bg-surface text-ink", armed: "bg-accent-emphasis text-ink-on-emphasis" },
  close: { rest: "bg-surface text-fail", armed: "bg-fail-emphasis text-ink-on-emphasis" },
  markReady: {
    rest: "bg-accent-emphasis text-ink-on-emphasis",
    armed: "bg-accent-emphasis text-ink-on-emphasis"
  },
  toDraft: { rest: "bg-surface text-ink-muted", armed: "bg-accent-emphasis text-ink-on-emphasis" }
}

/** What each verdict is called, in GitHub's own words for it. */
const VERDICT_WORD: Record<ReviewDecision, string> = {
  approved: "approved",
  "changes-requested": "requested changes",
  commented: "commented",
  dismissed: "review dismissed"
}

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
const Verdicts = ({ reviews }: { readonly reviews: ReadonlyArray<Review> }) => {
  if (reviews.length === 0) return null

  const ordered = [...reviews].sort((one, other) => RANK[one.decision] - RANK[other.decision])

  return (
    <ul className="divide-y divide-line-muted border-b border-line-muted">
      {ordered.map((review) => {
        const Art = review.decision === "changes-requested" ? XCircleFillIcon : CheckIcon

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
  reviews
}: {
  readonly how: "merged" | "closed"
  readonly reviews: ReadonlyArray<Review>
}) => {
  const settled = SETTLED[how]

  return (
    <Section
      name="Merge"
      summary={
        <span className="flex items-center gap-1.5">
          <GitMergeIcon size={12} className={settled.tone} />
          {settled.word}
        </span>
      }
    >
      {/* Kept, unlike everything else: who reviewed it is a fact about the
          reading, and reading is what is left to do with this one. */}
      <Verdicts reviews={reviews} />
      <p className="px-3 py-2 text-xs leading-snug text-ink-muted">{settled.said}</p>
    </Section>
  )
}

const MergeCard = ({
  face,
  running,
  merging,
  url,
  reviews,
  actions,
  press,
  onCancel
}: {
  readonly face: MergeFace
  readonly running: number
  readonly merging: Merging
  readonly url?: string
  readonly reviews: ReadonlyArray<Review>
  readonly actions?: MergeActions
  readonly press: (doing: Doing) => void
  readonly onCancel: () => void
}) => {
  if (face.kind === "settled") return <Settled how={face.how} reviews={reviews} />

  const merge = face.merge
  const wiring = { merging, can: face.can, actions, press, onCancel }

  return (
    <Section
      name="Merge"
      summary={
        <span className="flex items-center gap-1.5">
          <GitMergeIcon size={12} className={merge.isMergeable ? "text-pass" : "text-ink-muted"} />
          {/* Whether a check is still running is read off the checks, not off
              GitHub's word for mergeable: a repository with required checks
              answers MERGEABLE_IF_STATUSES_PASS even when every one of them has
              already passed, and this said they were running for hours. */}
          {Option.isSome(merge.queue)
            ? queueWord(merge.queue.value, Option.isSome(merge.autoMerge))
            : merge.isMergeable
              ? running > 0
                ? `ready, ${running === 1 ? "one check" : `${running} checks`} still running`
                : "ready to merge"
              : "blocked"}
        </span>
      }
    >
      {/* Above the blockers: a human saying no is a different kind of fact to a
          rule saying no, and it is the one a reader acts on first. */}
      <Verdicts reviews={reviews} />
      {merge.blockers.length === 0 ? null : (
        // One blocker to a row, its reason under its name rather than beside it:
        // these are two full sentences each, and side by side they wrapped into a
        // paragraph nobody could tell apart from the next one.
        <ul className="divide-y divide-line-muted">
          {merge.blockers.map((blocker) => (
            <li key={blocker.name} className="flex items-start gap-2 px-3 py-2">
              <XCircleFillIcon size={12} className="mt-1 shrink-0 text-fail" />
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
      {Option.isSome(merge.queue) ? (
        // Said once, plainly, because a queue changes what the button beneath it
        // means: pressing it hands the pull request to GitHub rather than landing
        // it, and a reader who does not know that reads a delay as a failure.
        <p className="flex items-start gap-2 px-3 py-2 text-xs leading-snug text-ink-muted">
          <GitMergeIcon size={12} className="mt-0.5 shrink-0" />
          <span>
            {merge.queue.value.waiting
              ? "GitHub is holding this in its queue and will land it when its turn comes and the checks ahead of it pass. Its place in "
              : "This repository lands pull requests through a queue, which tests each one against whatever is ahead of it and merges it in turn. What is already in "}
            <QueueLink queue={merge.queue.value} url={url} />
            {merge.queue.value.waiting ? " is GitHub's own page." : " is on GitHub's own page."}
          </span>
        </p>
      ) : null}
      {Option.isSome(merge.update) ? (
        <p className="flex items-start gap-2 px-3 py-2 text-xs leading-snug text-ink-muted">
          <AlertFillIcon size={12} className="mt-0.5 shrink-0 text-warn" />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span>The base branch has moved on since this one left it.</span>
            {/* GitHub's own words for why not. Without them the button is grey
                for a reason the reader has to go to GitHub to find out, which
                is the trip this extension exists to save. */}
            {Option.isSome(merge.update.value.refusal) ? (
              <span>{merge.update.value.refusal.value}</span>
            ) : null}
          </span>
        </p>
      ) : null}
      {merging.step === "refused" ? (
        <p className="flex items-start gap-2 px-3 py-2 text-xs leading-snug text-fail">
          <XCircleFillIcon size={12} className="mt-0.5 shrink-0" />
          {merging.said}
        </p>
      ) : null}
      {/* Wrapping rather than shrinking, and no label allowed to break inside
          itself: this column is four hundred pixels wide, and "Squash and merge"
          split over two lines beside "Close pull request" split over two lines
          was four lines of button and no way to tell which word belonged to
          which. */}
      <div className="@container flex flex-wrap items-center gap-2 px-3 py-2.5">
        {/* One way in, never two. Where a queue exists the direct merge is
            something GitHub refuses, so the domain names the queue verb instead
            and there is one button either way: the paragraph above has already
            said why, and this column has room for two controls, not three. */}
        <Ask doing={Option.getOrElse(face.queueing, () => "merge" as const)} {...wiring} />
        {/* Shown only while there is catching up to do. Whether it may be pressed
            is the domain's answer; whether the fact exists at all is this one. */}
        {Option.isSome(merge.update) ? <Ask doing="update" {...wiring} /> : null}
        <Ask doing={face.drafting} {...wiring} />
        <Ask
          doing="close"
          {...wiring}
          // Pushed to the far edge, but only while there is an edge to push to.
          // An automatic margin does not stop this row wrapping, it only decides
          // where the wrapped button lands, and what it decided was the far right
          // of a line of its own — a button stranded in the corner under two that
          // start at the left. Below the width that holds them all, it wraps into
          // line with the rest instead.
          className="@[27rem]:ml-auto"
        />
      </div>
    </Section>
  )
}

/**
 * A button that asks before it acts, without becoming somewhere else.
 *
 * The asking used to happen around the button rather than in it: the label grew
 * a "Confirm" in front of it, a Cancel appeared at the end of the row, and a
 * sentence arrived above the whole card. Three changes to read, none of them
 * where the finger already was, for one press.
 *
 * So it splits in place instead. The verb stays exactly where it was and keeps
 * saying what it does, and a cross grows onto its edge as the way out. The
 * accessible names carry what the shape shows a sighted reader — that this press
 * is the one that acts, and that one is the one that does not — because
 * "Convert to draft" said twice would be two buttons nobody could tell apart.
 */
/**
 * What a button says: its verb, unless the thing being done is its own.
 *
 * Every button on this row shares one state machine, and each used to read that
 * machine's step without checking whose it was — so asking to close said
 * "Merging…" on the button beside it.
 */
const labelFor = (merging: Merging, doing: Doing): string => {
  const words = WORDS[doing]
  if (merging.step === "working" && merging.doing === doing) return words.working
  if (merging.step === "done" && merging.doing === doing) return words.done
  return words.rest
}

const Ask = ({
  doing,
  merging,
  can,
  actions,
  press,
  onCancel,
  className = ""
}: {
  /** What this button asks for, which decides its words, its colours and its name. */
  readonly doing: Doing
  readonly merging: Merging
  /**
   * What may be asked of this pull request, from the domain.
   *
   * The whole of why a button is grey, in one answer: past deciding, refused by
   * GitHub, or beyond the reader's permissions. Each button used to work its own
   * out of whichever facts it had to hand, which is how a merged pull request
   * came to be offered a place in the merge queue.
   */
  readonly can: ReadonlySet<Doing>
  readonly actions?: MergeActions
  readonly press: (doing: Doing) => void
  readonly onCancel: () => void
  readonly className?: string
}) => {
  const verb = WORDS[doing].rest
  const label = labelFor(merging, doing)
  const tone = TONE[doing]
  const named = `${verb.charAt(0).toLowerCase()}${verb.slice(1)}`
  const asking = merging.step === "asking" && merging.doing === doing
  // Nothing may be pressed while something else is in flight, and nothing at
  // all where the screen it lives on wired no action to it.
  const busy = merging.step === "working" || merging.step === "done"
  const disabled = !can.has(doing) || actions?.[doing] === undefined || busy
  // Only the verb has a second word to swap to. "Merging…" and "Merged" arrive
  // after the asking is over, and neither is a state anybody can back out of.
  const swapping = label === verb

  return (
    <span className={`t-ask ${className}`} data-asking={asking ? "" : undefined}>
      <button
        type="button"
        disabled={disabled && !asking}
        aria-label={asking ? `Confirm ${named}` : undefined}
        onClick={() => press(doing)}
        className={`t-ask-yes text-xs font-semibold disabled:opacity-50 ${
          asking ? tone.armed : tone.rest
        }`}
      >
        {swapping ? (
          <span className="t-ask-words">
            <span className="t-ask-word" aria-hidden={asking || undefined}>
              {verb}
            </span>
            <span className="t-ask-word" aria-hidden={asking ? undefined : true}>
              Confirm
            </span>
          </span>
        ) : (
          label
        )}
      </button>
      {/* Mounted only while it is wanted, and grown from nothing rather than
          dropped in: the cell it lives in opens from no width at all, so the
          control gains a half instead of the row gaining a button. */}
      {asking ? (
        <span className="t-ask-out">
          <button
            type="button"
            aria-label={`Do not ${named}`}
            onClick={onCancel}
            className="t-ask-no bg-surface text-ink-muted hover:text-ink"
          >
            <XIcon size={12} />
          </button>
        </span>
      ) : null}
    </span>
  )
}

