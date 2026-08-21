import { Effect, Option } from "effect"
import { useMemo, useState } from "react"
import { type AttentionItem, attentionIn, docketsIn } from "../domain/attention"
import type { PullRequestSnapshot, ReviewThread } from "../domain/PullRequest"
import type { Court } from "../domain/workingSet"
import { useArt } from "./art"
import { courtArt, COURT_NAME } from "./courts"
import { CHECK_TONE, checkArt } from "./Icon"
import { Section } from "./Section"

export type ControlCenterProps = {
  readonly snapshot: PullRequestSnapshot
  /**
   * Opens a file in the pane beside this one, at a line.
   *
   * The same signature the failing logs reach the diff by, so this hands over
   * that function rather than a wrapper around it.
   *
   * A row is only a way in where there is something to go to. A check and a
   * branch have no file behind them, so those rows are text: a button that
   * lands nowhere is worse than no button, and a column where three rows in
   * five are pressable teaches the reader nothing about which.
   */
  readonly onOpen?: (path: string, line: number) => void
  /**
   * Opens one commit in the pane beside this one, the way the commit list does.
   *
   * The delta row needs it. "2 commits since you last reviewed" leaves the
   * reader's next question — which two — unanswered, and it was the one row in
   * Needs You that went nowhere while every thread beside it opened its line.
   */
  readonly onOpenCommit?: (sha: string) => void
  /**
   * Marks one thread resolved, which is the act that ends a finding.
   *
   * Here rather than on GitHub's page because the panel now says a finding the
   * reader answered is theirs, and a list of things that are yours with no way
   * to do any of them is a list that sends the reader somewhere else. Absent
   * where nobody handed one down, and the rows are then read-only.
   */
  readonly onSettle?: (threadId: string) => Effect.Effect<unknown, unknown>
}

/**
 * What pressing a row does, where pressing it does anything.
 *
 * A thread goes to the line it hangs off, which is the whole of what makes a
 * remark about code readable: "this breaks on empty input" is a sentence
 * somebody has to go hunting for otherwise. The delta goes to the oldest commit
 * the reader has not seen, which is where picking the reading back up starts.
 *
 * Everything else is text. A check, a branch and a rewritten anchor have nowhere
 * to go — the commit a rewritten review pointed at is the one thing that is
 * gone — and a button that lands nowhere is worse than no button.
 */
const pressOf = (
  item: AttentionItem,
  onOpen?: (path: string, line: number) => void,
  onOpenCommit?: (sha: string) => void
): (() => void) | undefined => {
  if (item.kind === "since") {
    const first = item.landed[0]
    if (first === undefined || onOpenCommit === undefined) return undefined
    return () => onOpenCommit(first.sha)
  }

  if (item.kind !== "thread" && item.kind !== "finding") return undefined

  const at = Option.getOrUndefined(item.thread.at)
  if (at === undefined || onOpen === undefined) return undefined
  return () => onOpen(at.path, at.line)
}

/**
 * The first line of what was said, which is as much as a row has room for.
 *
 * The body is Markdown, and this is the one place it is shown as text, so the
 * marks that would have been drawn come off rather than being read out. Two
 * kinds, both found on a live panel: the comment a machine keeps its bookkeeping
 * in, which Devin opens every finding with and which made seven rows read as
 * JSON, and the emphasis around a finding's headline, which made the eighth read
 * as `**Envelope has no counterpart**`.
 */
/**
 * The comment a row speaks with, which is the party its Court is about.
 *
 * The last word said, except on a finding the reader has already answered. Their
 * own answer is the half of the thread they wrote, and the row has one line to
 * spend. Found on
 * `octo-org/octo-repo#1787`: two findings Devin opened and the reader
 * answered drew a bot glyph, the reader's own login against it, and the reader's
 * own reply as the sentence. Three statements, none of them about Devin.
 *
 * The reader's reply is not lost by leaving it out. That they answered is what
 * put the row under Running in the first place, so the Court says it, and the
 * finding is the half of the thread they did not write.
 */
const spokenIn = (item: AttentionItem): ReviewThread["comments"][number] | undefined => {
  if (item.kind !== "thread" && item.kind !== "finding") return undefined

  return item.kind === "finding" && item.answered
    ? item.thread.comments[0]
    : item.thread.comments.at(-1)
}

const gistOf = (item: AttentionItem): string =>
  spokenIn(item)
    ?.body.replace(/<!--[\s\S]*?-->/g, "")
    .split("\n")
    .find((line) => line.trim() !== "")
    ?.replace(/\*\*|__|`/g, "")
    .trim() ?? ""

const Said = ({
  item,
  baseBranch
}: {
  readonly item: AttentionItem
  readonly baseBranch: string
}) => {
  const art = useArt()

  if (item.kind === "since") {
    const Mark = art.diff
    const count = item.landed.length

    return (
      <>
        <Mark size={14} aria-hidden="true" className="shrink-0 text-ink-muted" />
        <span className="shrink-0 text-xs font-semibold">
          {count} {count === 1 ? "commit" : "commits"}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-ink-muted">
          since you last reviewed
        </span>
      </>
    )
  }

  if (item.kind === "rewritten") {
    const Mark = art.error

    return (
      <>
        <Mark size={14} aria-hidden="true" className="shrink-0 text-warn" />
        <span className="shrink-0 text-xs font-semibold">Rewritten</span>
        <span className="min-w-0 flex-1 truncate text-xs text-ink-muted">
          the branch was rebased since you reviewed
        </span>
      </>
    )
  }

  if (item.kind === "check") {
    const Mark = checkArt(art, item.check.state)

    return (
      <>
        <Mark size={14} aria-hidden="true" className={`shrink-0 ${CHECK_TONE[item.check.state]}`} />
        <span className="shrink-0 text-xs font-semibold">{item.check.name}</span>
        <span className="min-w-0 flex-1 truncate text-xs text-ink-muted">{item.check.summary}</span>
      </>
    )
  }

  if (item.kind === "misbased") {
    const Mark = art["stacked-on"]

    return (
      <>
        <Mark size={14} aria-hidden="true" className="shrink-0 text-warn" />
        <span className="min-w-0 flex-1 truncate text-xs">
          {/* The branch, not "the base": the reader has to recognise which dead
              layer this is stacked on to know what the diff is showing them. */}
          Stacked on {item.foundation.headBranch}, which is closed
        </span>
        <span className="min-w-0 truncate text-xs text-ink-muted">
          the diff below is not this change
        </span>
      </>
    )
  }

  if (item.kind === "branch") {
    const Mark = art["stacked-on"]

    return (
      <>
        <Mark size={14} aria-hidden="true" className="shrink-0 text-ink-muted" />
        <span className="min-w-0 flex-1 truncate text-xs">
          {/* Named rather than called "the base": a reader with three branches in
              flight is owed the one this would take. */}
          Behind {baseBranch}
        </span>
        {Option.match(item.update.refusal, {
          onNone: () => null,
          onSome: (why) => <span className="min-w-0 truncate text-xs text-ink-muted">{why}</span>
        })}
      </>
    )
  }

  // Whoever the row speaks with, so the glyph and the name are one statement. The
  // glyph used to ask whether a machine opened the thread while the name asked who
  // spoke last, which on an answered finding drew a robot against the reader's own
  // login, four pixels apart, with nothing to say they were about two people.
  const spoke = spokenIn(item)?.author ?? item.lastSaid
  const Mark = art[spoke.isAutomated ? "bot" : "comment"]
  /*
   * A machine's login is left off a finding, because the glyph and the chip beside
   * it have already said a machine found this and the sentence has not yet said
   * what it found. `devin-ai-integration[bot]` is 25 characters in a column 290
   * wide, which truncated the finding at about 30 on `octo-repo#1787`: three ways of
   * saying "a bot", and the one that took the width said the least.
   *
   * A person's login stays, on a finding as much as on a thread. There it is the
   * whole point — which colleague is waiting — and it is short.
   */
  const named = item.kind !== "finding" || !spoke.isAutomated

  return (
    <>
      <Mark size={14} aria-hidden="true" className="shrink-0 text-ink-muted" />
      {named ? <span className="shrink-0 text-xs font-semibold">{spoke.login}</span> : null}
      {/* What the row is, since the glyph that says it is hidden from a reader
          being read to. It says "finding" rather than "bot" because the name it
          sits beside is not always the machine's: a colleague who answered a
          finding was being called a machine by a chip that said "bot". */}
      {item.kind === "finding" ? <span className="Label shrink-0">finding</span> : null}
      <span className="min-w-0 flex-1 truncate text-xs text-ink-muted">{gistOf(item)}</span>
    </>
  )
}

const Row = ({
  item,
  baseBranch,
  onOpen,
  onOpenCommit,
  onSettle,
  settling
}: {
  readonly item: AttentionItem
  readonly baseBranch: string
  readonly onOpen?: (path: string, line: number) => void
  readonly onOpenCommit?: (sha: string) => void
  /** Marks this row's thread resolved, on the rows where that is the move. */
  readonly onSettle?: (threadId: string) => void
  readonly settling: boolean
}) => {
  const art = useArt()
  const Tick = art.tick
  const said = <Said item={item} baseBranch={baseBranch} />
  const press = pressOf(item, onOpen, onOpenCommit)
  const inside = "flex w-full items-center gap-2 px-3 py-1 text-left"
  /*
   * Only a finding, and only where somebody handed the panel a way to do it.
   * Resolving is how a finding ends — a person closed 50 of the 67 answered ones
   * counted on `octo-repo` — where closing a colleague's thread instead of replying to
   * it is not an answer to anything. A tick rather than the word, because the
   * word costs the row a third of the sentence it is there to show.
   */
  const settle =
    onSettle === undefined || item.kind !== "finding"
      ? undefined
      : () => onSettle(item.thread.id)

  return (
    <li className="flex items-center">
      {press === undefined ? (
        <span className={`${inside} min-w-0 flex-1`}>{said}</span>
      ) : (
        <button
          type="button"
          className={`${inside} min-w-0 flex-1 hover:bg-hover`}
          onClick={press}
        >
          {said}
        </button>
      )}
      {settle === undefined ? null : (
        <button
          type="button"
          aria-label="Resolve"
          title="Resolve"
          disabled={settling}
          onClick={settle}
          className="mr-2 shrink-0 rounded p-1 text-ink-muted hover:bg-hover hover:text-pass disabled:opacity-50"
        >
          <Tick size={12} />
        </button>
      )}
    </li>
  )
}

/**
 * One pull request filed by who owes the next move, above the same pull request
 * filed by what things are.
 *
 * GitHub's page answers "what is on this pull request" — a description, some
 * checks, a conversation, some commits, a merge button — and the panels below
 * this one answer it in the same order, because it is a good order for reading
 * one. It is a bad order for finding out what is left. A reviewer arriving at a
 * pull request with three unanswered threads, a red check, four commits landed
 * since they were last here and a branch a fortnight behind reads five sections
 * to assemble a list nine items long, and assembles it again on the next visit.
 *
 * The same four Courts the Working Set sorts pull requests into, applied to the
 * pieces of one. It is the list the reader was assembling by hand, and the
 * arithmetic is the domain's: this draws what `attentionIn` returns.
 *
 * Above the panels rather than instead of them. Nothing here replaces reading
 * the diff or the conversation, and a reader who wants the description still
 * has it one panel down.
 */
export const ControlCenter = ({
  snapshot,
  onOpen,
  onOpenCommit,
  onSettle
}: ControlCenterProps) => {
  const art = useArt()
  /*
   * The threads this panel has settled since the page was read.
   *
   * Held here and folded into the snapshot rather than hidden from the list: a
   * settled thread is a resolved thread, and a resolved thread is Settled, so
   * the row moves to the Court it belongs in instead of vanishing. That is what
   * the next read of the pull request will say, arrived at a second early.
   */
  const [settled, setSettled] = useState<ReadonlySet<string>>(() => new Set<string>())
  const [settling, setSettling] = useState<ReadonlySet<string>>(() => new Set<string>())

  const press = (threadId: string) => {
    if (onSettle === undefined || settling.has(threadId)) return

    setSettling((now) => new Set(now).add(threadId))
    Effect.runFork(
      onSettle(threadId).pipe(
        Effect.match({
          onSuccess: () => {
            setSettled((now) => new Set(now).add(threadId))
            setSettling((now) => {
              const next = new Set(now)
              next.delete(threadId)
              return next
            })
          },
          // Left where it is on refusal. The reader is looking at the row, the
          // report goes to the log the way every other refused write does, and a
          // row that moved to Settled on a write GitHub declined would be this
          // panel lying about the one thing it is for.
          onFailure: () =>
            setSettling((now) => {
              const next = new Set(now)
              next.delete(threadId)
              return next
            })
        })
      )
    )
  }
  /*
   * Settled starts folded and the other three start open.
   *
   * Measured on a merged pull request in `octo-repo`: forty two green checks and six
   * files already read came to forty eight rows and twelve hundred pixels, all
   * of it true and none of it owed. A panel whose whole claim is that what is
   * left fits on the screen cannot open as a screen and a half of what is done.
   *
   * The other three stay open because they are the answer. They are short on
   * any pull request a person can hold in their head, and a Court folded by
   * default is a Court a reader has to remember to look in.
   */
  const [shut, setShut] = useState<ReadonlySet<Court>>(() => new Set<Court>(["settled"]))

  const dockets = useMemo(
    () =>
      docketsIn(
        attentionIn({
          viewer: snapshot.viewer.login,
          state: snapshot.state,
          threads: snapshot.threads.map((thread) =>
            settled.has(thread.id) ? { ...thread, isResolved: true } : thread
          ),
          checks: snapshot.checks,
          commits: snapshot.commits,
          lastReviewPoint: snapshot.viewer.lastReviewPoint,
          merge: snapshot.merge
        })
      ),
    [snapshot, settled]
  )

  const held = dockets.filter((docket) => docket.count > 0)
  const yours = dockets.find((docket) => docket.court === "needs-you")?.count ?? 0
  /*
   * Whether anything is owed, which is not whether anything is held.
   *
   * Settled on its own is the done state, and it was drawing as a folded row
   * reading "Settled 23" and nothing else: a reader had to work out that nothing
   * was owed from the Courts that were absent. The sentence was written for this
   * and almost never appeared, because it asked for every Court to be empty and
   * nearly every repository puts a green check on every pull request. Found on
   * `flazouh/ghpro-scratch#9`, a pull request with one passing check and nothing
   * else on it at all.
   */
  const owed = held.some((docket) => docket.court !== "settled")
  /*
   * The one fact this panel cannot see when GitHub will not serve the merge box.
   *
   * Everything else here comes off routes that are still required, so an empty panel
   * over a merge box that answered means what it says. Without one, the branch item is
   * missing: a pull request behind its base, with green checks and no open thread,
   * would read "Nothing is owed here" over a branch somebody has to catch up. The
   * claim this panel makes is that what is left fits on the screen, so it says which
   * word it is short of rather than making the claim anyway.
   */
  const everything = Option.isSome(snapshot.merge)

  return (
    <Section
      name="What is owed"
      art="needs-you"
      // Amber only while something is the reader's to move. A pull request whose
      // every piece is settled has earned the done edge, and one waiting on
      // somebody else has earned neither.
      tone={yours > 0 ? "attention" : held.length === 0 ? "plain" : "done"}
      summary={yours > 0 ? `${yours} for you` : undefined}
    >
      {owed ? null : (
        <p className="px-3 py-2 text-sm text-ink-muted">
          {everything
            ? "Nothing is owed here"
            : "Nothing else is owed here. GitHub did not say whether the branch is behind."}
        </p>
      )}
      {held.map((docket) => {
          // Turning only while a job is turning. A check that is queued has not
          // started, which is the same nothing as a finding waiting on a machine
          // with no job to run, and both draw the dot.
          const moving = docket.items.some(
            (item) => item.kind === "check" && item.check.state === "running"
          )
          const Mark = art[courtArt(docket.court, moving)]
          const open = !shut.has(docket.court)

          return (
            <div key={docket.court} className="border-line not-first:border-t">
              <h3>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() =>
                    setShut((was) => {
                      const now = new Set(was)
                      if (!now.delete(docket.court)) now.add(docket.court)
                      return now
                    })
                  }
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-semibold hover:bg-hover"
                >
                  <Mark size={14} aria-hidden="true" className="shrink-0 opacity-80" />
                  {COURT_NAME[docket.court]}
                  <span className="text-ink-muted">{docket.count}</span>
                </button>
              </h3>
              {open ? (
                <ul aria-label={COURT_NAME[docket.court]} className="pb-1">
                  {docket.items.map((item) => (
                    <Row
                      key={item.id}
                      item={item}
                      baseBranch={snapshot.baseBranch}
                      onOpen={onOpen}
                      onOpenCommit={onOpenCommit}
                      onSettle={onSettle === undefined ? undefined : press}
                      settling={item.kind === "finding" && settling.has(item.thread.id)}
                    />
                  ))}
                </ul>
              ) : null}
            </div>
          )
      })}
    </Section>
  )
}
