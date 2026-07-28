import {
  AlertFillIcon,
  CheckCircleFillIcon,
  ChevronRightIcon,
  GitMergeIcon,
  LinkExternalIcon,
  XCircleFillIcon
} from "@primer/octicons-react"
import { Option } from "effect"
import { useEffect, useRef, useState } from "react"
import type {
  Check,
  CheckNote,
  Commit,
  MergeQueue,
  MergeState,
  PullRequestSnapshot,
  ReviewThread
} from "../domain/PullRequest"
import { toUrl, type PullRequestRef } from "../domain/PullRequestRef"
import { checkArt } from "./Icon"
import { Markdown } from "./Markdown"
import type { Kept } from "../app/kept"
import { NEAR, useNearby } from "./near"
import { summarise } from "./summarise"
import { ageOf, momentOf } from "./when"
import { Who } from "./Who"

/**
 * A section of the column that says what this pull request is.
 *
 * All four look the same on purpose: a titled box with a line of summary in its
 * header, so the eye runs down one edge rather than learning four layouts.
 */
const Section = ({
  name,
  summary,
  tone = "plain",
  children
}: {
  readonly name: string
  readonly summary?: React.ReactNode
  readonly tone?: "plain" | "bad"
  readonly children: React.ReactNode
}) => (
  <section
    aria-label={name}
    // Never shrunk: these sit in a column that scrolls, and a flex child left
    // to its own devices gives up its height to its neighbours — which is how
    // opening the description squashed CI and the conversation into two bars.
    className={`shrink-0 overflow-hidden rounded-md border ${
      tone === "bad" ? "border-fail" : "border-line"
    }`}
  >
    <div
      className={`flex items-center gap-2 border-b px-3 py-2 ${
        tone === "bad" ? "border-fail bg-fail-muted" : "border-line bg-surface"
      }`}
    >
      <h2 className="text-xs font-semibold">{name}</h2>
      {summary === undefined ? null : (
        <span className="min-w-0 flex-1 truncate text-xs text-ink-muted">{summary}</span>
      )}
    </div>
    {children}
  </section>
)

/**
 * What the Author wrote, kept to a height.
 *
 * A pull request description can be three lines or three hundred, and the
 * second kind pushes everything else in this column off the screen — which is
 * how the page it replaced worked. So it is clipped, faded at the cut, and one
 * click from all of it.
 */
export const Description = ({ html }: { readonly html: string }) => {
  const [whole, setWhole] = useState(false)

  return (
    <Section name="Description">
      <div className="relative">
        {/* Opened it still keeps a ceiling, and scrolls inside it: a long
            description is the reason CI and the conversation used to be a
            thousand pixels below the fold. */}
        <div
          className={`px-3 py-3 ${whole ? "overflow-auto" : "overflow-hidden"}`}
          style={{ maxHeight: whole ? "26rem" : "13rem" }}
        >
          <Markdown html={html} />
        </div>
        {whole ? null : (
          // Over the last of the text rather than under it: the fade is what
          // says the words carry on, and a gap between the two would read as
          // the description simply ending there.
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-12"
            style={{
              background: "linear-gradient(to bottom, transparent, var(--bgColor-default))"
            }}
          />
        )}
      </div>
      <div className="px-3 pb-2">
        <button
          type="button"
          className="text-xs text-ink-accent hover:underline"
          onClick={() => setWhole((open) => !open)}
        >
          {whole ? "Show less" : "Show all of it"}
        </button>
      </div>
    </Section>
  )
}

const failing = (checks: ReadonlyArray<Check>) => checks.filter((check) => check.state === "failed")

const CHECK_TONE: Record<Check["state"], string> = {
  succeeded: "text-pass",
  failed: "text-fail",
  running: "text-attention",
  queued: "text-attention",
  cancelled: "text-ink-muted",
  skipped: "text-ink-muted",
  neutral: "text-ink-muted"
}

const CheckRow = ({ check, onOpen }: { readonly check: Check; readonly onOpen: () => void }) => {
  const Art = checkArt(check.state)

  return (
    <button
      type="button"
      onClick={onOpen}
      {...{ [NEAR]: check.name }}
      className="flex w-full items-baseline gap-2 px-3 py-1.5 text-left hover:bg-hover"
    >
      <Art size={12} className={`shrink-0 translate-y-0.5 ${CHECK_TONE[check.state]}`} />
      <span className="shrink-0 text-xs font-semibold">{check.name}</span>
      <span className="min-w-0 flex-1 truncate text-xs text-ink-muted">{check.summary}</span>
    </button>
  )
}

/**
 * Something being read from GitHub: not here yet, here, or it went wrong.
 *
 * One shape for every panel that waits on a request, so waiting looks the same
 * wherever it happens rather than each place inventing its own three states.
 */
export type Reading<Value> =
  | { readonly step: "loading" }
  | { readonly step: "ready"; readonly value: Value }
  | { readonly step: "failed" }

const NOTE_TONE: Record<CheckNote["level"], string> = {
  failure: "text-fail",
  warning: "text-attention",
  notice: "text-ink-muted"
}

/**
 * What GitHub wrote against the check, in the dialog rather than a tab away.
 *
 * Silent when there is nothing: a check often fails with no annotation at all,
 * and an empty box saying "no annotations" is noise in front of the link that
 * actually helps. Silent too when the reading failed — the link below it is
 * still there, and it is what a reader would have used anyway.
 */
const Notes = ({ notes }: { readonly notes: Reading<ReadonlyArray<CheckNote>> }) => {
  if (notes.step === "loading") {
    return <p className="text-xs text-ink-muted">Reading what GitHub said…</p>
  }
  if (notes.step === "failed" || notes.value.length === 0) return null

  return (
    <ul className="flex flex-col divide-y divide-line-muted overflow-hidden rounded-md border border-line">
      {notes.value.map((note, at) => (
        <li key={`${note.where}:${at}`} className="flex flex-col gap-1 px-3 py-2">
          <span className={`text-xs font-semibold ${NOTE_TONE[note.level]}`}>{note.where}</span>
          {/* Their words, wrapped and monospaced: these are compiler and test
              output, where a broken line break changes what it says. */}
          <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs leading-snug text-ink">
            {note.message}
          </pre>
        </li>
      ))}
    </ul>
  )
}

/**
 * One check, in front of everything else, because a red build is read before it
 * is acted on.
 *
 * Their own account of the failure and a way to the log: GitHub redirects the
 * log itself to storage on another origin, which a page cannot read, so the
 * link goes to the run — which is where anyone reading a stack trace ends up
 * anyway.
 */
const CheckDialog = ({
  check,
  library,
  onClose
}: {
  readonly check: Check
  readonly library?: CheckNotes
  readonly onClose: () => void
}) => {
  const frame = useRef<HTMLDialogElement | null>(null)
  const Art = checkArt(check.state)
  const notes = useReading(library, check.name)

  useEffect(() => {
    // Modal rather than merely visible: it takes the focus, the page behind it
    // goes inert, and Escape closes it without a keydown handler of our own.
    frame.current?.showModal()
  }, [])

  return (
    <dialog
      ref={frame}
      onClose={onClose}
      aria-label={check.name}
      className="w-[40rem] max-w-[90vw] rounded-md border border-line bg-canvas p-0 text-ink backdrop:bg-black/50"
    >
      <div className="flex items-center gap-2 border-b border-line bg-surface px-4 py-2.5">
        <Art size={14} className={`shrink-0 ${CHECK_TONE[check.state]}`} />
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{check.name}</h2>
        <button
          type="button"
          onClick={() => frame.current?.close()}
          className="text-xs text-ink-muted"
        >
          Close
        </button>
      </div>
      <div className="flex flex-col gap-3 px-4 py-3">
        <p className="text-sm text-ink-muted">
          {check.summary === "" ? `${check.state} after ${check.durationSeconds}s` : check.summary}
        </p>
        <Notes notes={notes} />
        <a
          href={check.url}
          target="_blank"
          rel="noreferrer"
          className="flex w-fit items-center gap-1.5 rounded-md bg-surface px-3 py-1.5 text-xs font-semibold text-ink-accent"
        >
          <LinkExternalIcon size={12} />
          Open the full log on GitHub
        </a>
      </div>
    </dialog>
  )
}

/** Everything read from a check page, held so a second look is free. */
export type CheckNotes = Kept<string, ReadonlyArray<CheckNote>>

/**
 * The notes for one check, waited on only when they are not already here.
 *
 * A pointer that passed over the row has usually finished this before the
 * click, in which case there is no waiting at all and no spinner to see.
 */
const useReading = (
  library: CheckNotes | undefined,
  name: string
): Reading<ReadonlyArray<CheckNote>> => {
  const held = library?.held(name)
  const [reading, setReading] = useState<Reading<ReadonlyArray<CheckNote>>>(
    library === undefined
      ? { step: "ready", value: [] }
      : held === undefined
        ? { step: "loading" }
        : { step: "ready", value: held }
  )

  useEffect(() => {
    if (library === undefined) return
    let wanted = true

    library.ask(name).then(
      (value) => {
        if (wanted) setReading({ step: "ready", value })
      },
      () => {
        if (wanted) setReading({ step: "failed" })
      }
    )

    return () => {
      wanted = false
    }
  }, [library, name])

  return reading
}

/**
 * Whether the build is red, said in the first four words.
 *
 * Only the failures are listed. Twenty-nine green checks are worth one line
 * saying they are green; the two red ones are the reason anyone opened this.
 */
export const Checks = ({
  checks,
  library
}: {
  readonly checks: ReadonlyArray<Check>
  /** Reads what GitHub wrote against a check, when anything is wired to. */
  readonly library?: CheckNotes
}) => {
  const [opened, setOpened] = useState<Check | undefined>(undefined)

  // Read on the way past. A red check is nearly always clicked once the eye
  // reaches it, and the reading takes about as long as that decision does.
  const nearby = useNearby<string>({
    onNear: (name) => library?.warm(name),
    enabled: library !== undefined
  })

  const red = failing(checks)
  const rest = checks.filter((check) => check.state !== "failed")
  const passed = rest.filter((check) => check.state === "succeeded").length

  if (checks.length === 0) {
    return (
      <Section name="Checks">
        <p className="px-3 py-2 text-sm text-ink-muted">Nothing has run yet</p>
      </Section>
    )
  }

  const summary =
    red.length === 0 ? (
      <span className="flex items-center gap-1.5">
        <CheckCircleFillIcon size={12} className="text-pass" />
        {`All ${checks.length} ${checks.length === 1 ? "check" : "checks"} passed`}
      </span>
    ) : (
      <span className="flex items-center gap-1.5 text-fail">
        <AlertFillIcon size={12} />
        {`CI is red — ${red.length} of ${checks.length} failing`}
      </span>
    )

  return (
    <Section name="Checks" tone={red.length === 0 ? "plain" : "bad"} summary={summary}>
      <div ref={nearby}>
      {/* Failures open, everything else behind one line: a green check has
          nothing to say, and thirty of them said at once are a wall. */}
      {red.map((check) => (
        <CheckRow key={check.name} check={check} onOpen={() => setOpened(check)} />
      ))}
      {rest.length === 0 ? null : (
        <details className="group border-t border-line-muted first:border-t-0">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-1.5 text-xs text-ink-muted hover:bg-hover [&::-webkit-details-marker]:hidden">
            <ChevronRightIcon
              size={12}
              className="shrink-0 transition-transform duration-150 group-open:rotate-90"
            />
            {passed === rest.length
              ? `${passed} passed`
              : `${passed} passed, ${rest.length - passed} other`}
          </summary>
          {rest.map((check) => (
            <CheckRow key={check.name} check={check} onOpen={() => setOpened(check)} />
          ))}
        </details>
      )}
      </div>
      {opened === undefined ? null : (
        <CheckDialog
          check={opened}
          library={library}
          onClose={() => setOpened(undefined)}
          // A dialog for another check is another reading, and holding the
          // first one's state through the swap would show its notes under the
          // second one's name.
          key={opened.name}
        />
      )}
    </Section>
  )
}

const Thread = ({ thread }: { readonly thread: ReviewThread }) => {
  const [first, ...rest] = thread.comments

  return (
    <details className="group border-b border-line-muted last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 hover:bg-hover [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon
          size={12}
          className="shrink-0 text-ink-muted transition-transform duration-150 group-open:rotate-90"
        />
        <span className="shrink-0 text-xs font-semibold">{first?.author.login}</span>
        <span className="min-w-0 flex-1 truncate text-xs text-ink-muted">
          {summarise(first?.body ?? "")}
        </span>
        <span className="shrink-0 text-xs text-ink-muted tabular-nums">
          {thread.comments.length}
        </span>
      </summary>
      <div className="divide-y divide-line-muted border-t border-line-muted">
        {[first, ...rest].map((comment, index) =>
          comment === undefined ? null : (
            <article key={`${thread.id}:${index}`} className="flex flex-col gap-1.5 px-3 py-2.5">
              <span className="flex items-center gap-2 text-xs text-ink-muted">
                <span className="font-semibold text-ink">{comment.author.login}</span>
                {comment.author.isAutomated ? <span className="Label">bot</span> : null}
                <span>{comment.createdAt.slice(0, 10)}</span>
              </span>
              <Markdown html={comment.html} />
            </article>
          )
        )}
      </div>
    </details>
  )
}

/**
 * Everything anyone said, folded.
 *
 * One line per thread — who spoke and what about — because a pull request with
 * twenty threads is a wall of text otherwise, and the wall was the complaint
 * that started this whole thing.
 */
export const Conversation = ({ threads }: { readonly threads: ReadonlyArray<ReviewThread> }) => (
  <Section name="Conversation" summary={threads.length === 0 ? "nothing said yet" : undefined}>
    {threads.length === 0 ? (
      <></>
    ) : (
      threads.map((thread) => <Thread key={thread.id} thread={thread} />)
    )}
  </Section>
)

/**
 * The count, and how long since the last one.
 *
 * What becomes of them on merge is the merge card's business, not this one's:
 * it depends on the button pressed and on which repository this is, and saying
 * "squashed into one" here was a claim about our own button made in a section
 * that only lists what happened. The age is the part worth reading at a glance
 * — a branch nobody has touched in three weeks is a different thing to review
 * than one still moving.
 */
const howMany = (commits: ReadonlyArray<Commit>): string => {
  if (commits.length === 0) return "none yet"

  const newest = commits.reduce(
    (latest, commit) => (commit.createdAt > latest ? commit.createdAt : latest),
    commits[0]?.createdAt ?? ""
  )
  const age = ageOf(newest)
  if (commits.length === 1) return age === "" ? "one" : `one, ${age}`

  return age === "" ? `${commits.length}` : `${commits.length}, newest ${age}`
}

/**
 * The commits, folded away.
 *
 * Deliberately not a panel. The wall of commits is what this interface exists
 * to take down, and on a branch an agent wrote most of them say "fix lint" —
 * reading them is not how anyone reviews. But nothing else here shows them and
 * GitHub's own tab is hidden, so this is the way back to a sha when a check
 * blames one, and it is closed until then.
 */
export const Commits = ({
  commits,
  repository,
  onOpen,
  onWarm,
  opened
}: {
  readonly commits: ReadonlyArray<Commit>
  readonly repository?: PullRequestRef
  /** Reads this commit in the panel beside, when anything is wired to do that. */
  readonly onOpen?: (sha: string) => void
  /** Called as the pointer nears a row, in time to have read it before the click. */
  readonly onWarm?: (sha: string) => void
  readonly opened?: string
}) => {
  // The pointer on its way down the list has already said which row it is
  // going to reach; reading that commit now is the difference between a click
  // that opens something and a click that starts waiting for it.
  const nearby = useNearby<string>({
    onNear: (sha) => onWarm?.(sha),
    enabled: onWarm !== undefined
  })

  return (
  <Section name="Commits" summary={howMany(commits)}>
    {commits.length === 0 ? (
      <></>
    ) : (
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-1.5 text-xs text-ink-muted hover:bg-hover [&::-webkit-details-marker]:hidden">
          <ChevronRightIcon
            size={12}
            className="shrink-0 transition-transform duration-150 group-open:rotate-90"
          />
          Show them
        </summary>
        {/* Opened, it scrolls inside a ceiling. Thirty-eight of these unfolded
          at full height push merging a thousand pixels down the column, which
          is the wall this section was written to avoid being. */}
        <div
          ref={nearby}
          className="divide-y divide-line-muted overflow-y-auto border-t border-line-muted"
          style={{ maxHeight: "14rem" }}
        >
          {commits.map((commit) => (
            <a
              key={commit.sha}
              // A real link even when it opens beside: the address is worth
              // copying, and a modified click still belongs to GitHub.
              href={
                repository === undefined
                  ? undefined
                  : `https://github.com/${repository.owner}/${repository.repo}/commit/${commit.sha}`
              }
              onClick={
                onOpen === undefined
                  ? undefined
                  : (event) => {
                      if (event.metaKey || event.ctrlKey || event.shiftKey) return
                      event.preventDefault()
                      onOpen(commit.sha)
                    }
              }
              {...{ [NEAR]: commit.sha }}
              aria-current={commit.sha === opened ? "true" : undefined}
              className={`flex items-center gap-2 px-3 py-1.5 hover:bg-hover ${
                commit.sha === opened ? "bg-hover" : ""
              }`}
            >
              <Who login={commit.author} />
              <code className="shrink-0 font-mono text-xs text-ink-muted">
                {commit.abbreviatedSha}
              </code>
              <span className="min-w-0 flex-1 truncate text-xs">{commit.headline}</span>
              <span
                title={momentOf(commit.createdAt)}
                className="shrink-0 text-xs text-ink-muted tabular-nums"
              >
                {ageOf(commit.createdAt)}
              </span>
            </a>
          ))}
        </div>
      </details>
    )}
    </Section>
  )
}

export type MergeActions = {
  /** Merges it. Rejects with something worth reading when GitHub refuses. */
  readonly merge?: () => Promise<void>
  /** Called once the merge lands, for whoever wants the page read again. */
  readonly onMerged?: () => void
  readonly close?: () => void
}

type Merging =
  | { readonly step: "idle" }
  | { readonly step: "asking" }
  | { readonly step: "working" }
  | { readonly step: "merged" }
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
  base,
  commits = 0,
  running = 0,
  url,
  actions
}: {
  readonly merge: MergeState
  /** The branch this would land on, named rather than called "the base branch". */
  readonly base?: string
  /** How many commits the squash would flatten into one. */
  readonly commits?: number
  /** Checks that have not finished, which merging now would not wait for. */
  readonly running?: number
  /** This pull request on GitHub, where the queue is joined. */
  readonly url?: string
  readonly actions?: MergeActions
}) => {
  const [merging, setMerging] = useState<Merging>({ step: "idle" })

  const press = () => {
    if (actions?.merge === undefined) return
    if (merging.step !== "asking") {
      setMerging({ step: "asking" })
      return
    }

    setMerging({ step: "working" })
    actions.merge().then(
      () => {
        setMerging({ step: "merged" })
        actions.onMerged?.()
      },
      (cause: unknown) => setMerging({ step: "refused", said: reasonFor(cause) })
    )
  }

  return (
    <MergeCard
      merge={merge}
      about={whatHappens({ base, commits, running })}
      running={running}
      merging={merging}
      url={url}
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
 * The sentence the second press is agreeing to.
 *
 * Named branch and counted commits, because "this squashes the branch into the
 * base branch" describes every squash merge ever made and so tells the reader
 * nothing about theirs. The checks clause appears only when a check is actually
 * unfinished — a warning that is always there stops being read.
 */
export const whatHappens = ({
  base,
  commits,
  running
}: {
  readonly base?: string
  readonly commits: number
  readonly running: number
}): string => {
  const onto = base === undefined || base === "" ? "the base branch" : base
  const landing =
    commits === 1
      ? `Adds this branch's one commit to ${onto}.`
      : commits > 1
        ? `Combines ${commits} commits into one and adds it to ${onto}.`
        : `Squashes this branch into ${onto}.`
  const waiting =
    running === 0
      ? ""
      : running === 1
        ? " One check has not finished, and merging now does not wait for it."
        : ` ${running} checks have not finished, and merging now does not wait for them.`

  return `${landing} Undoing it means opening a revert on GitHub.${waiting}`
}

/**
 * What the summary line says on a repository with a queue.
 *
 * The queue outranks everything else that could be said there. "ready to merge"
 * beside a pull request that is third in a line, or that has to be enqueued
 * before anything happens at all, is not a shade of wrong — it is the reader
 * being told they can land it now.
 */
const queueWord = (queue: MergeQueue): string =>
  queue.waiting
    ? Option.isSome(queue.position)
      ? `waiting in the merge queue, position ${queue.position.value}`
      : "waiting in the merge queue"
    : "merges through a merge queue"

/**
 * The way into the queue, which is GitHub's page.
 *
 * The queue's own page when GitHub gave one — it shows what is ahead of this —
 * and the pull request otherwise, where their button lives. Nothing at all if
 * neither is known: a link to nowhere is worse than no link.
 */
const QueueAction = ({
  queue,
  url
}: {
  readonly queue: MergeQueue
  readonly url?: string
}) => {
  const target = Option.getOrUndefined(queue.url) ?? url
  if (target === undefined) return null

  return (
    <a
      href={target}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-1.5 whitespace-nowrap rounded-md bg-pass-emphasis px-3 py-1.5 text-xs font-semibold text-ink-on-emphasis"
    >
      {queue.waiting ? "See it in the queue" : "Merge when ready"}
      <LinkExternalIcon size={12} />
    </a>
  )
}

const MergeCard = ({
  merge,
  about,
  running,
  merging,
  url,
  actions,
  press,
  onCancel
}: {
  readonly merge: MergeState
  readonly about: string
  readonly running: number
  readonly merging: Merging
  readonly url?: string
  readonly actions?: MergeActions
  readonly press: () => void
  readonly onCancel: () => void
}) => (
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
          ? queueWord(merge.queue.value)
          : merge.isMergeable
            ? running > 0
              ? `ready, ${running === 1 ? "one check" : `${running} checks`} still running`
              : "ready to merge"
            : "blocked"}
      </span>
    }
  >
    {merge.blockers.length === 0 ? null : (
      // One blocker to a row, its reason under its name rather than beside it:
      // these are two full sentences each, and side by side they wrapped into a
      // paragraph nobody could tell apart from the next one.
      <ul className="divide-y divide-line-muted">
        {merge.blockers.map((blocker) => (
          <li key={blocker.name} className="flex items-start gap-2 px-3 py-2">
            <XCircleFillIcon size={12} className="mt-1 shrink-0 text-fail" />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-xs font-semibold">{blocker.name}</span>
              <span className="text-xs leading-snug text-ink-muted">{blocker.explanation}</span>
            </span>
          </li>
        ))}
      </ul>
    )}
    {Option.isSome(merge.queue) ? (
      // Said in full, once, because a queue is the part of merging that people
      // get wrong: the button they are used to pressing is the one thing they
      // must not press, and "disabled" without a reason reads as our fault.
      <p className="flex items-start gap-2 px-3 py-2 text-xs leading-snug text-ink-muted">
        <GitMergeIcon size={12} className="mt-0.5 shrink-0" />
        {merge.queue.value.waiting
          ? "GitHub is holding this in its queue and will land it when its turn comes and the checks ahead of it pass. Merging from here would go around that, so it is not offered."
          : "This repository lands pull requests through a queue: GitHub tests each one against whatever is ahead of it and merges it in turn. Merging from here would go around that, so it is not offered."}
      </p>
    ) : null}
    {merging.step === "refused" ? (
      <p className="flex items-start gap-2 px-3 py-2 text-xs leading-snug text-fail">
        <XCircleFillIcon size={12} className="mt-0.5 shrink-0" />
        {merging.said}
      </p>
    ) : null}
    {merging.step === "asking" ? (
      <p className="px-3 py-2 text-xs leading-snug text-ink-muted">{about}</p>
    ) : null}
    {/* Wrapping rather than shrinking, and no label allowed to break inside
        itself: this column is four hundred pixels wide, and "Squash and merge"
        split over two lines beside "Close pull request" split over two lines
        was four lines of button and no way to tell which word belonged to
        which. */}
    <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
      {/* The queue's own action stays GitHub's. Joining a queue is a write we
          have not recorded their request for, and guessing at one would either
          fail or merge something the wrong way round. */}
      {Option.isSome(merge.queue) ? <QueueAction queue={merge.queue.value} url={url} /> : null}
      {/* Absent, not disabled, where a queue exists. The paragraph above has
          just explained that merging from here would go around the queue, so a
          greyed-out button repeating it is a third control in a row that only
          has room for two. */}
      {Option.isNone(merge.queue) ? (
        <button
          type="button"
          disabled={
            !merge.isMergeable ||
            actions?.merge === undefined ||
            merging.step === "working" ||
            merging.step === "merged"
          }
          onClick={press}
          className="whitespace-nowrap rounded-md bg-pass-emphasis px-3 py-1.5 text-xs font-semibold text-ink-on-emphasis disabled:opacity-50"
        >
          {merging.step === "asking"
            ? "Confirm squash and merge"
            : merging.step === "working"
              ? "Merging…"
              : merging.step === "merged"
                ? "Merged"
                : "Squash and merge"}
        </button>
      ) : null}
      {merging.step === "asking" ? (
        <button
          type="button"
          onClick={onCancel}
          className="whitespace-nowrap rounded-md bg-surface px-3 py-1.5 text-xs font-semibold text-ink-muted"
        >
          Cancel
        </button>
      ) : (
        <button
          type="button"
          disabled={actions?.close === undefined}
          onClick={actions?.close}
          // Pushed to the far edge: the destructive one should not sit a
          // thumb's width from the one that lands the change.
          className="ml-auto whitespace-nowrap rounded-md bg-surface px-3 py-1.5 text-xs font-semibold text-fail disabled:opacity-50"
        >
          Close pull request
        </button>
      )}
    </div>
  </Section>
)

/** Checks that have not reached a verdict yet. */
const stillRunning = (checks: ReadonlyArray<Check>): number =>
  checks.filter((check) => check.state === "running" || check.state === "queued").length

/**
 * The column that answers "what is this pull request, and can it land".
 */
export const About = ({
  snapshot,
  actions,
  onOpenCommit,
  onWarmCommit,
  openedCommit,
  notes
}: {
  readonly snapshot: PullRequestSnapshot
  readonly actions?: MergeActions
  readonly onOpenCommit?: (sha: string) => void
  readonly onWarmCommit?: (sha: string) => void
  readonly openedCommit?: string
  readonly notes?: CheckNotes
}) => (
  <div className="flex w-[26rem] shrink-0 flex-col gap-1.5 overflow-y-auto overflow-x-hidden pr-1">
    <Description html={snapshot.description.html} />
    <Checks checks={snapshot.checks} library={notes} />
    <Conversation threads={snapshot.threads} />
    <Commits
      commits={snapshot.commits}
      repository={snapshot.reference}
      onOpen={onOpenCommit}
      onWarm={onWarmCommit}
      opened={openedCommit}
    />
    <Merge
      merge={snapshot.merge}
      base={snapshot.baseBranch}
      commits={snapshot.commits.length}
      running={stillRunning(snapshot.checks)}
      url={toUrl(snapshot.reference)}
      actions={actions}
    />
  </div>
)
