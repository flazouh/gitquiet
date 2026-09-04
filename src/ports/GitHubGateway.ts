import { Context, Data, Effect, Option } from "effect"
import type {
  Check,
  CheckNote,
  CommitDetail,
  FetchedDiff,
  JobStep,
  LogLine,
  MergeMethod,
  NewComment,
  Participant,
  PullRequestSnapshot,
  Remark,
  ReviewThread,
  ThreadComment
} from "../domain/PullRequest"
import type { PullRequestRef, RepoRef } from "../domain/PullRequestRef"
import type { Uploaded } from "../domain/attaching"
import type { Suggesting } from "../domain/suggesting"
import type { Tab } from "../domain/tabs"
import type { Happening } from "../domain/activity"
import type { CommitList, History, Marks, Stat, Stats } from "../domain/commitList"
import type { IssueSnapshot, Settling } from "../domain/Issue"
import type { InvolvedIssue, Involvement, IssueRef, ListedIssue } from "../domain/issues"
import type { Listing } from "../domain/life"
import type { Notice, Press } from "../domain/notices"
import type { Person } from "../domain/person"
import type { Portrait } from "../domain/portrait"
import type { Raised, Raising } from "../domain/raising"
import type { Attached, Version } from "../domain/release"
import type { Front, Opened, Standing, Starring, Touch, TouchWho } from "../domain/repoHome"
import type { Blamed } from "../domain/blame"
import type {
  Category,
  DiscussionList,
  DiscussionPress,
  DiscussionRef,
  Doing,
  DiscussionSnapshot,
  ListedDiscussion
} from "../domain/discussions"
import type { Repository } from "../domain/repositories"
import type { RunOpening, RunRef } from "../domain/run"
import type { Strand } from "../domain/strand"
import type { Branches } from "../domain/sittings"
import type { InvolvedPullRequest, Shelf, Size, Sizes, Standings } from "../domain/workingSet"

/**
 * What the core needs of GitHub, and nothing about how it is reached.
 *
 * The system's single seam, and the reason the same interface can run as an
 * extension inside GitHub's page and as a website that has never heard of a
 * content script. It speaks the vocabulary in CONTEXT.md rather than GitHub's
 * field names, so nothing above it knows their schema — and it declares no
 * implementation, so nothing above it knows their transport either.
 *
 * Two of these exist or are planned. `src/github` reads GitHub's own internal
 * routes with the session cookies of somebody already on their page, which is
 * fast and available nowhere else. A second will read their public API with a
 * token, which is slower and available everywhere. Anything that would let one
 * of them answer a question the other cannot belongs on this side of the seam
 * only if both can be made to answer it.
 */

/**
 * `sign-on` is apart from `rejected` because the reader can do something about
 * it and about nothing else on this list. An organisation may require single
 * sign-on, and until the reader has done it GitHub refuses its repositories —
 * with a 401 on their JSON routes and with a sign-on page in place of the
 * document on the others. Reported as a refusal, that reads as a bug in here; it
 * is a wall with a door, and the card in front of it should say so.
 */
export type GatewayFailure =
  | "unreachable"
  | "rejected"
  /**
   * GitHub answered with a status only GitHub owns: 500, 502, 503, 504.
   *
   * Apart from `rejected` because the two are opposite facts and only one of them is
   * about the reader. A refusal means GitHub read the request and said no, and the
   * next read says no again. This means GitHub did not get as far as reading it, and
   * the next read may well work — which is both why it is asked again before anybody
   * is told, and why what they are told is that GitHub is having trouble.
   */
  | "down"
  | "undecodable"
  | "not-recorded"
  | "sign-on"

export class GatewayError extends Data.TaggedError("GatewayError")<{
  /**
   * Where it happened. A repository is enough, because the calls that fail
   * about a commit have no pull request to name and a reader shown the error
   * is being told which page could not be read, not which number it had.
   */
  readonly reference: RepoRef
  readonly route: string
  readonly reason: GatewayFailure
  readonly detail: string
}> {}

/**
 * A Working Set read that failed, which has no repository to blame.
 *
 * Its own error rather than a {@link GatewayError} with the reference left out:
 * every one of those names a page somebody was trying to read, and the routes
 * behind a Working Set are about the Participant instead. Widening that field to
 * nothing-in-particular would make it meaningless everywhere it is already used.
 */
export class WorkingSetError extends Data.TaggedError("WorkingSetError")<{
  readonly route: string
  readonly reason: GatewayFailure
  readonly detail: string
}> {}

/**
 * The organisation a failed read was walled behind, if that is what stopped it.
 *
 * Read off whatever the failure arrived wrapped in rather than off a
 * {@link GatewayError}, because a screen holds the cause the read failed with and
 * nothing narrower. Only a failure that names both the wall and the organisation
 * counts: a {@link WorkingSetError} carries the reason and has no repository to
 * take the organisation from, and a card that cannot say where to sign on is
 * better off saying nothing about it.
 */
export const askedToSignOn = (cause: unknown): Option.Option<string> => {
  if (why(cause) !== "sign-on") return Option.none()

  const owner = (cause as { reference?: { owner?: unknown } })?.reference?.owner
  return typeof owner === "string" && owner !== "" ? Option.some(owner) : Option.none()
}

/**
 * Whether GitHub was the thing that broke.
 *
 * It matters because the sentence a screen shows for everything else is "something
 * GitHub sends has changed", which is a report of a fault in this extension. Saying
 * that during an outage sends the reader to file a bug about a page that is fine, and
 * it goes on saying it for as long as the incident lasts.
 */
export const gitHubIsDown = (cause: unknown): boolean => why(cause) === "down"

/**
 * Whether the request never got to GitHub at all.
 *
 * Apart from {@link gitHubIsDown} because the two send a reader to different places.
 * GitHub answering with an error is answered by their status page and by waiting; a
 * request that never left is answered by the connection, a proxy, or whatever else
 * on this machine is standing in the way, and their status page will say everything
 * is fine because for everybody else it is.
 *
 * Both were being drawn as "something GitHub sends has changed", which is neither.
 */
export const couldNotReachGitHub = (cause: unknown): boolean => why(cause) === "unreachable"

/**
 * The reason off whatever a screen is holding, which is a cause and not an error.
 *
 * Both readers above take `unknown` rather than one of the two errors, because that
 * is what a screen has: the cause a read failed with. One cast in one place, so the
 * two questions asked of it are asked the same way, and a {@link WorkingSetError}
 * answers them as a {@link GatewayError} does.
 */
const why = (cause: unknown): unknown => (cause as { reason?: unknown })?.reason

/**
 * Where a page of results sits in the whole of them.
 *
 * Worth carrying because a repository can have two thousand pull requests open and
 * a page holds twenty-five: without the count, the first page of something huge
 * and the whole of something small are the same picture.
 */
export type Pages = {
  readonly current: number
  readonly total: number
  readonly count: number
}

/**
 * One page of a search: the rows, and where the page sits.
 *
 * `pages` is optional because GitHub's own payload leaves it out on some answers,
 * and a list that would not draw for want of a page number would be a list nobody
 * could read.
 */
export type Found = {
  readonly rows: ReadonlyArray<InvolvedPullRequest>
  readonly pages: Option.Option<Pages>
}

/**
 * One page of an issue search: the rows, and where the page sits.
 *
 * The same shape as {@link Found} over a different row, and kept as its own
 * type rather than made generic: the two are read from different routes, cached
 * under different keys, and drawn by different screens, so the only thing they
 * would share is the punctuation.
 */
export type FoundIssues = {
  readonly rows: ReadonlyArray<ListedIssue>
  readonly pages: Option.Option<Pages>
}

/**
 * One page of a repository's discussions: the rows, every category the repository has, and
 * whether there is another page.
 *
 * The categories come back with the rows rather than from a read of their own, because they are
 * on the same document: their sidebar names all nine of `vercel/next.js`'s where the first page
 * of rows mentions five. A category nobody has posted in yet is still a category, and a filter
 * built from the rows would leave four of them off it.
 *
 * `more` and not a {@link Pages} count. Their discussions list prints no total anywhere on the
 * page and answers no route that does, so the only honest thing to say is whether they drew a
 * next link.
 */
export type FoundDiscussions = {
  readonly rows: ReadonlyArray<ListedDiscussion>
  readonly categories: ReadonlyArray<Category>
  readonly more: boolean
}

/**
 * What is already known about a list's rows beyond the list itself: which of them
 * are stacked, how big each change is, and how its checks and reviews stood.
 *
 * Keyed the way the three things they feed are keyed — the stacks by the pull
 * request's name, because that is what `sittingsIn` asks with, and the sizes and
 * the standings by GitHub's numeric id, because that is what `withSizes` and
 * `withStandings` ask with.
 */
export type RememberedRows = {
  readonly branches: ReadonlyMap<string, Branches>
  readonly sizes: Sizes
  readonly standings: Standings
}

/**
 * The only adapter to GitHub, and the system's single seam. It speaks the
 * vocabulary in CONTEXT.md rather than GitHub's field names, so everything
 * above it is insulated from both GitHub's schema and the choice of transport.
 */
export class GitHubGateway extends Context.Service<
  GitHubGateway,
  {
    readonly snapshot: (
      reference: PullRequestRef
    ) => Effect.Effect<PullRequestSnapshot, GatewayError>
    /**
     * The same checks, with a failure its own run carried on past said as
     * tolerated.
     *
     * Apart from {@link snapshot} because it is a second read of something much
     * larger, and because nothing waits for it: a job carrying
     * `continue-on-error: true` is reported `FAILURE` in their status checks
     * payload like any other, and the only place the tolerance is written is the
     * run page behind it, which is half a megabyte. A pull request with three
     * failing runs would hold its whole first paint behind three of those.
     *
     * So the checks are drawn as GitHub reported them and this softens what it
     * can afterwards, which only ever takes a check from failed to tolerated.
     * See `loadPullRequest`, which is where the two are put together.
     *
     * It cannot fail. Every run behind these is a page this interface could
     * have shown without, so an unreachable network, a refusal, or markup
     * nothing can read all mean the same thing: the check stays red exactly as
     * GitHub reported it, which is the only safe way to be wrong.
     */
    readonly tolerated: (
      checks: ReadonlyArray<Check>
    ) => Effect.Effect<ReadonlyArray<Check>>
    /**
     * The pull request as it was the last time it was read, without asking
     * GitHub anything.
     *
     * Answers in about as long as a storage read against the second or more a
     * live read costs, which is the difference between a page that appears and
     * a page that loads. Nothing it gives is current, and nothing above it
     * should treat it as though it were: it is what goes on the screen while
     * {@link snapshot} finds out what actually is.
     *
     * It cannot fail. No store, an entry written by an older build, a payload
     * GitHub has since changed — all of them mean the same thing to whoever
     * asked, which is that the network is the only way to find out.
     */
    readonly remembered: (
      reference: PullRequestRef
    ) => Effect.Effect<Option.Option<PullRequestSnapshot>>
    /**
     * The content for files the page arrived without.
     *
     * `head` is the commit the diff is against, which the snapshot carries as
     * its head sha.
     */
    readonly diffs: (
      reference: PullRequestRef,
      head: string,
      paths: ReadonlyArray<string>
    ) => Effect.Effect<ReadonlyArray<FetchedDiff>, GatewayError>
    /**
     * What GitHub wrote against a check that has something to say.
     *
     * Empty for a check with nothing written against it, and for one whose
     * page no longer looks the way this reads — both of which are ordinary,
     * and neither of which is a failure.
     */
    readonly notes: (
      reference: PullRequestRef,
      check: Check
    ) => Effect.Effect<ReadonlyArray<CheckNote>, GatewayError>
    /**
     * One step's log, for the note that points into it.
     *
     * A step at a time rather than the whole job: a job's log runs to
     * megabytes and a step's to a few kilobytes, and a note names its step.
     */
    readonly log: (
      reference: PullRequestRef,
      sha: string,
      check: Check,
      step: number
    ) => Effect.Effect<ReadonlyArray<LogLine>, GatewayError>
    /**
     * The end of a check's whole log, for a check that pointed at no line.
     *
     * A check that passed, and a check that failed without writing anything
     * against itself, both leave the dialog with nothing to show. The end of
     * the log is where both of them say what happened.
     */
    readonly tail: (
      reference: PullRequestRef,
      sha: string,
      check: Check,
      keep: number
    ) => Effect.Effect<ReadonlyArray<LogLine>, GatewayError>
    /**
     * The steps a check ran as, in the order it ran them.
     *
     * What the native Actions view is a list of, and the shape a job actually
     * has: twelve named steps, one of which is the reason anyone opened it.
     * Empty for a check that is not an Actions job, and for one whose steps
     * GitHub no longer keeps — neither is a failure.
     */
    readonly steps: (
      reference: PullRequestRef,
      check: Check
    ) => Effect.Effect<ReadonlyArray<JobStep>, GatewayError>
    /**
     * One commit of the branch, with everything it changed.
     *
     * Read from the page GitHub serves for a commit rather than from the pull
     * request's routes: a commit belongs to the repository, not to the pull
     * request that happens to carry it.
     */
    readonly commit: (
      reference: RepoRef,
      sha: string
    ) => Effect.Effect<CommitDetail, GatewayError>
    /**
     * The same commit as it was last read, without asking GitHub.
     *
     * The truest memory this store holds: a commit that has landed never changes, so what
     * is kept of one is right rather than nearly right. What is kept is the facts and the
     * file names without the diffs behind them — see `keptCommit.ts` — so the page opens
     * with its header, its message and its whole tree, and reads the file being looked at.
     */
    readonly rememberedCommit: (
      reference: RepoRef,
      sha: string
    ) => Effect.Effect<Option.Option<CommitDetail>, GatewayError>
    /**
     * A repository's own tab row: which tabs it has, where each goes, and their counts.
     *
     * Not something an address can say. Issues, Discussions, Actions and Projects can each
     * be switched off, Insights lives at `/network/dependencies`, and the counts are
     * GitHub's own. It is served in the document for the front page and nowhere else, so
     * this is the read that gets it for every other page of the repository.
     */
    readonly tabs: (reference: RepoRef) => Effect.Effect<ReadonlyArray<Tab>, GatewayError>
    /** The same row as it was last read, without asking GitHub. */
    readonly rememberedTabs: (
      reference: RepoRef
    ) => Effect.Effect<Option.Option<ReadonlyArray<Tab>>, GatewayError>
    /**
     * Who can be mentioned here, and what can be referred to by number.
     *
     * One read for both lists, whole, because their suggester answers with the whole of each
     * and takes no query. So the box filters where it stands and a keystroke asks nobody
     * anything. See `suggesting.ts`.
     */
    readonly suggesting: (reference: RepoRef) => Effect.Effect<Suggesting, GatewayError>
    /**
     * A file pasted or dropped into a box, put where GitHub keeps them.
     *
     * Three requests, which are one thing to everybody above here: their route hands out a
     * signed form, the bytes go to storage with it, and a third call tells GitHub they arrived.
     * The address that comes back is the one that goes in the comment. See `attaching.md`.
     */
    readonly upload: (reference: RepoRef, file: File) => Effect.Effect<Uploaded, GatewayError>
    /**
     * The content for files a commit page arrived without.
     *
     * A commit page embeds diffs until it has spent a byte budget and sends
     * every file after that as a name and a status, exactly as a pull request
     * page does. What differs is how the rest are asked for: their route takes
     * no list of paths — it accepts one and ignores it — and hands out batches
     * walking forward from a cursor, so reaching a file means passing every file
     * before it.
     *
     * Which is why this answers with everything it walked past rather than only
     * what was asked for. Whoever asked keeps the lot, so the walk is paid for
     * once instead of once per file.
     */
    readonly commitDiffs: (
      reference: RepoRef,
      sha: string,
      paths: ReadonlyArray<string>
    ) => Effect.Effect<ReadonlyArray<FetchedDiff>, GatewayError>
    /**
     * One page of a branch's commits, grouped into days the way GitHub groups
     * them.
     *
     * Takes the whole address rather than a branch and a cursor, because their
     * commit list answers filters this interface does not draw controls for —
     * an author, a date range — and an address carrying one is an address a
     * reader arrived at on purpose. Handing the search back untouched keeps
     * those pages readable without knowing what is in them.
     */
    readonly commits: (list: CommitList) => Effect.Effect<History, GatewayError>
    /**
     * A repository's front page: the root of the tree, the README already
     * rendered, and where the reader stands with it.
     *
     * Read as a document rather than as JSON, which is the one route in this
     * gateway that has to be. Their code view answers `Accept: application/json`
     * with the route alone and never with the layout around it, because their own
     * app holds the layout already and does not ask twice — measured from inside
     * the repository and from outside it. `currentUserCanPush` lives in that
     * layout, and it is the field the whole page is ordered by, so the document is
     * the only answer that carries it.
     *
     * Costs no more than the JSON would. A well-documented repository is three
     * hundred kilobytes either way, because the rendered README is nearly all of
     * it, and the screen prefers the document it is already standing on to any of
     * this.
     */
    readonly repoHome: (
      reference: RepoRef,
      branch: string | null
    ) => Effect.Effect<Front, GatewayError>

    /**
     * A workflow run: its own facts, every job it ran, and everything those jobs
     * wrote against themselves.
     *
     * One call for all three, because their run page is one document that carries
     * all three. A reader arriving at a failed run asks one question, "what is the
     * error", and this is the answer to it in a single request: on the run this was
     * measured against, twelve jobs and fifteen notes, of which one names the cause.
     *
     * The notes come back gathered as well as whole. Ten copies of one lint opinion
     * are one row with a count, and a note that only says a process exited non-zero
     * ranks under every note that says what, which is work the core does and not the
     * screen: see `gathered` in `src/domain/run.ts`.
     */
    readonly run: (reference: RunRef) => Effect.Effect<RunOpening, GatewayError>

    /**
     * Runs a run again: every job of it, or the ones that failed.
     *
     * The failed ones on their own is the press a red run is opened for, and it is
     * GitHub's own choice rather than a filter applied here — their page renders one
     * form per choice and this sends the one that was asked for.
     *
     * A run GitHub will not re-run comes back refused, because their page carries no
     * form for it: the workflow file has gone, the run is past the window they keep
     * re-runs for, or the reader has no write access. What may be pressed is on the
     * opening as `presses`, so a screen offers nothing it has not been shown a form
     * for.
     */
    readonly rerunRun: (
      reference: RunRef,
      which: "all" | "failed"
    ) => Effect.Effect<void, GatewayError>

    /** Stops a run that is still going, which their own page addresses by check suite. */
    readonly cancelRun: (reference: RunRef) => Effect.Effect<void, GatewayError>

    /**
     * The same run as it was last read, without asking GitHub.
     *
     * A finished run never changes, so what is kept is exactly right for it; a running
     * one is drawn from this and replaced by the live read a moment later, which is the
     * same bargain every other page here makes. Nothing where the run has not been read
     * on this browser before.
     */
    readonly rememberedRun: (
      reference: RunRef
    ) => Effect.Effect<Option.Option<RunOpening>, GatewayError>

    /**
     * Every recent workflow run of a repository, folded into the work it belongs to.
     *
     * Strands and not Runs, because their own page answers this question with
     * twenty-five rows that are ten pull requests: three `ci` runs of one branch are
     * one thing a reader is waiting on, and a `CodeQL` run on `refs/pull/1758/head` is
     * that same thing on a second ref. The folding is `strandsIn` in
     * `src/domain/strand.ts`.
     *
     * A repository with no runs comes back empty rather than failing. This read does
     * not claim to tell an empty list from a page that has stopped looking like their
     * list, because nothing on the page distinguishes the two, and a screen that says
     * "no runs" beside a way back to GitHub is right either way.
     */
    readonly strands: (reference: RepoRef) => Effect.Effect<ReadonlyArray<Strand>, GatewayError>

    /**
     * The same list as it was last read, without asking GitHub.
     *
     * Worth more here than on a run: this is the page a reader comes back to between
     * runs, and a list that paints at once and corrects itself reads as a list that
     * never left.
     */
    readonly rememberedStrands: (
      reference: RepoRef
    ) => Effect.Effect<Option.Option<ReadonlyArray<Strand>>, GatewayError>

    /**
     * Every Version on the first page of a repository's releases list.
     *
     * One document, and this one is generous where their Actions list is: the notes come
     * complete in the markup, so the truncation eight readers called misleading in
     * [#5962](https://github.com/orgs/community/discussions/5962) is a CSS rule this screen
     * simply does not carry over. Measured on 2026-08-14, `oven-sh/bun` ships a 3,719
     * character body and the words "Read more" appear nowhere in the document.
     *
     * The first page only, which is ten Versions and the page their own tab opens with.
     *
     * A repository with no releases comes back empty rather than failing, as one with no
     * runs does, and for the same reason: nothing on the page tells an empty list from a
     * page that has stopped looking like their list, and a screen that says so beside a way
     * back to GitHub is right either way.
     */
    readonly releases: (
      reference: RepoRef
    ) => Effect.Effect<ReadonlyArray<Version>, GatewayError>

    /**
     * The files of one Version, which their list page names nowhere.
     *
     * A second request, and the only one this screen needs: that same 389,330 byte document
     * carries zero filenames, because every asset list sits behind an `include-fragment` at
     * `/releases/expanded_assets/{tag}`. Asked for one tag rather than ten, since Yours is
     * about the newest Version, so the whole screen is two requests where their own page
     * spends eleven.
     *
     * Comes back with the Source Archives beside the Builds and never among them. GitHub
     * appends a zip and a tarball nobody uploaded and nobody can remove, which is
     * [#6003](https://github.com/orgs/community/discussions/6003) at 143 upvotes and curl's
     * maintainer reporting that readers take those instead of the real files.
     */
    readonly builds: (
      reference: RepoRef,
      tag: string
    ) => Effect.Effect<Attached, GatewayError>

    /**
     * The same list as it was last read, without asking GitHub.
     *
     * Worth as much here as on the Actions tab, and for a reason of this page's own: a
     * reader who came to download something is a reader with no patience for a spinner.
     */
    readonly rememberedReleases: (
      reference: RepoRef
    ) => Effect.Effect<Option.Option<ReadonlyArray<Version>>, GatewayError>

    /**
     * One page of a repository's discussions, out of the document GitHub serves it as.
     *
     * One request, and it is scraping rather than a choice: their discussions list is the last
     * large page on github.com still rendered by Rails end to end. Measured on 2026-09-03,
     * `vercel/next.js/discussions` is 547,066 bytes with two React partials in it, the marketing
     * header and the keyboard-shortcuts dialog, and neither holds a row. There is no payload to
     * decode and no persisted query on the page to borrow.
     *
     * One {@link DiscussionList} and not four arguments, because that type already is the four:
     * where they live, the category their sidebar links rather than queries, the search carried
     * through untouched the way `issueSearch` carries theirs, and the page. `listRouteOf` turns
     * it into the address, and the store is keyed by the same string, so a category and a search
     * can never be handed each other's rows.
     */
    readonly discussions: (list: DiscussionList) => Effect.Effect<FoundDiscussions, GatewayError>

    /**
     * The same page as it was last read, without asking GitHub.
     *
     * Worth what it is worth on the Actions and Releases tabs. What it is not is a way of
     * skipping the read: a discussion answered a minute ago is a row that has to change colour,
     * and the whole point of this screen is which rows are stuck.
     */
    readonly rememberedDiscussions: (
      list: DiscussionList
    ) => Effect.Effect<Option.Option<FoundDiscussions>, GatewayError>

    /**
     * One discussion, whole, out of the document GitHub serves it as.
     *
     * One request, where their own page is one and then a dozen more: measured on 2026-09-03,
     * `vercel/next.js/discussions/70178` is 396,008 bytes carrying nine comments, and the menu
     * beside each of those comments is a route of its own that is asked for when it is opened.
     *
     * Fails rather than answering with nothing where the document is not a discussion. A page
     * this cannot read is a page the screen has to hand back to GitHub, and a snapshot with no
     * title and no body would be drawn over the top of whatever they really sent.
     */
    readonly discussion: (
      reference: DiscussionRef
    ) => Effect.Effect<DiscussionSnapshot, GatewayError>

    /**
     * The discussion as it was the last time it was read, without asking GitHub.
     *
     * What the screen paints with while the live read is in the air. Worth less here than on a
     * list and still worth having: the body and the first comments rarely change, and the fact
     * that does change is the one this screen is about.
     */
    readonly rememberedDiscussion: (
      reference: DiscussionRef
    ) => Effect.Effect<Option.Option<DiscussionSnapshot>, GatewayError>

    /**
     * One of the four things a reader does to a discussion, and the discussion back.
     *
     * Every one of them goes the way a pull request's comment box goes: GitHub's own form is on
     * the page, and this sends it back with whatever the reader typed added to it. Their page is
     * Rails, so the token is signed for that render of that form and cannot be minted — which is
     * a constraint of the platform and not a shortcut, since the extension is standing on the
     * page the form was rendered into.
     *
     * Fails where the form is not there, which is what a reader who is not signed in gets, and
     * what a locked discussion or an archived repository gets. The screen offers no control in
     * those cases; this refusal is the second gate rather than the first.
     *
     * Answers with the discussion read again rather than with what the write returned. Their
     * answer to one of these is a page or a fragment of one, and parsing a comment out of either
     * would be a second scraper to keep. One read is cheaper than being wrong.
     */
    readonly pressDiscussion: (
      reference: DiscussionRef,
      press: DiscussionPress
    ) => Effect.Effect<DiscussionSnapshot, GatewayError>

    /**
     * Everything else GitHub offers on one thing, in their own words.
     *
     * Close, lock, edit, delete, report and whatever they ship next are one menu behind one
     * button, and none of it is in the page: their markup carries an `include-fragment` per
     * comment whose `src` serves it, loaded when somebody opens it. This asks for that route.
     *
     * Asked for when a reader opens the menu rather than when the discussion is read, because
     * that is when their own page asks and because a discussion with thirty comments would
     * otherwise be thirty-one requests to draw.
     *
     * What comes back is a list of their sentences, and nothing else. This codebase learns none
     * of their names for these actions, so it cannot be wrong about one and cannot go stale when
     * the list changes.
     */
    readonly discussionDoings: (
      reference: DiscussionRef,
      on: "Discussion" | "DiscussionComment",
      id: string
    ) => Effect.Effect<ReadonlyArray<Doing>, GatewayError>

    /**
     * Every Notice in the reader's inbox, out of one fetch of their own page.
     *
     * The lightest read on this interface, and it is the only one where that is GitHub's
     * doing rather than ours: their `/notifications` is Rails-rendered, so the document
     * served at that address already carries every row's reason, read state, subject state
     * and write forms. Measured on 2026-08-13 — there is no `react-app`, no `turbo-frame`
     * and no `include-fragment` behind the list, so there is nothing to ask for twice.
     *
     * A {@link WorkingSetError} and not a {@link GatewayError}, for the reason
     * {@link issueSearch} takes one: there is no repository to name. An inbox is about the
     * Participant, and a failure here is "your notifications could not be read".
     *
     * An empty inbox comes back empty rather than failing, as a repository with no runs
     * does, and for the same reason: nothing on the page tells an inbox with nothing in it
     * from a page that has stopped looking like their inbox, and a screen that says so
     * beside a way back to GitHub is right either way.
     */
    readonly notices: (
      /**
       * Their own query, or nothing for the inbox as they open it.
       *
       * Passed through rather than built here so that a reader who arrives on a link with
       * `?query=is:unread` on it is shown the rows that link asked for. This screen adds no
       * query of its own: it groups, and a filter of ours on top of one of theirs would be
       * two sets of controls disagreeing about what is on the screen.
       */
      query: string
    ) => Effect.Effect<ReadonlyArray<Notice>, WorkingSetError>

    /**
     * The same inbox as the last visit left it, without asking GitHub.
     *
     * Worth more here than on any list yet. An inbox is the page a reader opens first and
     * comes back to all day, and their own takes most of a second to serve.
     */
    readonly rememberedNotices: (
      query: string
    ) => Effect.Effect<Option.Option<ReadonlyArray<Notice>>>

    /**
     * Carries out one of the presses GitHub put in a Notice's own row.
     *
     * The whole {@link Press} and not a kind, because the route and the token are on the
     * form GitHub served and every one of the six on a row carried a different token. This
     * takes what was read rather than rebuilding it, so a press cannot be made up for a row
     * that does not offer it.
     *
     * Nothing comes back. Their server answers a mark with the row's own markup, and the
     * screen showed the new state the moment the reader pressed.
     */
    readonly pressNotice: (press: Press) => Effect.Effect<void, WorkingSetError>

    /**
     * One page after the first of a person's repositories tab.
     *
     * After the first, because the first needs no request at all: their tab is
     * Rails-rendered and the served document holds thirty rows complete, so the screen
     * reads the page it is standing in. This is what the groups need to be true — a
     * reader with 154 repositories has five pages of them, and a Moving group counted
     * over the first thirty is a wrong answer confidently drawn.
     *
     * A {@link WorkingSetError} rather than a {@link GatewayError}, as an inbox takes:
     * there is no repository to name. This read is about a person.
     *
     * The narrowing goes back exactly as the address carried it, which is what
     * `tabRoute` in `src/domain/person.ts` builds. Their own controls write `type`,
     * `language` and `sort`, and this screen has no opinion about any of them: the rows
     * that arrive are the rows the reader's address asked for, and the grouping happens
     * over whatever came.
     *
     * Comes back empty rather than failing where the page holds no rows, as every other
     * list here does. Nothing on the page tells an account that has run out of
     * repositories from a page that has stopped looking like their list.
     */
    readonly personRepositories: (
      login: string,
      page: number,
      /** `narrowing` from the address, `page` excepted. See `PersonPage`. */
      narrowing: string
    ) => Effect.Effect<Listing, WorkingSetError>

    /**
     * The column down the left of a person's page: their face, their bio, their counts.
     *
     * Free on a page GitHub served, and this is not that case. A press from an issue to
     * the author's profile loads no document — the screen stands on the issue's markup —
     * so their card is not on the page and never will be. This is the same read over the
     * network, and it is what a pointer resting near the link starts.
     *
     * Nothing where the account has no such column, which is how an organisation is
     * refused: `/microsoft` is one path segment like anybody's login, and the proof that
     * it is a person's page is the card itself.
     */
    readonly person: (
      login: string,
      /** The repositories tab's filter, which is the address their card is read from. */
      narrowing: string
    ) => Effect.Effect<Option.Option<Person>, WorkingSetError>

    /** Their column as it was last read, for the frame before the live read lands. */
    readonly rememberedPerson: (login: string) => Effect.Effect<Option.Option<Person>>

    /**
     * Everything about a repository that is neither its files nor its README.
     *
     * Asked for beside the commit column and drawn when it lands. Nothing on the
     * front page waits for it.
     */
    readonly standing: (reference: RepoRef) => Effect.Effect<Standing, GatewayError>

    /**
     * Every path in the repository, at one commit.
     *
     * The whole tree in one answer, which is what a tree of folders needs and
     * what the page payload does not carry: that holds the root directory only.
     * Asked by commit rather than by branch, because their route refuses a
     * branch name.
     */
    readonly treePaths: (
      reference: RepoRef,
      sha: string
    ) => Effect.Effect<ReadonlyArray<string>, GatewayError>

    /**
     * One file of the repository, for the pane beside the tree.
     *
     * Read on the branch the address named, because a path means nothing without
     * one: the same path is a different file on two branches.
     */
    readonly fileAt: (
      reference: RepoRef,
      branch: string,
      path: string
    ) => Effect.Effect<Opened, GatewayError>

    /**
     * One file as its own text, and nothing else.
     *
     * The same file {@link fileAt} answers with, at a hundredth of the cost:
     * five kilobytes of markdown against the three hundred their page for it
     * spends on a rendering, a symbol table and a layout. That is the whole
     * reason it exists, and the reason the README on a front page can be parsed
     * here rather than taken as their HTML.
     *
     * No rendering comes with it, so the caller must have a parser. The pane
     * beside the tree wants their rendering as well and keeps to `fileAt`.
     */
    readonly rawFileAt: (
      reference: RepoRef,
      branch: string,
      path: string
    ) => Effect.Effect<string, GatewayError>

    /**
     * One file's blame: every range, the commit each one names, and the
     * file's own lines to draw beside it. See `docs/spec/blame.md`.
     */
    readonly blameAt: (
      reference: RepoRef,
      branch: string,
      path: string
    ) => Effect.Effect<Blamed, GatewayError>

    /**
     * Star a repository, or take the star back.
     *
     * Said as where the reader wants to end up rather than as a thing to do, so
     * a button pressed twice quickly cannot leave the star inverted: the second
     * press names the same destination the first did.
     */
    readonly star: (reference: RepoRef, to: Starring) => Effect.Effect<void, GatewayError>
    /**
     * What last touched each entry of a tree, for the column beside it.
     *
     * The one request this page spends beyond the payload it arrived with, and the
     * one their own page spends here too: eight kilobytes and 234 milliseconds for
     * a repository of thirteen entries, measured. Asked about a commit rather than
     * a branch, so that a column drawn against one tree can never describe another.
     * A folder below the root is a second ask of the same route, because it answers
     * one directory at a time and names its children relative to it.
     */
    readonly treeCommits: (
      reference: RepoRef,
      sha: string,
      folder?: string
    ) => Effect.Effect<ReadonlyMap<string, Touch>, GatewayError>
    /**
     * Who wrote one commit, for the face beside a row of that column.
     *
     * The route above names nobody, so this is asked once per unique commit
     * behind it. Its own route rather than {@link commit}, which answers the
     * whole diff to say one login: two kilobytes against twenty-eight on this
     * repository and three hundred and ninety on `facebook/react`, measured.
     *
     * Nothing where nobody is named, which is a row that keeps its message, its
     * age and its link and loses only the face.
     */
    readonly whoTouched: (
      reference: RepoRef,
      sha: string
    ) => Effect.Effect<Option.Option<TouchWho>, GatewayError>
    /**
     * The front page as it was last read, without asking GitHub.
     *
     * Everything but the README, which is deliberately dropped before this is
     * kept. It is three hundred kilobytes on a repository worth reading and the
     * route store holds twenty-four entries of a couple of kilobytes each, so
     * keeping it would spend seven megabytes to save one request and would slow
     * every other read out of that store. The tree, the branch and the footing are
     * what make the page appear at once; the welcome arrives with the live read a
     * moment later.
     */
    readonly rememberedRepoHome: (
      reference: RepoRef,
      branch: string | null
    ) => Effect.Effect<Option.Option<Front>, GatewayError>
    /**
     * The facts their own commit list defers, for the page it just answered.
     *
     * A second read rather than part of the first, because that is what it is at
     * GitHub: a check rollup is a query per commit, and forty of them in front of
     * the list would put a second on every page. The route is handed in rather
     * than built, since theirs repeats the page's cursor — see {@link History.rest}.
     */
    readonly commitMarks: (
      reference: RepoRef,
      route: string
    ) => Effect.Effect<Marks, GatewayError>
    /**
     * The same page as it was last time, where this browser has read it before.
     *
     * The list only. The marks are deliberately not kept — a green tick out of the
     * store is drawn identically whether it is a second or a day old, and a branch
     * that has gone red since would look tested and clear.
     */
    readonly rememberedCommits: (
      list: CommitList
    ) => Effect.Effect<Option.Option<History>, GatewayError>
    /**
     * How big one commit is: the files it touched, and the lines it moved.
     *
     * One commit at a time because GitHub offers no other shape. Their list says
     * nothing about size, their deferred route — which exists to fill in exactly
     * this kind of gap — sends checks and signatures instead, and the numbers sit
     * at the top of a commit page that weighs a hundred and thirty kilobytes. So
     * this reads the commit's own diff, which is the same answer at a seventh of
     * the weight, and the caller decides which rows are worth asking about.
     *
     * Nothing where the diff is past the point of being worth counting; see
     * `MOST_DIFF`. Nothing is drawn as no size, never as a size of zero.
     */
    readonly commitStat: (
      reference: RepoRef,
      sha: string
    ) => Effect.Effect<Option.Option<Stat>, GatewayError>
    /**
     * Every size this browser already knows, for a page of commits at once.
     *
     * The one thing kept here that cannot go stale: a sha is a hash of the diff,
     * so a commit's size read once is its size for ever. A branch visited twice
     * draws its numbers on the first frame and asks GitHub for nothing.
     */
    readonly rememberedStats: (
      shas: ReadonlyArray<string>
    ) => Effect.Effect<Stats, GatewayError>
    /**
     * Every branch the repository has, for the picker on the commits page.
     *
     * One read for all of them, because their own route offers no other shape:
     * it accepts a query and ignores it. So a picker narrows what it was given
     * rather than asking again on every keystroke, which is also what makes the
     * list worth keeping between visits.
     */
    readonly branchesOf: (
      reference: RepoRef
    ) => Effect.Effect<ReadonlyArray<string>, GatewayError>
    /** The same list as the last visit read it, so the picker opens full. */
    readonly rememberedBranchesOf: (
      reference: RepoRef
    ) => Effect.Effect<Option.Option<ReadonlyArray<string>>, GatewayError>
    /**
     * Everybody who has written a commit here, for the author filter.
     *
     * Their own page defers this too, and for the same reason it defers the
     * check rollups: it is a question about the whole repository asked beside a
     * list of thirty-five commits.
     */
    readonly authorsOf: (
      reference: RepoRef
    ) => Effect.Effect<ReadonlyArray<Participant>, GatewayError>
    /** The same list as the last visit read it, so the filter opens full. */
    readonly rememberedAuthorsOf: (
      reference: RepoRef
    ) => Effect.Effect<Option.Option<ReadonlyArray<Participant>>, GatewayError>
    /**
     * Merges the pull request, the way their own merge button does.
     *
     * The only call here that changes anything at GitHub, and the only one
     * whose failure a reader has to be told about: everything else can be
     * retried by looking again.
     */
    /**
     * Writes a comment against some lines, the way their own box does.
     *
     * Posted at once rather than held as part of a review: a remark typed into
     * a diff is a remark meant to be read, and a batch that has to be submitted
     * somewhere else is how comments end up sitting unsent for a day.
     */
    readonly comment: (
      reference: PullRequestRef,
      note: NewComment
    ) => Effect.Effect<ReviewThread, GatewayError>
    /**
     * Says something about the pull request itself, hung on no line.
     *
     * Apart from {@link comment} because they are two different things and GitHub
     * keep them on two routes: a remark on a line starts a thread with a place in
     * the diff and something to resolve, and this one starts nothing and replies
     * to nobody — "rebased onto main", "screenshots in the description", "this can
     * wait until Monday". Most of what is said on a pull request is this, and until
     * now it was the one thing a reader had to leave for GitHub's page to say.
     */
    readonly remark: (
      reference: PullRequestRef,
      body: string
    ) => Effect.Effect<Remark, GatewayError>
    /**
     * Marks one thread resolved, which is the act that ends a finding.
     *
     * The id is the thread's own, as the snapshot carries it: GitHub's route
     * wants the number their page data is keyed by, not the node id their public
     * API answers with.
     *
     * Named for the Court a resolved thread lands in. Counted over twenty pull
     * requests of `octo-org/octo-repo`, a person closed 50 of the 67
     * findings somebody had answered, against 12 the machine came back for — so
     * this is the ordinary end of a finding rather than a tidy-up, and it was
     * the one step of answering one that the reader had to leave for their page.
     */
    readonly settle: (
      reference: PullRequestRef,
      threadId: string
    ) => Effect.Effect<void, GatewayError>
    /**
     * Opens a resolved thread again, which is the other half of resolving one.
     *
     * A reader who resolved the wrong thread with one press should need one press to put it
     * back, rather than a trip to their page to find the button that does it.
     */
    readonly unsettle: (
      reference: PullRequestRef,
      threadId: string
    ) => Effect.Effect<void, GatewayError>
    /**
     * Answers inside a thread that is already there, and says what it holds now.
     *
     * Addressed to a comment rather than to the thread: their route takes `inReplyTo` and a
     * thread id there is refused. See `replying.md`.
     */
    readonly reply: (
      reference: PullRequestRef,
      commentId: string,
      body: string
    ) => Effect.Effect<ReadonlyArray<ThreadComment>, GatewayError>
    /**
     * Says what the reader thinks of it, the way their review dialog does.
     *
     * One call for all three verdicts because GitHub has one route for them,
     * and because approving and asking for changes differ only in which word
     * is sent: a reader who has finished reading should not have to find a
     * different button depending on the answer.
     */
    readonly review: (
      reference: PullRequestRef,
      review: Review
    ) => Effect.Effect<void, GatewayError>
    readonly merge: (
      reference: PullRequestRef,
      method: MergeMethod
    ) => Effect.Effect<void, GatewayError>
    /**
     * Lands a layer of a stack, and everything unmerged below it, in one press.
     *
     * Separate from {@link merge} because GitHub keeps the two routes apart and
     * each refuses the other's pull request — with the same sentence, saying
     * the branch is out of date, which is true of neither. So this is a choice
     * the caller makes from the merge state rather than a retry: whether there
     * is a stack at all is `merge.stack`, and what the press takes with it is
     * `wouldLand` in the domain.
     *
     * The whole group lands or none of it does, bottom layer first, and the
     * layers above stay open and re-target the stack's base.
     */
    readonly mergeStack: (
      reference: PullRequestRef,
      method: MergeMethod
    ) => Effect.Effect<void, GatewayError>
    /**
     * Makes the stack GitHub offers to make out of this pull request.
     *
     * The write behind their own "Create stack", and the other end of the
     * proposal on {@link PullRequestSnapshot.proposal}: that is the chain one
     * press would make, and this is the press. After it there is no proposal
     * left — their preview route answers `null` on a pull request already in a
     * stack — and `merge.stack` carries the layers instead.
     *
     * Takes the pull request and nothing else, although the route takes a list
     * of them. Which pull requests are in the chain is GitHub's answer rather
     * than the caller's, and it is read inside the write, so a strip that has
     * been on the screen for ten minutes cannot make a stack out of the chain
     * as it stood then.
     *
     * Refused where GitHub has stopped offering one, without writing anything.
     * Somebody else pressing first looks exactly like that.
     */
    readonly makeStack: (reference: PullRequestRef) => Effect.Effect<void, GatewayError>
    /**
     * Puts it in the queue, on the repositories that land through one.
     *
     * Their own route for this is `enable_auto_merge`, which on a queue
     * repository takes neither a merge method nor a commit message: `GROUP` or
     * `SOLO`, and GitHub does the rest when this pull request's turn comes.
     */
    readonly enqueue: (
      reference: PullRequestRef,
      how: QueueMethod
    ) => Effect.Effect<void, GatewayError>
    /** Takes it back out of the queue, which is a route of its own. */
    readonly dequeue: (reference: PullRequestRef) => Effect.Effect<void, GatewayError>
    /**
     * Calls off a merge GitHub is holding.
     *
     * Undoes {@link enqueue} on a repository with a queue and an ordinary
     * auto-merge on one without, because to GitHub those were the same request.
     */
    readonly cancelAutoMerge: (reference: PullRequestRef) => Effect.Effect<void, GatewayError>
    /**
     * Brings the branch up to date with the one it would land on.
     *
     * `MERGE` puts the base into the branch and always works; `REBASE` rewrites
     * the branch and often cannot. Which is asked for is GitHub's own verdict,
     * read off the pull request, rather than a choice made here.
     */
    readonly updateBranch: (
      reference: PullRequestRef,
      how: UpdateMethod
    ) => Effect.Effect<void, GatewayError>
    /**
     * Closes it without merging, the way their own button at the foot of the
     * conversation does.
     *
     * Nothing is lost by it — a closed pull request keeps its branch, its
     * comments and its diff, and GitHub will reopen it — but it is still the
     * one control here that ends the reading, so its refusals are worth
     * repeating word for word.
     */
    readonly close: (reference: PullRequestRef) => Effect.Effect<void, GatewayError>
    /**
     * Opens a closed one again, which is the undo the sentence above promises.
     *
     * GitHub refuses where the head branch has been deleted since, and says so
     * in the same shape as the rest of these, so nothing here treats it as a
     * different kind of no.
     */
    readonly reopen: (reference: PullRequestRef) => Effect.Effect<void, GatewayError>
    /**
     * Takes it out of draft, which is the whole of what a draft is stopping.
     *
     * GitHub refuses to merge a draft and says so as a condition about the
     * pull request's state, so this is the one write here that turns a blocker
     * into no blocker rather than changing what is being reviewed.
     */
    readonly markReady: (reference: PullRequestRef) => Effect.Effect<void, GatewayError>
    /** Puts it back, for a pull request opened before it was meant to be read. */
    readonly toDraft: (reference: PullRequestRef) => Effect.Effect<void, GatewayError>
    /**
     * Deletes the branch this pull request was made from.
     *
     * The only write here that touches something outside the pull request, and
     * the one to be careful about offering: the pull request keeps its diff and
     * its comments either way, but the branch is a thing other work may be
     * standing on. Whether to offer it at all is `headRef.mayDelete` on the
     * snapshot, which is GitHub's own answer rather than an inference from the
     * state — a repository that deletes head branches on merge by itself has
     * already done this before anybody looks.
     *
     * GitHub will put a deleted branch back, from their own page, for as long as
     * they keep the commits. This does not, so the press asks twice.
     */
    readonly deleteBranch: (reference: PullRequestRef) => Effect.Effect<void, GatewayError>
    /**
     * One shelf of the Participant's Working Set.
     *
     * A shelf at a time because that is how GitHub serves them — six routes,
     * one per grouping — and because it is what makes the Court free: GitHub
     * has already decided which pull requests belong on which, so nothing here
     * has to work it out from checks and reviews.
     *
     * The rows arrive without check or review state. {@link standingsFor} is
     * the other half, and a row is worth drawing before it has arrived.
     */
    readonly workingSet: (
      shelf: Shelf
    ) => Effect.Effect<ReadonlyArray<InvolvedPullRequest>, WorkingSetError>
    /**
     * One shelf as it was the last time it was read, without asking GitHub.
     *
     * The list's half of {@link remembered}, and it cannot fail for the same
     * reasons: no store, an entry from an older build, a payload GitHub has
     * since changed all mean the network is the only way to find out.
     */
    readonly rememberedShelf: (
      shelf: Shelf
    ) => Effect.Effect<Option.Option<ReadonlyArray<InvolvedPullRequest>>>
    /**
     * One page of GitHub's own pull request search, for any query.
     *
     * How a repository's list is read, since that page is rendered rather than
     * served and refuses to be asked for JSON at all. This route answers about
     * repositories the reader has never touched, which is the whole reason a
     * repository's list can be shown from it — but it shelves nothing, so its
     * rows arrive on no shelf and their Court has to be concluded rather than
     * read.
     *
     * Paged because GitHub pages it: twenty-five rows, however many there are.
     */
    readonly search: (
      query: string,
      page: number
    ) => Effect.Effect<Found, WorkingSetError>
    /** The same page as it was last time, from the store, or nothing. */
    readonly rememberedSearch: (
      query: string,
      page: number
    ) => Effect.Effect<Option.Option<Found>>
    /**
     * How the checks and reviews stand, for pull requests already listed.
     *
     * Keyed by GitHub's numeric id, which is the only thing their route accepts
     * and the reason {@link InvolvedPullRequest} carries one. Batched: their own
     * dashboard asks about nine at a time, and asking per pull request would
     * undo the whole point of a listing that costs two requests.
     */
    readonly standingsFor: (
      ids: ReadonlyArray<string>
    ) => Effect.Effect<Standings, WorkingSetError>
    /**
     * The two branch names a stack is found by matching.
     *
     * Its own read because the Working Set needs them and its rows do not carry
     * them: GitHub's list routes send neither branch, and `stackPosition` comes
     * back null even on a real three-deep chain. The merge box is asked rather
     * than the changes route because both know them and only this one is cheap.
     *
     * None where the payload left them out, which is one row drawn flat rather
     * than a Working Set that would not load.
     */
    readonly branches: (
      reference: PullRequestRef
    ) => Effect.Effect<Option.Option<Branches>, GatewayError>
    /**
     * How this pull request would land, for a surface that has not read a merge box.
     *
     * One read, made when the reader presses rather than for every row on the way
     * in. Why a row cannot answer this for itself is on `mergeAsTheRepositoryDoes`.
     */
    readonly howToMerge: (
      reference: PullRequestRef
    ) => Effect.Effect<
      { readonly method: Option.Option<MergeMethod>; readonly stacked: boolean },
      GatewayError
    >
    /**
     * How many lines one listed pull request changes.
     *
     * A read per row, because GitHub has no batch for it — and affordable all the
     * same at seventy bytes an answer, where the changes route carries the same
     * two numbers under three quarters of a megabyte of the diffs behind them.
     */
    readonly sizeOf: (reference: PullRequestRef) => Effect.Effect<Size, GatewayError>
    /**
     * The stacks and the sizes already known about these rows, from the store.
     *
     * {@link branches} and {@link sizeOf} are a read per row and several seconds
     * for a page of them, and they are what a list is missing when it is drawn
     * from memory: rows with no stacks and no sizes, filling in afterwards, which
     * reads as a list still loading rather than as the list that was just there.
     * Every one of them is kept as it lands, and this is all of them in one read.
     *
     * Cannot fail, for the same reasons the other remembered reads cannot: no
     * store, an entry from an older build, a browser that took the permission
     * away — all of them mean the same thing, which is that the live read is the
     * only way to find out.
     */
    readonly rememberedRows: (
      rows: ReadonlyArray<{ readonly id: string; readonly reference: PullRequestRef }>
    ) => Effect.Effect<RememberedRows>
    /**
     * Who somebody is, as their own hovercard tells it.
     *
     * `about` is the thing being looked at, which changes what the card says: given
     * a repository it swaps the organisations they belong to for how recently they
     * touched *this* repository, which is the more useful of the two beside a row
     * in its pull request list.
     *
     * None for a login with no profile page. An app is the ordinary case of that —
     * `dependabot[bot]` answers 404 — so it is an answer rather than a failure.
     */
    readonly portrait: (
      login: string,
      about: Option.Option<string>
    ) => Effect.Effect<Option.Option<Portrait>, WorkingSetError>
    /**
     * How much somebody has done on GitHub in the last year.
     *
     * Apart from {@link portrait} because it is a second read of a much larger
     * page, and a card that waited for it would be a card that arrived late for
     * the sake of its last line.
     *
     * None for a login with no calendar, an app again being the ordinary case.
     */
    readonly contributions: (
      login: string
    ) => Effect.Effect<Option.Option<number>, WorkingSetError>
    /**
     * Every repository the Participant has.
     *
     * The whole list rather than a page of it, because the whole list is what one read
     * gives: their own filter route answered with 154 in 44 kilobytes on a live account, so
     * narrowing it is typing rather than another request. Which is also the answer to the
     * complaint underneath the Repositories Destination — their sidebar shows ten by a rule
     * nobody can predict, and ten of 154 is a list you search by remembering.
     *
     * Not ranked here. Their route says nothing about when anything was last pushed, and
     * inventing an order in the adapter would put a guess where the domain can put a rule.
     */
    readonly repositories: () => Effect.Effect<ReadonlyArray<Repository>, WorkingSetError>
    /** The same list as it was last time, from the store, or nothing. */
    readonly rememberedRepositories: () => Effect.Effect<
      Option.Option<ReadonlyArray<Repository>>
    >
    /**
     * What happened elsewhere, in the order it happened.
     *
     * Built from GitHub's events rather than from their feed, and the difference is the
     * whole point: their feed route answers with follows, merged pull requests, trending
     * repositories and recommendations, and with no pushes at all, while the events for the
     * same account in the same minute were two thirds pushes. Ranking is what this undoes.
     *
     * The one read here that is not one of their internal routes, and the reason is that
     * they have retired every internal one that answered chronologically. It needs no
     * token and no cookie, which also means no private repository appears in it: an
     * Activity that is honestly public is worth more than one that needs a token this
     * extension has nowhere to keep.
     */
    readonly activity: (
      login: string,
      /**
       * Which index the answer is kept in, and it matters which.
       *
       * The viewer's own events are one of the eleven routes Home is built from, so they
       * are kept in the small index nothing can evict. A stranger's are a page somebody
       * went to: kept there instead, they would push a shelf out of Home every fifth
       * profile a reader opened. See `Keeping` in `src/github/cache.ts`.
       */
      keeping?: "standing" | "browsed"
    ) => Effect.Effect<ReadonlyArray<Happening>, WorkingSetError>
    /** The same events as last time, from the store, or nothing. */
    readonly rememberedActivity: (
      login: string
    ) => Effect.Effect<Option.Option<ReadonlyArray<Happening>>>
    /**
     * The issues the Participant authored, was assigned, or was mentioned in.
     *
     * One involvement per read, because that is the only way GitHub will be asked:
     * there are shelves for pull requests and nothing of the kind for issues, only a
     * search that answers whatever query it is handed. Which question was asked is
     * therefore the fact the Court is decided from, and it is why the involvement is
     * an argument here rather than something a row could carry.
     *
     * The open ones only, for the same reason a shelf holds open pull requests: a
     * list of what is owed is not a list of what has been dealt with.
     */
    readonly involvedIssues: (
      involvement: Involvement
    ) => Effect.Effect<ReadonlyArray<InvolvedIssue>, WorkingSetError>
    /** The same issues as last time, from the store, or nothing. */
    readonly rememberedInvolvedIssues: (
      involvement: Involvement
    ) => Effect.Effect<Option.Option<ReadonlyArray<InvolvedIssue>>>
    /**
     * One issue, whole: the body, everyone who spoke, and what the reader may do
     * about it.
     *
     * One request, unlike a pull request's six. GitHub serves their issue page
     * from a single persisted GraphQL query, and this asks the same one their own
     * page asks — which is also the one thing here that can fail for a reason no
     * other read has. A persisted query is named by a hash GitHub mints per
     * deploy and refuses without, so a reader who arrives on an issue before this
     * extension has seen that hash is answered `not-recorded` rather than kept
     * waiting.
     */
    readonly issue: (reference: IssueRef) => Effect.Effect<IssueSnapshot, GatewayError>
    /**
     * The issue as it was the last time it was read, without asking GitHub.
     *
     * The same bargain as {@link remembered} for a pull request: worth showing
     * for the half second before GitHub replies, and never worth resting on.
     */
    readonly rememberedIssue: (reference: IssueRef) => Effect.Effect<Option.Option<IssueSnapshot>>
    /**
     * One page of GitHub's own issue search, for any query.
     *
     * How a repository's issue list is read, and the counterpart of
     * {@link search} beside it. Their issues page is a React app served from a
     * persisted GraphQL query; this route answers the same question with rows
     * anything can read, and is asked for exactly as a shelf is.
     *
     * No involvement, unlike {@link involvedIssues}. That read asks three
     * questions that each name the reader and files the answers into Courts;
     * this one asks about a repository, and the rows come back saying nothing
     * about the reader's part in any of them.
     *
     * Paged because GitHub pages it: ten rows, however many there are.
     */
    readonly issueSearch: (
      query: string,
      page: number
    ) => Effect.Effect<FoundIssues, WorkingSetError>
    /** The same page as it was last time, from the store, or nothing. */
    readonly rememberedIssueSearch: (
      query: string,
      page: number
    ) => Effect.Effect<Option.Option<FoundIssues>>
    /**
     * Raises an issue, and answers with where it landed.
     *
     * The one write here that brings something into being. Everything else on
     * this interface changes a thing that already has an address, so a caller
     * that loses the answer can find out by looking again; this one is the
     * address, and a reader who typed six paragraphs into a box has nowhere to
     * look if it comes back empty.
     *
     * The heaviest write to reach, and the reason is that GitHub raise issues
     * through a persisted GraphQL mutation. A persisted operation is named by a
     * hash they hold, and a mutation is a POST — so unlike {@link issue}, whose
     * hash can be read off a request their page has already made, this one's
     * cannot be watched for at all and has to be found in their shipped
     * JavaScript. Where it is not there, the answer is `not-recorded`, exactly as
     * an issue read is, and it means the same thing: their page has moved and
     * theirs is the form to use.
     *
     * Takes a repository rather than an issue, obviously, and a
     * {@link Raising} rather than a title and a body, so that a form growing a
     * third field is not a change to this signature.
     */
    /**
     * Closes an issue, saying why, and puts a closed one back.
     *
     * The id is GitHub's own name for the issue rather than its number: their route for
     * this takes the one and refuses the other. It comes off the read — see `IssueSnapshot`
     * — so a page that can draw an issue can always close it.
     *
     * Nothing comes back. What GitHub echoes is the state and the reason that were just
     * sent, and the screen showed those the moment the reader pressed.
     */
    readonly settleIssue: (
      reference: IssueRef,
      id: string,
      settling: Settling
    ) => Effect.Effect<void, GatewayError>
    /** The same, the other way: a closed issue opened again. */
    readonly reopenIssue: (
      reference: IssueRef,
      id: string
    ) => Effect.Effect<void, GatewayError>
    /**
     * A comment on an issue, and the comment itself back.
     *
     * Handed back rather than dropped because their mutation returns it whole, rendering
     * included: the conversation shows the new comment as GitHub would draw it, and nothing
     * is read again to find out what was just written.
     */
    readonly sayOnIssue: (
      reference: IssueRef,
      id: string,
      body: string
    ) => Effect.Effect<Remark, GatewayError>
    readonly raise: (
      reference: RepoRef,
      draft: Raising
    ) => Effect.Effect<Raised, GatewayError>
  }
>()("GitHubGateway") {}

/**
 * The two ways into a merge queue.
 *
 * `GROUP` is what their own button sends: batched with whatever else is
 * waiting. `SOLO` asks to be tested and merged alone, and is a separate
 * permission.
 */
export type QueueMethod = "GROUP" | "SOLO"

/** The two ways of catching a branch up with its base. */
export type UpdateMethod = "MERGE" | "REBASE"

/**
 * The three things a reviewer can say when they are done reading.
 *
 * Hyphenated rather than spelled GitHub's way, which is `request changes`,
 * with a space, in lower case. Their wire spelling belongs no further in than
 * {@link eventFor}.
 */
export type Verdict = "approve" | "request-changes" | "comment"

/** A verdict, and what is being said with it. */
export type Review = {
  readonly verdict: Verdict
  readonly note: string
  /**
   * The commit being approved.
   *
   * GitHub records it so that an approval cannot be quietly inherited by
   * whatever is pushed next, which is why this is not optional: a verdict
   * without a commit is a verdict about a moving target.
   */
  readonly headSha: string
}
