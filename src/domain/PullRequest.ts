import type { Option } from "effect"
import type { PullRequestRef } from "./PullRequestRef"

export type Participant = {
  readonly login: string
  readonly isAutomated: boolean
  /**
   * GitHub's own URL for their face, when the payload carried one.
   *
   * Worth keeping rather than deriving from the login: an app's avatar lives
   * under an installation id that its name says nothing about, so `Copilot`
   * cannot be turned back into the picture everyone recognises.
   */
  readonly faceUrl: Option.Option<string>
}

export type PullRequestState = "open" | "closed" | "merged" | "draft"

export type ChangeType = "added" | "modified" | "deleted" | "renamed" | "copied" | "changed"

export type DiffLineKind = "hunk" | "context" | "added" | "deleted"

export type DiffLine = {
  readonly kind: DiffLineKind
  readonly text: string
  readonly beforeLine: Option.Option<number>
  readonly afterLine: Option.Option<number>
}

export type FileDiff = {
  readonly isBinary: boolean
  readonly isTruncated: boolean
  readonly lines: ReadonlyArray<DiffLine>
}

/** One file's content, as it comes back from a request for several of them. */
export type FetchedDiff = {
  readonly path: string
  readonly diff: FileDiff
}

export type ChangedFile = {
  readonly path: string
  /** GitHub's SHA-256 of the path. Stable across versions, so never use it for Reviewed State. */
  readonly digest: string
  readonly changeType: ChangeType
  readonly linesAdded: number
  readonly linesDeleted: number
  readonly readByViewer: boolean
  /** GitHub sends content for only some changed files, so this is often absent. */
  readonly diff: Option.Option<FileDiff>
}

export type Commit = {
  readonly sha: string
  readonly abbreviatedSha: string
  readonly author: string
  readonly headline: string
  readonly createdAt: string
}

/**
 * One commit with what it changed, as its own thing to look at.
 *
 * The files are the same {@link ChangedFile} the pull request is read through,
 * so the tree, the diff and every setting over them work here without knowing
 * which of the two they are showing.
 */
export type CommitDetail = {
  readonly sha: string
  readonly abbreviatedSha: string
  readonly headline: string
  /** GitHub's rendering of the rest of the message, when there is any. */
  readonly bodyHtml: Option.Option<string>
  readonly author: string
  readonly avatarUrl: Option.Option<string>
  readonly createdAt: string
  readonly files: ReadonlyArray<ChangedFile>
}

export type ThreadComment = {
  /**
   * The number their routes address this comment by, where the payload carried one.
   *
   * A reply is addressed to a comment and not to the thread it is in. Absent on a comment
   * this interface made itself and has not read back, where nothing can be said in reply
   * until the next read.
   */
  readonly id?: string
  readonly author: Participant
  readonly body: string
  /** GitHub's own rendering of {@link body}, so ours reads as theirs does. */
  readonly html: string
  readonly createdAt: string
}

/**
 * The line a review thread hangs off.
 *
 * A remark about code is only half a remark without it: read in a column on
 * the far side of the screen, "this breaks on empty input" is a sentence
 * someone has to go hunting for.
 */
export type ThreadAnchor = {
  readonly path: string
  /**
   * The lines it hangs from, or nothing on a File Remark.
   *
   * Null is not a missing answer. A remark about the file as a whole — "this
   * should not be in this pull request" — is not about line 40, and GitHub
   * carries it under the marker `FILE` rather than under `R40`.
   *
   * Required and nullable rather than optional, which is the stricter of the
   * two on purpose. Optional, an anchor still written the old flat way — `{path,
   * side, line, startLine}` — satisfies this type, because every field it must
   * have is there and the rest are excess. Every such anchor then reads as a
   * File Remark. That is not a hypothetical: it is what the shots caught after
   * this field was first written optional.
   */
  readonly lines: {
    /** Which side of the diff the line is numbered on. */
    readonly side: "before" | "after"
    /** The line it is hung from, which for a range is the last of them. */
    readonly line: number
    /** The first line of the range, equal to {@link ThreadAnchor.lines.line} for a single line. */
    readonly startLine: number
  } | null
}

/**
 * A remark about some lines, on its way to GitHub.
 *
 * Both commits travel with it because a comment is anchored to a comparison
 * rather than to a file: the same line number means something different once
 * the branch moves, and GitHub refuses a comment that cannot say which pair of
 * commits it was written against.
 */
export type NewComment = {
  readonly path: string
  /**
   * The lines it is about, or nothing to say it about the file as a whole.
   *
   * The side is carried because a remark on a removed line belongs to the old
   * file's numbering. Sent without it, such a remark is filed against the new
   * file at the same number, where it lands on whatever happens to sit there
   * now or on nothing at all.
   *
   * Null is a File Remark, which GitHub takes as a subject type rather than a
   * line. Both spellings of that type are accepted and both come back as
   * `file`; see `docs/spec/github-write-api.md`. Nullable rather than optional
   * for the reason {@link ThreadAnchor.lines} gives.
   */
  readonly lines: NonNullable<ThreadAnchor["lines"]> | null
  readonly body: string
  readonly baseSha: string
  readonly headSha: string
}

export type ReviewThread = {
  readonly id: string
  readonly isResolved: boolean
  /** Whether this reader may reply here. False on a locked conversation. */
  readonly canReply?: boolean
  /** Absent on a thread about the pull request rather than about a line. */
  readonly at: Option.Option<ThreadAnchor>
  readonly comments: ReadonlyArray<ThreadComment>
}

/**
 * Something said about the pull request as a whole.
 *
 * A deploy notice, a "pushed the fix", a screenshot report — the discussion
 * that hangs off no line and so cannot be a {@link ReviewThread}. Kept apart
 * from one rather than folded in as an anchorless thread: a remark has nobody
 * to reply to it and nothing to resolve, and calling it unresolved would put
 * a robot's deploy link in the same count as an objection to the code.
 */
export type Remark = {
  readonly id: string
  readonly author: Participant
  readonly body: string
  /** GitHub's own rendering of {@link body}, so ours reads as theirs does. */
  readonly html: string
  readonly createdAt: string
}

export type CheckState =
  | "succeeded"
  | "failed"
  /**
   * A failure the Workflow was told to carry on past: `continue-on-error: true`.
   *
   * GitHub has no word for this and that is the complaint. Read on workflow run
   * 31641974931 of `flazouh/ghpro-scratch`, written to fail three ways at once:
   * the tolerated job comes back `conclusion: "failure"`, its check run comes
   * back a failure too, and the run around it comes back `conclusion: "success"`.
   * Their own pages draw the job in the red they draw a real failure in, which is
   * [#15452](https://github.com/orgs/community/discussions/15452) and its 316
   * upvotes.
   *
   * Never a Job Step. A step carrying `continue-on-error` comes back
   * `conclusion: "success"` from the steps route — GitHub applies the tolerance
   * before it answers, and the failure is in the log and the annotation only —
   * so there is nothing on a step for this word to be said about.
   */
  | "tolerated"
  | "running"
  | "queued"
  | "cancelled"
  | "skipped"
  | "neutral"

export type CheckNoteLevel = "failure" | "warning" | "notice"

/**
 * Where in the log a note was written: which step of the job, and which line.
 *
 * Both are GitHub's own numbering, taken from the link they put on the note.
 * The step is what a log is fetched by — a job keeps one log per step, a few
 * kilobytes each rather than the megabytes the whole job comes to.
 */
export type LogSpot = {
  readonly step: number
  readonly line: number
}

/**
 * One thing GitHub wrote against a check: which step, and what it said.
 *
 * The message is often the whole story — "the 'client-id' input must be set" —
 * and occasionally only "Process completed with exit code 1", which is why it
 * carries the spot in the log where it happened.
 */
export type CheckNote = {
  readonly level: CheckNoteLevel
  /** The step it happened in, as GitHub names it: "Install dependencies". */
  readonly where: string
  readonly message: string
  /** Where to look in the log, when GitHub said. */
  readonly at: Option.Option<LogSpot>
}

export type LogTone = "plain" | "error" | "warning" | "notice" | "group" | "ended"

/** The eight colours a terminal has, which is all a log ever asks for. */
export type LogColour =
  | "black"
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "magenta"
  | "cyan"
  | "white"
  | "grey"

/** A file a log line names, at the line it names it at. */
export type FileRef = {
  readonly path: string
  readonly line: number
  readonly column: Option.Option<number>
}

/**
 * A stretch of a log line that something is known about.
 *
 * A line is cut wherever its colour changes or a file is named, so the panel
 * can colour one part and make another part a link without either of them
 * having to know about the other.
 */
export type LogPiece = {
  readonly text: string
  readonly colour: Option.Option<LogColour>
  readonly file: Option.Option<FileRef>
}

/**
 * One line of a job's log, as it should be read rather than as it was stored.
 *
 * Every stored line begins with a nanosecond timestamp, may be coloured with
 * escape sequences, and may be wrapped in one of GitHub's `##[...]` markers.
 * None of the three is worth a reader's attention as written, so all three come
 * off here and what they meant is kept: the marker as a tone, the sequences as
 * coloured pieces.
 */
export type LogLine = {
  /** GitHub's own line number, which is what an annotation points at. */
  readonly at: number
  /** The words alone, which is what a search matches and a copy copies. */
  readonly text: string
  readonly tone: LogTone
  readonly pieces: ReadonlyArray<LogPiece>
}

/**
 * A log as it is shown: loose lines, and groups that can be left shut.
 */
export type LogPart =
  | { readonly kind: "line"; readonly line: LogLine }
  | {
      readonly kind: "group"
      readonly title: LogLine
      readonly lines: ReadonlyArray<LogLine>
      /** The worst thing inside, so a shut group can still say it holds an error. */
      readonly worst: LogTone
    }

/**
 * One step of a job: what it was called, how it went, and how long it took.
 *
 * A job is read as a run of these rather than as one wall of log, because that
 * is how it was written and how it fails — "Run tests" went red, the eleven
 * steps around it did not. The number is GitHub's own and is what a log is
 * fetched by, which is why it is kept as given: the numbering skips wherever the
 * workflow skipped a step, and renumbering them would ask for the wrong log.
 */
export type JobStep = {
  readonly number: number
  readonly name: string
  readonly state: CheckState
  /** How long it took. Absent while it is still going, or before it began. */
  readonly seconds: Option.Option<number>
}

export type Check = {
  readonly name: string
  readonly state: CheckState
  readonly isRequired: boolean
  /** GitHub's one-line account of the outcome, shown without opening a log. */
  readonly summary: string
  readonly url: string
  readonly durationSeconds: number
}

export type ReviewDecision = "approved" | "changes-requested" | "commented" | "dismissed"

export type Review = {
  readonly reviewer: Participant
  readonly decision: ReviewDecision
}

/**
 * The part of this page that would answer a blocker.
 *
 * Only the two there is somewhere to go for. A blocker about a draft, or about
 * push access, is answered somewhere else entirely, and a button that scrolls
 * to nothing in particular is worse than no button.
 */
export type BlockerAbout = "checks" | "conversation"

export type MergeBlocker = {
  readonly name: string
  readonly explanation: string
  /** Where on this page the reader would go to deal with it. */
  readonly about: Option.Option<BlockerAbout>
  /**
   * Whether GitHub's own rules allow an administrator past this one.
   *
   * Per rule rather than per pull request, and useless on its own: a rule that
   * may be bypassed still cannot be, by someone without the permission. It
   * pairs with {@link MergeState.mayBypass}.
   */
  readonly bypassable: boolean
  /**
   * The files this blocker is about, where it is about files at all.
   *
   * Only a conflict is: GitHub names the paths that cannot be merged, and every
   * other condition is about the pull request as a whole. Empty rather than
   * absent for those, because an empty list is already what "nothing to list"
   * means here — the card draws no blockers at all on the same reasoning.
   */
  readonly files: ReadonlyArray<string>
  /**
   * Whether GitHub says their own web editor could deal with it.
   *
   * False unless they said true. Null is GitHub declining to answer, which is
   * not the same as yes, and the one thing this must not do is send a reader to
   * an editor that then refuses them.
   */
  readonly mayResolve: boolean
}

/**
 * A merge GitHub is holding until it becomes possible.
 *
 * The state "merge when ready" leaves behind, and the reason a card that reads
 * only the queue is wrong about a repository that has one: joining a queue
 * arms an auto-merge, and the pull request does not enter the line until its
 * requirements pass. Nothing has visibly happened, and something has.
 */
export type BranchUpdate = {
  /** What pressing it does, in GitHub's word for it. */
  readonly how: UpdateWay
  /**
   * The other ways GitHub would accept, this one among them.
   *
   * A repository can allow both, and which of the two lands is a real choice: a
   * merge writes a commit into the branch and always works, a rebase rewrites it
   * onto the base and keeps the history flat. GitHub's own button offers both
   * behind a caret and it used to be read here as a verdict rather than a
   * choice, so a reader who rebases everything got a merge commit and no way to
   * say otherwise. Empty is impossible: the way on the button is always in here.
   */
  readonly ways: ReadonlyArray<UpdateWay>
  /** Whether the Participant may do it from here. */
  readonly mayUpdate: boolean
  /**
   * Why not, when GitHub said. Usually write access to somebody else's fork,
   * which is not something this extension could work out for itself.
   */
  readonly refusal: Option.Option<string>
}

export type AutoMerge = {
  /** How it will be merged when the moment comes, in GitHub's word for it. */
  readonly method: Option.Option<string>
  /** Whether the Participant may call it off again. */
  readonly viewerCanCancel: boolean
}

/**
 * The three ways GitHub will put a branch into another one.
 *
 * In the domain rather than beside the write that sends one, because it is not a
 * detail of the request: which of the three a repository allows decides what the
 * button says, what the press posts, and which rules GitHub weighs the pull
 * request against. A repository allows any subset of them and names one the
 * default, and a fourth word arriving in that field is a method this cannot
 * send — see `MergeState.method`.
 */
export type MergeMethod = "MERGE" | "SQUASH" | "REBASE"

/**
 * The two ways GitHub will catch a branch up with the one it left.
 *
 * Not the merge methods, though two of the words are the same: this is what
 * happens to the branch while the pull request stays open, and a squash is not
 * one of the answers.
 */
export type UpdateWay = "MERGE" | "REBASE"

/**
 * The line a repository makes pull requests stand in before they land.
 *
 * A queue changes what merging even means: nothing goes straight into the base
 * branch, it is enqueued, tested against whatever is ahead of it, and merged by
 * GitHub when its turn comes. A button that says "Squash and merge" on such a
 * repository is either refused or, worse, jumps the line — so the interface has
 * to know a queue exists before it offers anything.
 */
export type MergeQueue = {
  /** Whether this pull request is already standing in it. */
  readonly waiting: boolean
  /** Its place in the line, when GitHub says which. The first is 1. */
  readonly position: Option.Option<number>
  /** Whether the Participant may add it to the queue, or take it out again. */
  readonly viewerCanQueue: boolean
  /**
   * Whether GitHub would take this one into the queue now.
   *
   * Separate from {@link viewerCanQueue}, which is about the Participant rather
   * than about this pull request: someone who may queue anything still cannot
   * queue a pull request with an unresolved thread. GitHub answers both, and a
   * button that reads only the permission offers a refusal.
   */
  readonly mayJoin: boolean
  /** The queue's own page, for the things this interface does not do itself. */
  readonly url: Option.Option<string>
}

/**
 * Where a Layer sits against the pull request being read.
 *
 * GitHub says `BEFORE`, `CURRENT` and `AFTER`, which are words about the order
 * a merge happens in rather than about the shape on the screen, and which read
 * backwards next to a list drawn bottom first. `below` and `above` are the two
 * facts a reader acts on: what a press takes with it, and what it leaves open.
 */
export type Seat = "below" | "here" | "above"

/**
 * One pull request of a Stack.
 *
 * Deliberately thin. Everything here arrives inside the merge box of the pull
 * request being read, so a Layer is what GitHub says about somebody else's pull
 * request in passing — enough to name it, place it and go to it, and not enough
 * to pretend it is a snapshot. A screen that needs the rest reads that pull
 * request properly.
 */
export type StackLayer = {
  readonly reference: PullRequestRef
  readonly title: string
  readonly headBranch: string
  readonly state: PullRequestState
  readonly seat: Seat
}

/**
 * Layers, and the branch all of them go into.
 *
 * The shape a stack has whether or not anybody has made one. GitHub keeps a
 * stack as an object with a number; it will also describe, for a pull request
 * based on another pull request's branch, the stack one press would make out of
 * them — and there is nothing to tell apart in the description itself. So this is
 * the two facts a chain is, and {@link Stack} is this with GitHub's number on it.
 *
 * Layers run foundation first, which is the order they land in and the reverse of
 * the order GitHub sends either of them in.
 */
export type Chain = {
  readonly layers: ReadonlyArray<StackLayer>
  /**
   * The branch the whole chain lands on.
   *
   * One branch for all of it, so every seat gives the same answer. Not read off
   * the layers of a stack, which carry a head branch each and no base: the merge
   * box names it beside them, and GitHub's own schema keeps it on the stack
   * rather than on any layer — "the branch that the stack's pull requests
   * target". A proposal is the easier case, its own payload giving a base branch
   * per entry, so the foundation's says it.
   *
   * Absent where the payload does not name it and the reader is above the
   * foundation, since the only base left in reach is then the layer directly
   * underneath them. A chain that says it lands on `feat-b` is a worse answer
   * than a chain that does not say.
   */
  readonly floor: Option.Option<string>
}

/**
 * An ordered chain of pull requests that land together, as GitHub now keeps one.
 *
 * Not the same thing as the chain `src/domain/stacks.ts` infers from branch
 * names, and the difference decides what may be pressed. That one is a shape a
 * Working Set happens to have; this one is an object GitHub holds, with its own
 * number, its own merge route and its own rule — a press lands this layer and
 * every unmerged layer below it, in one operation, and the ordinary merge route
 * refuses it. Both stay: a branch based on a branch is still a stack to read,
 * and is not one of these.
 */
export type Stack = Chain & {
  /** GitHub's number for the stack itself. Not any pull request's number. */
  readonly number: number
}

export type MergeState = {
  /**
   * Whether GitHub would accept a merge now.
   *
   * True for both of the words GitHub uses for yes: everything settled, and
   * everything settled subject to the required checks it re-reads at merge
   * time. Whether any of those checks is still running is a question the checks
   * themselves answer, not this.
   */
  readonly isMergeable: boolean
  readonly blockers: ReadonlyArray<MergeBlocker>
  /** The queue this lands through, on the repositories that have one. */
  readonly queue: Option.Option<MergeQueue>
  /** A merge already armed and waiting for this to become mergeable. */
  readonly autoMerge: Option.Option<AutoMerge>
  /**
   * The stack this pull request is one layer of, when GitHub keeps one for it.
   *
   * On the merge state rather than beside the branch names because it is a fact
   * about merging before it is anything else: it changes how many pull requests
   * one press lands, which route the press goes to, and whether the press is
   * allowed at all.
   */
  readonly stack: Option.Option<Stack>
  /**
   * The catching-up this branch needs, when the base has moved on without it.
   *
   * Present only while the pull request is behind, which is what makes it
   * worth putting a button on: a branch that is level needs nothing.
   */
  readonly update: Option.Option<BranchUpdate>
  /** Whether the Participant may merge past the rules that failed. */
  readonly mayBypass: boolean
  /**
   * GitHub's signed tokens for the things this card is about.
   *
   * Opaque here on purpose: they are handed back to GitHub's own socket, which
   * says a line when the queue moves or the merge state changes. Reading them
   * would be reading somebody else's private format.
   */
  readonly channels: ReadonlyArray<string>
  /**
   * The way a press would land this, which the repository decides and not us.
   *
   * Every press used to post `SQUASH`, and the button said so, on every
   * repository in the world. A repository that allows only a merge commit got a
   * control that GitHub refuses and a word above it naming a commit GitHub would
   * never write. The same word was hardcoded into the address the merge box is
   * read at, which is the half a reader saw: GitHub weighs its rules against the
   * method it is handed, so a squash-only repository answered with two failed
   * conditions about a merge commit nobody had asked for.
   *
   * The repository's own default where GitHub allows it, since that is the one
   * their page opens on, and any other allowed one where the default is refused.
   *
   * None where GitHub named no way in this can send, which is a no rather than a
   * shrug: the button greys out instead of guessing at a method. It happens on a
   * repository that allows nothing but a queue, and it would happen on a fourth
   * word in that field — theirs to add, and not ours to post.
   */
  readonly method: Option.Option<MergeMethod>
  /**
   * The other ways this repository would accept, the one above among them.
   *
   * GitHub's own merge button keeps these behind a caret, and reading only the
   * default meant a repository that allows all three offered one — so a reviewer
   * who rebases everything was given a squash and nothing to press instead. The
   * word on the button is still the repository's own default, because that is
   * what their page opens on and what most presses want.
   *
   * In GitHub's order, and only the ones they marked allowed and this can send.
   * Empty exactly when {@link method} is none, and one long on a repository that
   * allows a single way in — which is when nothing is worth offering.
   */
  readonly methods: ReadonlyArray<MergeMethod>
}

/**
 * Whether the head branch can be deleted, and whether it is already gone.
 *
 * Two booleans and not one word, because GitHub answers them separately and they
 * are not opposites: both are false on a branch this reader may not touch at
 * all. `mayRestore` is the one that says the branch has gone, since GitHub only
 * offers to put back a branch that is missing.
 */
export type HeadRef = {
  readonly mayDelete: boolean
  readonly mayRestore: boolean
}

export type Viewer = {
  readonly login: string
  /** Absent until the Participant has reviewed this pull request at least once. */
  readonly lastReviewPoint: Option.Option<string>
}

/**
 * What the Author wrote about their own pull request, in both the form they
 * wrote it and the form GitHub renders it in.
 */
export type Description = {
  readonly markdown: string
  readonly html: string
}

export type PullRequestSnapshot = {
  readonly reference: PullRequestRef
  readonly title: string
  readonly description: Description
  readonly state: PullRequestState
  /**
   * When it was opened, which every pull request has.
   *
   * None only where GitHub stopped sending it, since the age beside the badge is
   * worth less than the pull request it sits on.
   */
  readonly openedAt: Option.Option<string>
  /** When it closed, on one that has — merged or not, since merging closes it. */
  readonly closedAt: Option.Option<string>
  /** When it landed, on one that has. */
  readonly mergedAt: Option.Option<string>
  readonly author: Participant
  readonly baseBranch: string
  readonly headBranch: string
  /**
   * What is left to do with the branch itself, once the pull request is over.
   *
   * Beside the branch names because it is a fact about the branch and not about
   * merging: the same two answers arrive on a closed pull request as on a merged
   * one, and neither of them changes whether anything lands.
   *
   * Both false is the ordinary reading rather than an error — a repository that
   * deletes head branches on merge by itself has already done it, and a branch
   * on somebody else's fork was never this reader's to touch.
   */
  readonly headRef: HeadRef
  /**
   * The stack GitHub would make out of this pull request, where it would make one.
   *
   * Beside the branches rather than on the merge state, where {@link Stack} sits.
   * A stack is on the merge state because its own reason says so — it changes how
   * many pull requests one press lands. A proposal changes nothing about a press:
   * nothing lands together and nothing holds anything up until somebody has made
   * the stack. What it is a fact about is this pull request's branch and what else
   * is standing on it, which is where the branches themselves are.
   *
   * Present only where GitHub offers one, which is never on a pull request already
   * in a stack: their own route answers `null` there.
   */
  readonly proposal: Option.Option<Chain>
  readonly headSha: string
  /** The commit the branch is compared against, which a comment is anchored to. */
  readonly baseSha: string
  readonly viewer: Viewer
  readonly files: ReadonlyArray<ChangedFile>
  readonly commits: ReadonlyArray<Commit>
  readonly threads: ReadonlyArray<ReviewThread>
  /** What was said about the pull request itself, which no thread carries. */
  readonly remarks: ReadonlyArray<Remark>
  readonly checks: ReadonlyArray<Check>
  /**
   * Every verdict given so far, where GitHub would say.
   *
   * None and not an empty array when the merge box did not answer, because the two
   * mean opposite things to the panel that reads them: empty is "nobody has judged
   * this yet", which is a sentence, and None is "we were not told", which is a
   * different one. Told apart so the reader is never shown the first when the second
   * is true. Absent together with `merge` below — one route carries both.
   */
  readonly reviews: Option.Option<ReadonlyArray<Review>>
  /**
   * Whether this can land and what stands in the way, where GitHub would say.
   *
   * None when the merge box did not answer. GitHub served that route their crash page
   * through the incident of 2026-08-17, and the whole pull request was refused over
   * it, so the route is now one the page can do without.
   *
   * An Option and not a merge state built out of nothing, which is the shape this
   * would otherwise take: unmergeable, with an empty list of reasons. That reading
   * says no and will not say why, and every control on the card would be greyed under
   * it with nothing to explain itself. None cannot be mistaken for an answer, and the
   * screen draws a panel that says so where the card would be.
   */
  readonly merge: Option.Option<MergeState>
}
