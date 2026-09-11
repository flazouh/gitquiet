import { Option } from "effect"
import { isGreen, isUnfinished } from "./checks"
import type {
  BranchUpdate,
  Check,
  Commit,
  MergeState,
  Participant,
  PullRequestState,
  ReviewThread,
  StackLayer
} from "./PullRequest"
import type { Court } from "./workingSet"

/**
 * What one pull request is read from, to work out what it owes and to whom.
 *
 * Narrower than the snapshot on purpose, in the way `Weighing` and `Wanting`
 * are: these six facts are the whole of the question, and a function that took
 * a snapshot would be a function no test can call without inventing a title, a
 * description and forty commits to get at them.
 */
export type Owing = {
  /** Whose page this is, by login, against which every "somebody else" is measured. */
  readonly viewer: string
  readonly state: PullRequestState
  readonly threads: ReadonlyArray<ReviewThread>
  readonly checks: ReadonlyArray<Check>
  /** In the order GitHub sends them, which is oldest first. */
  readonly commits: ReadonlyArray<Commit>
  /** Where the reader's last review left off, absent until they have made one. */
  readonly lastReviewPoint: Option.Option<string>
  /**
   * None where GitHub would not serve the merge box, which costs this the branch item
   * and nothing else. A branch nobody can prove is behind is one this declines to
   * chase, rather than one it reports as level.
   */
  readonly merge: Option.Option<MergeState>
}

/**
 * One thing on a pull request that can be owed to somebody.
 *
 * The domain object travels whole inside each case rather than being flattened
 * into a name and a line of text. What a row of this wants to draw is not
 * decided here, and every attempt to decide it here ends the same way: the list
 * grows a field for the thread's anchor, then one for the check's URL, then one
 * for the file's line counts, until it is the snapshot again with worse names.
 */
export type AttentionItem =
  | {
    readonly kind: "thread"
    readonly court: Court
    readonly id: string
    readonly thread: ReviewThread
    /** Who spoke last in it, which is what decided the Court. */
    readonly lastSaid: Participant
  }
  | {
    /**
     * A thread an automated reviewer opened, which is a Bot Finding.
     *
     * Apart from a thread because the two are answered differently and because
     * a reader wants to know which they are looking at before they open it: six
     * unanswered findings and six unanswered colleagues are the same number and
     * not the same afternoon.
     */
    readonly kind: "finding"
    readonly court: Court
    readonly id: string
    readonly thread: ReviewThread
    readonly lastSaid: Participant
    /**
     * Whether the reader has answered it, which decides what the row says.
     *
     * A finding the reader answered is quoted by the finding rather than by the
     * answer: the answer is the half of the thread they wrote, and the row has
     * one line to spend. The Court cannot be asked instead, because an answered
     * finding and an unanswered one are both the reader's move now.
     */
    readonly answered: boolean
  }
  | {
    readonly kind: "check"
    readonly court: Court
    readonly id: string
    readonly check: Check
  }
  | {
    /**
     * What landed after the reader's last review, which is a re-read they owe.
     *
     * Not the files they have left un-ticked. Reviewed State is a bookmark a
     * reader puts down for themselves, and nothing in GitHub's community
     * discussions asks to be shown the files without a tick — the loudest thing
     * asked of that checkbox is a way to clear every one of them at once. The
     * tree beside this panel marks the un-ticked files already, and which file
     * to open next is navigation.
     *
     * What a returning reviewer cannot see anywhere is what has moved since
     * they were last here, which is discussion #9956 and the most reacted
     * comment on #163932 both.
     */
    readonly kind: "since"
    readonly court: Court
    readonly id: string
    /** The commits that came after it, oldest first, never empty. */
    readonly landed: ReadonlyArray<Commit>
  }
  | {
    /**
     * The reader reviewed a commit that is no longer on the branch.
     *
     * A rebase or a squash orphans the commit their last review was anchored
     * to, and GitHub answers with "We went looking everywhere, but couldn't
     * find those commits". What that costs the reader is the whole pull
     * request read again from the top, so it is worth saying plainly rather
     * than as a failure to find something.
     */
    readonly kind: "rewritten"
    readonly court: Court
    readonly id: string
  }
  | {
    readonly kind: "branch"
    readonly court: Court
    readonly id: string
    readonly update: BranchUpdate
  }
  | {
    /**
     * The layer this one is stacked on is closed, so the diff below is wrong.
     *
     * GitHub keeps a stacked pull request's base on the stack rather than on
     * the pull request, and it will not let the base be changed while the
     * stack holds it — not through the API and not through their own page.
     * So a layer whose foundation was closed keeps comparing against a branch
     * nobody is landing, and the files tab answers with somebody else's work
     * plus this one's.
     *
     * Worth an item rather than a footnote because nothing else on the page
     * says it. The diff is not marked as suspect, the file count is not marked
     * as inflated, and a reader who trusts either reviews a change that is not
     * the change. Two files became sixteen this way, unremarked, for hours.
     */
    readonly kind: "misbased"
    readonly court: Court
    readonly id: string
    /** The closed layer being compared against, which names the branch. */
    readonly foundation: StackLayer
  }

/** The Courts in the order a reader asks about them, which is urgency. */
export const COURTS = ["needs-you", "waiting", "running", "settled"] as const satisfies
  ReadonlyArray<Court>

/**
 * The three Courts a surface has when nothing on it can be Running.
 *
 * Taken out of the four rather than written again, so the order a reader learns on every other
 * screen is the order on these, and cannot drift from it.
 *
 * Running is the one left out, on the inbox and on a home's discussions alike, because neither
 * one's `courtOf` can return it on any row, ever. Elsewhere an empty Court is drawn anyway: a
 * reader finds Settled by where it sits, and a heading that came and went with the day's rows
 * would take that away. That argument is about a Court which is empty this morning and full this
 * afternoon. A heading nothing can ever reach teaches the reader instead that a heading may mean
 * nothing.
 */
export const COURTS_WITHOUT_RUNNING: ReadonlyArray<Court> = COURTS.filter(
  (court) => court !== "running"
)

/** One Court, and the rows of any one surface filed in it. */
export type Filed<T> = {
  readonly court: Court
  readonly rows: ReadonlyArray<T>
  /** What a heading says without the Court being opened. */
  readonly count: number
}

/**
 * Every row in its Court, in the order a reader asks about them.
 *
 * Their own order is kept inside each pile. GitHub sorted the page, or the reader did, and
 * re-sorting here would throw away an answer somebody asked for. What this changes is which rows
 * sit together, and nothing else.
 *
 * Every Court asked for comes back even where it is empty: "Nothing." under a heading is worth
 * more than a heading that moves.
 */
export const filedByCourt = <T>(
  rows: ReadonlyArray<T>,
  courtOf: (one: T) => Court,
  courts: ReadonlyArray<Court> = COURTS
): ReadonlyArray<Filed<T>> =>
  courts.map((court) => {
    const held = rows.filter((one) => courtOf(one) === court)
    return { court, rows: held, count: held.length }
  })

/** One Court of one pull request, and the items filed in it. */
export type Docket = {
  readonly court: Court
  readonly items: ReadonlyArray<AttentionItem>
  /** What a heading says without the Court being opened. */
  readonly count: number
}

/**
 * The layer this one sits on, when that layer is closed without landing.
 *
 * Layers run foundation first, so the one underneath the reader is the last
 * `below` seat. Merged is not this: a merged foundation is the ordinary way a
 * stack drains, and GitHub retargets what is left. Closed is the case nothing
 * retargets, because closing a layer abandons it without moving anything.
 *
 * None where GitHub kept no stack, since a pull request based on a branch is
 * retargeted by GitHub itself when that branch is deleted, and by a person
 * otherwise. The block only exists inside a stack GitHub holds.
 */
const foundationIfClosed = (merge: MergeState): Option.Option<StackLayer> =>
  Option.flatMap(merge.stack, (stack) => {
    const below = stack.layers.filter((layer) => layer.seat === "below")
    const foundation = below.at(-1)
    return foundation !== undefined && foundation.state === "closed"
      ? Option.some(foundation)
      : Option.none()
  })

/** A thread an automated reviewer opened, whoever has replied to it since. */
const startedByMachine = (thread: ReviewThread): boolean =>
  thread.comments[0]?.author.isAutomated === true

/**
 * Who owes the next word in a thread: whoever did not say the last one.
 *
 * The rule is the same for a colleague and for a reviewing machine, and it is
 * the only rule here that does not need to know what part the reader plays. An
 * author and a reviewer read the same thread and owe the same reply, and every
 * version of this that asked which of the two the reader was got the mixed case
 * wrong: on a pull request you opened and were also asked to review, both
 * answers are true at once.
 *
 * Where the reader spoke last, the Court says who is being waited on. A person
 * can be asked to hurry, so that is Waiting.
 *
 * A finding the reader answered is theirs, which this had as Running until the
 * threads were counted. Over the last twenty pull requests of
 * `octo-org/octo-repo`, of the 67 findings a person answered, a person
 * resolved 50, the machine came back for 12, and 5 are still open. The answer
 * does not hand the thread back three times in four: somebody has to close it,
 * and on the reader's own pull request that somebody is the reader. Running is
 * the Court that means "skip it", and the five still open are what that advice
 * produces.
 *
 * So no thread lands in Running any more, and the Court holds checks alone —
 * every item in it a thing that moves on its own while nobody watches, which is
 * what its turning glyph has been claiming all along.
 */
const courtOfThread = (thread: ReviewThread, viewer: string): Court => {
  if (thread.isResolved) return "settled"

  const last = thread.comments.at(-1)
  if (last === undefined) return "settled"
  if (last.author.login !== viewer) return "needs-you"

  return startedByMachine(thread) ? "needs-you" : "waiting"
}

/**
 * Green is done, unfinished is the machine's, and everything else is yours.
 *
 * Cancelled counts with failed rather than with green, which is what
 * {@link isGreen} already says and what a reader means: a job somebody stopped
 * is not a job that passed, and the only thing that starts it again is a person.
 *
 * A tolerated failure is settled without being green, which is the one place
 * those two part company. It is not a pass — it ran and it fell over — and there
 * is still no move in it for anybody: the Workflow said in writing that the run
 * should carry on, and GitHub concluded the run a success.
 */
const courtOfCheck = (check: Check): Court =>
  isGreen(check) || check.state === "tolerated"
    ? "settled"
    : isUnfinished(check)
      ? "running"
      : "needs-you"

/**
 * What has moved since the reader last reviewed, said as one thing or as none.
 *
 * Three answers, and the third is the one GitHub gets wrong. A reader with no
 * last review point is owed nothing here, because the whole pull request is
 * their delta and a count of it says less than the file tree does. A reader
 * whose point is the newest commit is owed nothing either. A reader whose point
 * is not on the branch at all was rebased out from under, and that is a fact
 * about the branch rather than a lookup that failed.
 */
const sinceLastReview = (
  commits: ReadonlyArray<Commit>,
  lastReviewPoint: Option.Option<string>
): ReadonlyArray<AttentionItem> =>
  Option.match(lastReviewPoint, {
    onNone: (): ReadonlyArray<AttentionItem> => [],
    onSome: (point) => {
      const read = commits.findIndex((one) => one.sha === point)
      if (read === -1) return [{ kind: "rewritten" as const, court: "needs-you" as const, id: "rewritten" }]

      const landed = commits.slice(read + 1)
      return landed.length === 0 ? [] : [{ kind: "since" as const, court: "needs-you" as const, id: "since", landed }]
    }
  })

/**
 * Everything a pull request owes, each filed in exactly one Court.
 *
 * Ordered by how far the item is from the code: the branch the whole thing
 * stands on, then what has landed on it since the reader was last here, then
 * the checks over all of it, then what was said about lines. Within the
 * threads, GitHub's own order survives, which is the order they were opened.
 *
 * A closed pull request owes nothing. Its unanswered threads and its unread
 * commits are all still there and none of them is a move anybody can make, so
 * they are all Settled — the same correction `courtOf` makes for a whole
 * pull request in a list, made here for the pieces of one.
 */
export const attentionIn = (owing: Owing): ReadonlyArray<AttentionItem> => {
  const { viewer, state, threads, checks, commits, lastReviewPoint, merge } = owing
  const over = state === "merged" || state === "closed"
  const court = (worked: Court): Court => (over ? "settled" : worked)

  const misbased = Option.match(Option.flatMap(merge, foundationIfClosed), {
    onNone: (): ReadonlyArray<AttentionItem> => [],
    onSome: (foundation: StackLayer) => [
      {
        kind: "misbased" as const,
        // Needs You: nobody else can see it, and the move is the reader's —
        // recreate this pull request against a base that is still open, since
        // GitHub will not retarget a layer while the stack holds it.
        court: court("needs-you"),
        id: "misbased",
        foundation
      }
    ]
  })

  const branch = Option.match(Option.flatMap(merge, (said) => said.update), {
    onNone: (): ReadonlyArray<AttentionItem> => [],
    onSome: (update: BranchUpdate) => [
      {
        kind: "branch" as const,
        // Waiting rather than Needs You where GitHub refuses the button: somebody
        // with write access to the fork owes this, and it is not the reader.
        court: court(update.mayUpdate ? "needs-you" : "waiting"),
        id: "branch",
        update
      }
    ]
  })

  return [
    ...misbased,
    ...branch,
    ...sinceLastReview(commits, lastReviewPoint).map((item) => ({ ...item, court: court(item.court) })),
    ...checks.map((check) => ({
      kind: "check" as const,
      court: court(courtOfCheck(check)),
      id: `check:${check.name}`,
      check
    })),
    // A thread nobody has said anything in is not something owed to anybody. It
    // is also not something GitHub sends, but the type allows it and a screen
    // that drew an empty row for one would be drawing a row about nothing.
    ...threads.flatMap((thread): ReadonlyArray<AttentionItem> => {
      const lastSaid = thread.comments.at(-1)?.author
      if (lastSaid === undefined) return []

      const kind = startedByMachine(thread) ? ("finding" as const) : ("thread" as const)
      const seat = { court: court(courtOfThread(thread, viewer)), id: `${kind}:${thread.id}`, thread, lastSaid }
      return [
        kind === "finding"
          ? { kind, ...seat, answered: lastSaid.login === viewer }
          : { kind, ...seat }
      ]
    })
  ]
}

/**
 * The same items, in four piles, in the order a reader asks about them.
 *
 * All four come back even where three are empty, because what is drawn is the
 * screen's decision and a Court that vanished on a quiet pull request would
 * take the reader's bearings with it. `count` is on the pile so the heading
 * never has to reach into it.
 */
export const docketsIn = (items: ReadonlyArray<AttentionItem>): ReadonlyArray<Docket> =>
  COURTS.map((court) => {
    const held = items.filter((item) => item.court === court)
    return { court, items: held, count: held.length }
  })
