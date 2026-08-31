import { Option } from "effect";
import { AUTH_CLASS, THE_WALL_BOX } from "../github/signOn";
import { fromPathname as commitIn } from "../domain/CommitRef";
import { commitListIn } from "../domain/commitList";
import { issueDashboardIn } from "../domain/issueDashboard";
import { issueListIn } from "../domain/issueList";
import { fromPathname as issueIn } from "../domain/issues";
import { noticesIn } from "../domain/notices";
import { isHome, showsWorkingSet } from "../domain/pages";
import { personReposIn, personStarsIn, profileIn } from "../domain/person";
import { fromPathname as pullRequestIn } from "../domain/PullRequestRef";
import { raisingIn } from "../domain/raising";
import { releasesIn } from "../domain/release";
import { repoHomeIn } from "../domain/repoHome";
import { runAddressIn } from "../domain/run";
import { actionsIn } from "../domain/strand";
import { THEIR_TABS } from "./theirTabs";

/**
 * Where on a GitHub page the interface goes, described per page.
 *
 * `mount.ts` is the machinery — wait for React to render the region, put the
 * container in it, hide what GitHub drew, put it back when React replaces the
 * region underneath us. None of that is particular to a pull request, but every
 * selector it used to hold was. A second page to take over meant either a second
 * copy of the machinery or this: the same machinery, told where it is.
 */
export type Place = {
  /**
   * Which interface this is, written onto the container it renders into.
   *
   * Two interfaces live in one document as a reader moves between them, and for a
   * moment both of their scripts are running. Without a name on the container the
   * second would adopt the first's element, and the two takeovers' observers would
   * then spend the rest of the page's life moving that one element back and forth
   * between their two regions — which wedges the tab.
   */
  readonly name: string;
  /**
   * Which addresses are this screen's, asked with a path and what followed it.
   *
   * Two things read it, and they used to be two different answers to one question. The shell
   * routes a press by it: which of these pages is the reader going to. And `mount.ts` holds a
   * takeover back by it: a screen may stand on the page only once the address is its own.
   *
   * That second one is the rule that was missing. A press starts the arriving screen a whole
   * second before the address moves, and the screen used to take the page the instant it had
   * somewhere to stand — which replaced the bar, and with it the very link the reader was
   * pressing. The release then landed on nothing, no address was pushed, and the reader was
   * left with one page's content under another page's address, for good.
   *
   * Required, so that a place added later cannot quietly answer neither question. Written with
   * the same parsers the screens read their own addresses with, never a second pattern: a
   * screen that disagreed with the shell about what its address is would be a screen the shell
   * fetches and the rule never lets stand.
   *
   * The search comes second and most places ignore it, because most of GitHub's pages are
   * told apart by a path. A person's three are not: the profile, their repositories and their
   * stars are one path and a `tab` parameter, so a place that read the path alone would claim
   * all three and the wrong screen would stand on two of them.
   */
  readonly owns: (path: string, search?: string) => boolean;
  /**
   * A selector that proves this page from its markup, for a page no address names.
   *
   * Absent from every place but the wall, and the wall is why it exists: GitHub
   * serves an organisation's single sign-on *in place of* the page that was asked
   * for and under that page's own URL, so there is no address for `owns` above to
   * answer, and `owns` says so by refusing every address.
   *
   * Two things read it, and both are the questions `owns` answers everywhere else.
   * `placeLoadedOn` routes a loaded document by it. And `mount.ts` takes it as the
   * address already being this screen's own — which it is, in the only sense that
   * rule cares about: no address is on its way, because the document in front of
   * the reader is already the page.
   *
   * A selector rather than a function, so this table stays a table. Written as
   * `found: mayBeTheWall` first, which made the file every page here is described
   * in import a DOM reader out of `github/` for the sake of one row.
   */
  readonly loadedWhen?: string;
  /**
   * The regions worth taking, best first. Only these are accepted while the
   * document is still parsing, because anything further up the tree is parsed
   * earlier and would always win.
   */
  readonly regions: ReadonlyArray<string>;
  /**
   * Where to go when none of {@link regions} ever appears: a worse place that is
   * still the right part of the page. Offered only once parsing is over, when
   * the absence of a region means something.
   */
  readonly fallback: string;
  /**
   * Bands elsewhere on the page that this interface replaces, hidden alongside
   * the region's own children. Empty where the region is the whole of it.
   */
  readonly bands: ReadonlyArray<string>;
  /**
   * Everywhere their content may be while ours is arriving, for the rules that
   * hide it. Defaults to {@link regions}.
   *
   * Not the same question as where to stand, which is why it is its own field. A
   * repository's list is rendered into `#repo-content-pjax-container` most of the
   * time and straight into its Turbo frame the rest of it, and a rule that knew
   * only the first left their list on the screen for a measured 587 milliseconds
   * while ours was on its way. Where to stand can be a preference; what to hide
   * cannot afford to be.
   */
  readonly stages?: ReadonlyArray<string>;
  /**
   * How to hide their page when GitHub swaps it in without loading a document,
   * or nothing where that never happens to this page.
   *
   * These rules ship with the script that runs on every GitHub page, because on
   * that path the interface's own stylesheet has not been delivered yet — that
   * delivery is a message to a worker which may be asleep, and how long it takes
   * is how long their page is on the screen.
   */
  readonly soft?: {
    /**
     * An ancestor that exists only on their version of this page.
     *
     * The gate is switched on at the press, while the page being left is still the
     * page on the screen. Waiting for something only the destination has is what
     * keeps a rule from blanking the page a reader is still reading.
     */
    readonly within?: string;
    /**
     * Added to each stage for the same reason, where an ancestor cannot say it:
     * `:has(.js-issue-row)` is a region that really holds their rows now.
     */
    readonly holding?: string;
  };
};

/**
 * A pull request: the region GitHub fills with the conversation, below their own
 * pull request header.
 *
 * The site header and the repository nav are left exactly as they are. Those are
 * how someone gets around GitHub, they already work, and replacing them would
 * only make this page stranger than the one beside it.
 *
 * Primer's class names carry a per-deploy hash — `prc-PageLayout-Content-BneH9`
 * today, something else next week — so these match on the part that is stable
 * and fall back to the whole repository content when the layout moves.
 */
export const CONVERSATION: Place = {
  name: "conversation",
  owns: (path) => Option.isSome(pullRequestIn(path)),
  regions: [
    'react-app[app-name="pull-requests"] [class*="PageLayoutContent"]',
    '[class*="PageLayoutContent"]',
  ],
  /*
   * The whole repository content, which is much further up the document and
   * therefore parsed long before the region it contains. That is why it is a
   * fallback and not a region: ask for either during parsing and the answer is
   * always this one, and the interface would take the entire repository content
   * on every single load while the code claimed to be replacing a conversation.
   */
  fallback: "#repo-content-pjax-container",
  /*
   * The region as GitHub names it, either way round. The whole repository content
   * is deliberately not here: it is somewhere ours may have to stand when their
   * conversation never appears, and hiding everything inside it on the way past
   * would take the repository's own page down with it.
   */
  stages: [
    'react-app[app-name="pull-requests"] [class*="PageLayoutContent"]',
    '[class*="PageLayoutContent"]',
  ],
  /*
   * Their pull request app, which exists on no other page — so this may be
   * switched on the moment a pull request is pressed, while the list is still on
   * the screen, without blanking the list on the way out.
   */
  soft: { within: 'react-app[app-name="pull-requests"]' },
  /*
   * Their header: title, state, branch chips, the corner buttons, and the
   * Conversation / Commits / Checks / Files changed row beneath them.
   *
   * All of it goes, because ours says the same things in one band instead of
   * four, and two headers one above the other make the reader work out which
   * page they are on before they can do anything.
   */
  bands: [
    '[class*="PullRequestHeader"]',
    THEIR_TABS,
    /*
     * Their banner offering to stack this pull request with the ones below it.
     *
     * A sibling of the header rather than a part of it, which is why the band above
     * leaves it standing: it lives in `PageLayout-Header` and it was the last piece
     * of GitHub's own page left over ours. Named by the label they give it, since
     * every class on it carries a per-deploy hash.
     *
     * Ours says the same thing above the header card and says which pull requests,
     * in what order, onto what branch. See `Proposed`. Two banners about one chain,
     * one of them a button that opens a dialog to answer what the other has already
     * drawn, is worse than either alone.
     */
    '[data-component="Banner"][aria-label="Can Stack Banner"]',
  ],
};

/**
 * A commit's own page — `/owner/repo/commit/<sha>`.
 *
 * The same region as a pull request, because GitHub renders both with the same
 * layout, and its own place all the same: the band above the diff is a different
 * element, nothing ever navigates here without loading a page, and a rule written
 * for one of these two pages must not fire on the other. Their commit header and a
 * pull request's title row sit in the same position, so a band named by layout
 * class alone would take the title off every pull request as well.
 */
export const COMMIT: Place = {
  ...CONVERSATION,
  name: "commit",
  owns: (path) => Option.isSome(commitIn(path)),
  /*
   * Where GitHub says the message, the parent and how many files changed above the
   * diff — all of which the panel below repeats.
   */
  bands: ['react-app[app-name="commits"] [class*="PageLayout-Header"]'],
  /*
   * Nothing: their own navigation between commits loads a page every time, so this
   * page is never swapped in under a reader.
   */
  soft: undefined,
};

/**
 * One issue — `/owner/repo/issues/N`.
 *
 * Their own container for the issue and everything said about it, named by
 * `data-testid` because that is the one hook on this page carrying no
 * per-deploy hash. Read off the live document rather than guessed.
 *
 * The content region only, as on a pull request. The repository's header and
 * its tab row are GitHub's to keep: somebody reading an issue still needs the
 * rest of the repository.
 */
export const ISSUE: Place = {
  name: "issue",
  owns: (path) => Option.isSome(issueIn(path)),
  regions: ['[data-testid="issue-viewer-container"]'],
  /*
   * The Turbo frame the region lives in. Further up the tree and therefore
   * parsed earlier, which is why it is a fallback rather than a second region:
   * offered during parsing it would win every time, and the interface would
   * take the whole repository content on every load.
   */
  fallback: "turbo-frame#repo-content-turbo-frame",
  stages: ['[data-testid="issue-viewer-container"]'],
  /*
   * Their issue app, which exists on no other page — so this may be switched on
   * the moment an issue is pressed, while the list is still on the screen,
   * without blanking the list on the way out.
   */
  soft: { within: 'react-app[app-name="issues-react"]' },
  // Nothing. The region is the title, the body and the conversation together.
  bands: [],
};

/**
 * The form for raising one — `/owner/repo/issues/new`.
 *
 * Their Turbo frame and not the pjax container the two lists prefer, because on
 * this page the container is not there at all: read off the live form on
 * 2026-08-05, where the title field's ancestors run input, twelve divs,
 * `react-app[app-name="issues-react"]`, the frame, `main`. Kept as a region all
 * the same, so that a soft navigation which does render into it is still
 * preferred to the frame around it.
 *
 * `/issues/new/choose` is deliberately not owned. That is a menu of template
 * files kept in the repository, and a reader who pressed it wants the template
 * rather than the blank box this screen would hand them instead — see
 * `src/domain/raising.ts`.
 */
export const RAISE: Place = {
  name: "raise",
  owns: (path) => Option.isSome(raisingIn(`https://github.com${path}`)),
  regions: [
    "#repo-content-pjax-container",
    "turbo-frame#repo-content-turbo-frame",
  ],
  fallback: "turbo-frame#repo-content-turbo-frame",
  stages: [
    "#repo-content-pjax-container",
    "turbo-frame#repo-content-turbo-frame",
  ],
  /*
   * Their issue app, as on the issue and the list: it exists on no other page, so
   * this may be switched on the moment the form is pressed for, while whatever the
   * reader is reading is still on the screen.
   */
  soft: { within: 'react-app[app-name="issues-react"]' },
  // Nothing. The region is the title box, the description box and the button.
  bands: [],
};

/**
 * A repository's issue list — `/owner/repo/issues`.
 *
 * The same two hooks as a repository's pull request list, which is not a guess:
 * both pages are a repository tab, and GitHub's Turbo navigation targets the
 * same container and frame on each.
 *
 * What differs is the proof of which tab this is. Their pull request list is
 * Rails-rendered and puts `.js-issue-row` in the region; their issue list is
 * React, renders no such row, and marks itself with an app name instead.
 */
export const REPO_ISSUES: Place = {
  name: "repo-issues",
  owns: (path) => Option.isSome(issueListIn(`https://github.com${path}`)),
  regions: ["#repo-content-pjax-container"],
  fallback: "turbo-frame#repo-content-turbo-frame",
  stages: [
    "#repo-content-pjax-container",
    "turbo-frame#repo-content-turbo-frame",
  ],
  /*
   * Their issue app, and not a row inside it. `within` rather than `holding`
   * because the marker is an ancestor of the stages here rather than something
   * the stages contain — the app element wraps the repository content.
   */
  soft: { within: 'react-app[app-name="issues-react"]' },
  // Nothing. The region is the toolbar, the rows and the pager together.
  bands: [],
};

/**
 * The reader's own issues at `/issues`, and the three tabs under it.
 *
 * Their issue app, which on this page is the whole of `main` — measured on a
 * live dashboard, where the app and `main` are the same box to the pixel and no
 * Turbo frame or pjax container exists at all. That is why the fallback here is
 * `main` rather than the frame a repository's tabs fall back to: on this page
 * the frame is not there to fall back to.
 *
 * The whole list and its filter pane together, as the pull request dashboard
 * takes both. This page brings its own filtering, so leaving theirs beside it
 * would put two sets of controls on one screen that disagree about what is on
 * it.
 */
export const ISSUES: Place = {
  name: "issues",
  owns: (path) => Option.isSome(issueDashboardIn(`https://github.com${path}`)),
  regions: ['react-app[app-name="issues-react"]'],
  fallback: "main",
  stages: ['react-app[app-name="issues-react"]'],
  /*
   * Their issue app again, which is the marker all three issue pages share.
   * Harmless that they share it: every gate rule is written against the page
   * this document was marked as, so a rule for one of the three never fires on
   * another.
   */
  soft: { within: 'react-app[app-name="issues-react"]' },
  // Nothing. The region is the tabs, the rows and the pager together.
  bands: [],
};

/**
 * The pull request dashboard at `/pulls`: GitHub's whole two-column layout, the
 * filter pane on the left and the list of rows on the right.
 *
 * Both, not just the list. The Working Set brings its own filtering, so leaving
 * their pane beside it would put two sets of controls on one page that disagree
 * with each other about what is on the screen.
 *
 * Named by `data-testid` rather than by class, which is the one hook on this page
 * that carries no per-deploy hash. Read off the live document rather than guessed
 * — see `scripts/probe-pulls-dom.js`, which is what found it.
 */
export const DASHBOARD: Place = {
  name: "dashboard",
  owns: (path) => showsWorkingSet(path),
  regions: ['[data-testid="pulls-dashboard-surface-layout"]'],
  /*
   * The app element that region sits in. Above the SSO banner GitHub sometimes
   * puts at the top of it, which is why it is not the region itself: taking this
   * would take the banner with it, and a banner about an expired single sign-on
   * is the one thing on this page a reader may need more than their pull
   * requests.
   */
  fallback: 'react-app[app-name="dashboard-surface"]',
  /*
   * The region alone. Their app element is where ours stands when the region never
   * arrives, and it holds the single sign-on banner as well — which is the one
   * thing on this page a reader may need more than their pull requests.
   */
  stages: ['[data-testid="pulls-dashboard-surface-layout"]'],
  /*
   * Nothing to wait for: this region exists on their dashboard and nowhere else, so
   * its presence is already the proof the other pages need a marker for.
   */
  soft: {},
  // Nothing. The region is GitHub's entire list, pane and all.
  bands: [],
};

/**
 * A repository's own pull request list — `/owner/repo/pulls`.
 *
 * The odd one of the three. This page is still Rails-rendered, so there is no
 * `react-app` element and no `data-testid` layout to match: the hooks are element
 * ids that have been on GitHub for years and are what their own Turbo navigation
 * targets. Read off the live document rather than guessed — see
 * `scripts/probe-repo-list-dom.js`, which is what found them.
 *
 * The content region and not the whole page, deliberately. The repository's header
 * and its tab row sit outside this, and they are GitHub's to keep: somebody reading
 * a repository's pull requests still needs the rest of the repository.
 */
export const REPO_PULLS: Place = {
  name: "repo-pulls",
  owns: (path) => /^\/[^/]+\/[^/]+\/pulls\/?$/.test(path),
  regions: ["#repo-content-pjax-container"],
  /*
   * The Turbo frame that region lives in, which is the same box to the pixel. Worth
   * having as a fallback rather than nothing because the two ids belong to different
   * eras of GitHub's own navigation, and they have not always both been present.
   */
  fallback: "turbo-frame#repo-content-turbo-frame",
  /*
   * Both, unlike the other two places, and this is the one that taught the lesson.
   * Turbo renders the list into the container most of the time and straight into
   * the frame the rest of it; rules that named only the container matched nothing
   * whenever it picked the frame, and their list was on the screen for 587
   * milliseconds while ours was being fetched.
   */
  stages: [
    "#repo-content-pjax-container",
    "turbo-frame#repo-content-turbo-frame",
  ],
  /*
   * Their rows, because nothing else here says which page this is. Every hook on
   * this page is a content region that exists on all of a repository's tabs — so
   * the proof has to be the content itself, and `.js-issue-row` is what a list of
   * pull requests puts in it. Until then a reader pressing the tab goes on looking
   * at the page they were on, rather than at an empty frame.
   */
  soft: { holding: ":has(.js-issue-row)" },
  // Nothing. The region is the toolbar, the rows and the pager together.
  bands: [],
};

/**
 * A branch's commits — `/owner/repo/commits/BRANCH`.
 *
 * The same two hooks as a repository's pull request list, which is not a guess:
 * both pages are a repository tab, and GitHub's Turbo navigation targets the same
 * container and frame on each. Measured on a live commits page, where the region
 * and the frame are the same box to the pixel and hold a `react-app` named
 * `commits` — see `scripts/probe-commits-dom.js`.
 *
 * The content region only, as on their pull request list. The repository's header
 * and its tab row are GitHub's to keep: somebody reading a branch's history still
 * needs the rest of the repository.
 */
export const COMMITS: Place = {
  name: "commits",
  owns: (path) => Option.isSome(commitListIn(`https://github.com${path}`)),
  regions: ["#repo-content-pjax-container"],
  fallback: "turbo-frame#repo-content-turbo-frame",
  stages: [
    "#repo-content-pjax-container",
    "turbo-frame#repo-content-turbo-frame",
  ],
  /*
   * Their rows, for the reason a repository's list needs the same thing: every
   * hook on this page is a content region that exists on all of a repository's
   * tabs, so the proof of which tab this is has to be the content. A commit row
   * carries their own test id, which is what a list of commits puts there.
   */
  soft: { holding: ':has([data-testid="commit-row-item"])' },
  // Nothing. The region is the branch picker, the rows and the pager together.
  bands: [],
};

/**
 * A repository's front page — `/owner/repo`.
 *
 * The same content region as their pull request list and their commits, which is
 * measured rather than assumed: on a live repository the pjax container, the Turbo
 * frame, `main` and their code view app are one box to the pixel, 1512 by 7635 at
 * the top of the page.
 *
 * The difference from the other repository tabs is what the region holds. Their
 * `#repository-container-header` is empty here — zero by zero — because the code
 * view renders the repository's own name and tab row inside the app rather than
 * above it. So this place takes the tabs along with the content, and the bar puts
 * them back. On the other tabs the header is outside the region and stays.
 */
export const REPO_HOME: Place = {
  name: "repo-home",
  owns: (path) => Option.isSome(repoHomeIn(`https://github.com${path}`)),
  regions: ["#repo-content-pjax-container"],
  fallback: "turbo-frame#repo-content-turbo-frame",
  stages: [
    "#repo-content-pjax-container",
    "turbo-frame#repo-content-turbo-frame",
  ],
  /*
   * Their code view app, which is the marker the whole of `/owner/repo`,
   * `/tree/...` and `/blob/...` share. Harmless that they share it: every gate
   * rule is written against the page this document was marked as, and only a
   * repository's root is ever marked `repo-home`.
   */
  soft: { within: 'react-app[app-name="code-view"]' },
  /*
   * One, and the region takes everything else: the tab row, the file list and the
   * README are all inside it.
   *
   * Their banner saying a branch "had recent pushes 4 minutes ago", with the button
   * offering to open the pull request. 407 readers asked GitHub for a way to switch it
   * off for branches they do not care about and were given none, which is what puts it
   * here rather than behind a setting.
   *
   * Inside the region as well, as their greeting is on the home dashboard, so a load
   * of this page already takes it along with the code view app. Naming it is what
   * reaches the other path: on a navigation that loads no document every rule is
   * scoped under `react-app[app-name="code-view"]`, and the stages cannot be — they
   * name the pjax container, which was measured as that app's parent rather than its
   * child — while this band really is inside the app.
   *
   * Named by the stable half of its own CSS module class, because that name is the one
   * hook the row has: read out of the code view bundle, which is where the words "had
   * recent pushes" and the class `RecentlyTouchedBranches-module__Flash__reMRu` are
   * shipped together, the last five characters being that deploy's hash. The fragment
   * stops at `Flash` because the box and the icon inside it carry the same module's
   * name, and a fragment cut shorter would take the one row three times over.
   */
  bands: ['[class*="RecentlyTouchedBranches-module__Flash"]'],
};

/**
 * One workflow run — `/owner/repo/actions/runs/{id}`.
 *
 * The only page here whose region is the Turbo frame itself. Measured on run
 * 30866145080: their frame, `main` and their `<run-summary>` element are one box to
 * the pixel, 1512 by 2242 at top 100, and there is no `#repo-content-pjax-container`
 * and no `react-app` on the page at all. A run is server-rendered Turbo with
 * `react-partial` islands, so the gate waits on the frame and never on an app name.
 *
 * The frame rather than `run-summary`, which contains it: their own element holds a
 * hidden `#repository-container-header` for Turbo to swap, and taking the frame leaves
 * that alone. The repository's header and tab row sit above all three at top 100 and
 * stay, as on every other repository tab.
 */
export const RUN: Place = {
  name: "run",
  owns: (path) => Option.isSome(runAddressIn(`https://github.com${path}`)),
  regions: ["turbo-frame#repo-content-turbo-frame"],
  /*
   * One step out, and the same box to the pixel on the measured page. Worth having
   * because the frame and `main` belong to different eras of their own navigation.
   */
  fallback: "main",
  stages: ["turbo-frame#repo-content-turbo-frame"],
  /*
   * Their own `<run-summary>` element, which is an ancestor of the frame and exists on
   * a run and nowhere else: probed against `/owner/repo/actions`, where it is absent
   * and a pjax container is present. So this may be switched on the moment a run is
   * pressed, while the list is still on the screen, without blanking the list.
   */
  soft: { within: "run-summary" },
  // Nothing. The region is the summary, the job graph and the notes together.
  bands: [],
};

/**
 * A repository's Actions tab at `/owner/repo/actions`: their whole list of workflow runs.
 *
 * The same two content hooks every other repository tab uses, and for the same reason: the
 * pjax container is what Turbo renders this list into, and the frame is what it renders into
 * the rest of the time. Probed on the live page, where the container is present and the
 * `run-summary` element that marks a single run is absent, which is what keeps this place and
 * `RUN` apart while a reader moves between them.
 *
 * Their sidebar of workflows goes with the list. It is a filter, and this screen groups
 * instead of filtering, so leaving it beside the rows would put two sets of controls on one
 * page that disagree about what is on the screen. That is the same argument the pull request
 * dashboard makes about their filter pane.
 */
export const ACTIONS: Place = {
  name: "actions",
  owns: (path) => Option.isSome(actionsIn(`https://github.com${path}`)),
  regions: ["#repo-content-pjax-container"],
  fallback: "turbo-frame#repo-content-turbo-frame",
  stages: [
    "#repo-content-pjax-container",
    "turbo-frame#repo-content-turbo-frame",
  ],
  /*
   * Their own row ids, which are `check_suite_<id>` and are written by the run list and by
   * nothing else on a repository. Every other hook on this page is a content region shared
   * with the Code tab, so the proof has to be the content itself. Until a row exists, a
   * reader pressing the tab goes on looking at the page they were on rather than at an empty
   * frame.
   */
  soft: { holding: ':has([id^="check_suite_"])' },
  // Nothing. The region is the rows and their pager together.
  bands: [],
};

/**
 * A repository's Releases tab at `/owner/repo/releases`: every Version they list.
 *
 * The same two content hooks every other repository tab uses, measured on 2026-08-14 against
 * `zeronsh/comet`: the pjax container is present, the Turbo frame is present, and there is no
 * `react-app` at all. The page is server-rendered Turbo with two `react-partial` islands that
 * carry the docs URL and the logged-out header, so neither is worth reading.
 *
 * Their own pager goes with the list, as their workflow sidebar goes with the runs. This screen
 * reads the first page, which is the page their Releases tab opens with, and `docs/spec/releases.md`
 * records that holding more than that is what their search box would need.
 */
export const RELEASES: Place = {
  name: "releases",
  owns: (path) => Option.isSome(releasesIn(`https://github.com${path}`)),
  regions: ["#repo-content-pjax-container"],
  fallback: "turbo-frame#repo-content-turbo-frame",
  stages: ["#repo-content-pjax-container", "turbo-frame#repo-content-turbo-frame"],
  /*
   * Their own section wrapper for one Version, which is written by this list and by nothing
   * else. Every other hook on the page is a content region shared with the Code tab, so the
   * proof has to be the content itself.
   *
   * Measured rather than assumed, because the doubt was the two neighbouring pages: read on
   * 2026-08-14, `data-release-anchor` appears ten times on `/releases` and exactly zero times
   * on `/releases/tag/v0.2.1` and on `/tags`. So a reader pressing one Version, or their "View
   * all tags", is never left looking at a page this rule has blanked.
   */
  soft: { holding: ":has(section[data-release-anchor])" },
  // Nothing. The region is the Versions and their pager together.
  bands: [],
};

/**
 * The home dashboard at `/`, and at `/dashboard`, which is the same page.
 *
 * The odd one in a different way from a repository's list: this page is Rails-rendered
 * *and* its modules are `react-partial` elements, so the hooks are an id, two class
 * names that have been on GitHub for years, and GitHub's own `partial-name`
 * attributes — none of which carry the per-deploy hash Primer's class names do. Read
 * off the live document rather than guessed; see `scripts/probe-home-dom.js`, which
 * is what found them.
 *
 * The centre column and not the whole layout. Their sidebar sits outside `main`
 * entirely, so taking this region leaves it standing — which is why it is named as a
 * band below rather than left to the region.
 */
export const HOME: Place = {
  name: "home",
  owns: (path) => isHome(path),
  /*
   * The document's own surface, not a region of GitHub's — the first place to stand
   * the way `plans/006-stand-on-the-body.md` says every place eventually will. The
   * four bands this page used to name are all inside the one wrapper `body` holds,
   * so hiding by position takes the sidebar, the spinner, the Copilot ask box and
   * the Explore panel without naming any of them — which is what let the sidebar
   * stand beside the Rail for weeks when GitHub reworded its label.
   *
   * `:has(#dashboard.dashboard)` is the proof this is home's document, and it is a
   * *finding* claim: if GitHub renames the column, this matches nothing, the
   * takeover declines, and the reader has GitHub whole rather than a hybrid. It is
   * also what keeps the press safe — these rules are switched on while the page
   * being left is still on the screen, and `/feed` names its own column
   * `#feed.dashboard`, so a reader pressing Home from the feed keeps the feed until
   * home's document is really there. Probed live on 2026-08-31: one match on `/`,
   * none on `/feed`.
   *
   * Standing here rather than in their `main` also ends the fight `widths.css` was
   * refereeing: GitHub keeps `main` at `display: none` until a partial loads, and
   * our container used to be inside it.
   */
  regions: ["body:has(#dashboard.dashboard)"],
  /*
   * The surface without the proof. The fallback is only offered once parsing is
   * over, when the column never appeared at all — and the address already said this
   * is home, so the right thing is still our screen on the whole document.
   */
  fallback: "body",
  /*
   * Nothing to wait for, and no steady-state rule: `gateCss` writes only the
   * pre-reveal flash cover for a stage that is the surface itself, because `body`
   * also holds our bar, our hover hosts and other extensions' furniture. The steady
   * state is `hideTheirs`, which marks what stood there at the takeover and leaves
   * everything carrying the outside mark alone.
   */
  soft: {},
  /* None left. Everything this page ever named is a child of the surface now. */
  bands: [],
};

/**
 * The reader's notifications at `/notifications`.
 *
 * A top-level page like `/pulls` and `/issues`, so the closer precedents for the region and
 * the fallback are `DASHBOARD` and `ISSUES` rather than any repository tab. It is the odd one
 * among the three all the same: their dashboard is React and their issues are React, and this
 * page is Rails-rendered end to end. Measured on 2026-08-13, there is no `react-app`, no
 * `turbo-frame` and no `include-fragment` carrying the list — the served document already
 * holds every row, with the write forms in them. See `scripts/probe-notifications-dom.js`.
 *
 * Their whole two-column layout and not just the list: the pane on the left at 247 wide and
 * the rows on the right at 1233. Both, because the pane is a filter and this screen groups
 * instead of filtering, so leaving it beside the rows would put two sets of controls on one
 * page that disagree about what is on the screen. That is the argument `DASHBOARD` and
 * `ACTIONS` both record, and this page is where it is easiest to win: their own `is:open` and
 * `is:merged` return zero rows rather than an error, so the pane cannot answer the question
 * the reader brings to it.
 */
export const NOTIFICATIONS: Place = {
  name: "notifications",
  owns: (path) => noticesIn(`https://github.com${path}`),
  /*
   * Their own behaviour hook, which is the direct child of `main` and holds both columns.
   * Measured 1512 by 1313 at top 64, the same box as `main` to the pixel bar the header.
   * A `js-` class rather than a Primer one, so it carries no per-deploy hash.
   */
  regions: ["div.js-notifications-container"],
  /*
   * `main`, as on `ISSUES`, and for the same reason: this is a top-level page and there is no
   * pjax container or Turbo frame inside it to fall back to. The id `main` carries here,
   * `js-repo-pjax-container`, belongs to an older era of their navigation and is on repository
   * pages too, so it is deliberately not named — a rule written against it would not be
   * written against this page.
   */
  fallback: "main",
  stages: ["div.js-notifications-container"],
  /*
   * Nothing, as on `COMMIT`. Measured rather than assumed: a sentinel written onto `window`
   * on `/pulls` was gone by the time their own notifications link had settled on
   * `/notifications`, so GitHub loads a document to get here and this page is never swapped in
   * under a reader. There is no soft path to gate.
   */
  soft: undefined,
  // Nothing. The region is their pane, the rows and the pager together.
  bands: [],
};

/**
 * What all three of a person's pages share, which is everything but the proof.
 *
 * Measured on four fetched pages rather than guessed. Each of a person's three serves
 * one `div.container-xl` under a bare `<main>`, holding a `Layout` whose sidebar is
 * their column and whose main is their tab row above `turbo-frame#user-profile-frame`.
 * There is no pjax container and no repository frame anywhere on them, which is why
 * the fallback is `main` as it is on `ISSUES` and `NOTIFICATIONS`.
 *
 * The region is that whole band and not the frame inside it, which is the correction
 * this page needed most. Standing in the frame left GitHub's tab row directly above a
 * row of ours and GitHub's left column beside a list of ours: one page in two type
 * scales, two colour systems and two sets of navigation, which reads as a bug rather
 * than as an interface. A person's page is one page, and a reader deciding whether
 * this is the right `alex` reads the face, then the bio, then the list — so all three
 * are drawn by the same hand now. `personIn` in `src/github/person.ts` reads their
 * column out of the document this hides, so nothing is lost by hiding it.
 *
 * Proved on their card rather than on the container, because `container-xl` is a
 * Primer utility that appears on pages this extension has no business with — twice on
 * an organisation's page, which shares this address. `h-card` is the microformats
 * class on their profile column: present on all three of a person's pages, absent
 * from an organisation's, and free of the per-deploy hash Primer's own names carry.
 * It also tells the band from the sticky copy above it, which has a `Layout-sidebar`
 * of its own and no card in it.
 *
 * One class inside the `:has`, deliberately, where `.Layout-sidebar .h-card` would say
 * it more precisely. The tests read these selectors through happy-dom, whose `:has`
 * ignores a descendant combinator inside itself and answers true for every container
 * on the page — so a selector written that way would pass a test that had stopped
 * proving anything. The class is unique to their column either way.
 *
 * One band, and it is their sticky bar: a second copy of the mini face and the tab row
 * that GitHub floats at the top of the window as a reader scrolls. It is a direct child
 * of `main`, outside the region, and left alone it would slide over ours.
 */
const PERSON = {
  regions: ["main div.container-xl:has(.h-card)"],
  fallback: "main",
  stages: ["main div.container-xl:has(.h-card)"],
  bands: ["main > div.position-sticky:has(.user-profile-sticky-bar)"],
} as const;

/**
 * A person's profile — `/LOGIN`, and `?tab=overview`, which is the same page.
 *
 * The shared frame is why every one of these three needs `holding` rather than
 * `within`: all three tabs are the same frame under the same address, so the frame
 * cannot say which tab a press is going to, and a rule that hid it on the strength
 * of the frame alone would blank the tab the reader is still reading.
 *
 * The proof here is their contributions fragment, whose `src` carries
 * `tab=contributions`. Checked against all three fetched pages: present on the
 * profile, absent on the repositories tab, absent on the stars tab.
 *
 * An organisation's page is one segment too and no reserved-word list will ever
 * catch it. Measured: `/microsoft` carries no `user-profile-frame` and no profile
 * sidebar, so this gate is false there and nothing is hidden. The screen hands the
 * page back when the frame is missing, which is what keeps an organisation GitHub's.
 */
export const PROFILE: Place = {
  ...PERSON,
  name: "profile",
  owns: (path, search) => Option.isSome(profileIn(`https://github.com${path}${search ?? ""}`)),
  soft: { holding: ':has(include-fragment[src*="tab=contributions"])' },
};

/**
 * Their repositories tab — `?tab=repositories`.
 *
 * The proof is their own list element, `#user-repositories-list`, which holds the
 * thirty rows the served document already carries. Present on this tab and on
 * neither of the other two.
 */
export const PERSON_REPOS: Place = {
  ...PERSON,
  name: "person-repos",
  owns: (path, search) => Option.isSome(personReposIn(`https://github.com${path}${search ?? ""}`)),
  soft: { holding: ':has(#user-repositories-list)' },
};

/**
 * Their stars tab — `?tab=stars`.
 *
 * The proof is the frame their starred rows arrive in, which is a second Turbo frame
 * inside the profile frame and exists on this tab alone.
 */
export const PERSON_STARS: Place = {
  ...PERSON,
  name: "person-stars",
  owns: (path, search) => Option.isSome(personStarsIn(`https://github.com${path}${search ?? ""}`)),
  soft: { holding: ":has(turbo-frame#user-starred-repos)" },
};

/**
 * An organisation's single sign-on, standing where the page the reader asked for
 * should be.
 *
 * The one place here with no address of its own, and that is the fact the whole
 * of it turns on. GitHub serves this wall *in place of* whatever was asked for and
 * under that page's own URL: `/octo-org/octo-repo/pull/7` is the wall this minute
 * and the pull request the next, and nothing in the address says which. Measured
 * on `OpenRouterIncubator/ori`, where the address never moved and the title read
 * "Sign in to OpenRouterIncubator".
 *
 * So this is found in the document instead — the root class at `document_start`,
 * then `wallIn` once their form is parsed — and `owns` refuses every address,
 * which is the plain truth: not one of them routes here. It was written as `owns:
 * () => true` first, to satisfy the rule in `mount.ts` that a screen may not stand
 * until the address is its own. True everywhere and false everywhere are both
 * lies about a page that has no address, and the first of them is the dangerous
 * one — it claims the whole site, and it walks straight through the test in
 * `place.test.ts` that exists to catch a rule that answers nothing. `found` says
 * the real thing once, and both readers of `owns` were taught to ask it.
 */
/** Their wall's own region: the `main` that holds the box, and only that one. */
const THE_WALL = `main:has(${THE_WALL_BOX})`;

export const SIGN_ON: Place = {
  name: "sign-on",
  owns: () => false,
  /*
   * The root element and its class, which is the first thing a parser produces and
   * so the only thing there is to read at `document_start` — the one moment early
   * enough to hold their page back without a frame of it on the screen.
   *
   * A guess at that moment, deliberately: the class is on their login box, their
   * second factor and their device check as well. `regions` below is what makes a
   * wrong guess free, and `wallIn` is what settles it a few milliseconds later.
   */
  loadedWhen: `html.${AUTH_CLASS}`,
  /*
   * Their whole `main`, proved by the one child that says which auth page this is.
   *
   * The proof matters more here than anywhere else in this table. GitHub serves
   * their password box, their second factor and their device check under the same
   * root class `found` above recognises, and every one of those is a page a reader
   * has to be able to use. The box is on the organisation wall and on none of them
   * — measured on the live wall, where `main` holds exactly one child and it is
   * `div.org-sso.text-center` — so a guess that was wrong hides nothing at all
   * while it is being corrected.
   *
   * `stages` is left out, so it is this. What to hide and where to stand are the
   * same answer here, and the wall is the one page in this table where they cannot
   * come apart: it is a whole document GitHub served instead of another one, not a
   * region swapped into a page that is already up.
   */
  regions: [THE_WALL],
  /*
   * The same selector. There is nothing worse to fall back to and nothing worth
   * falling back for: their wall is one box on an otherwise empty page, so a
   * takeover that cannot find it has not found the wall.
   */
  fallback: THE_WALL,
  /*
   * No `soft` rules, and none possible: the wall is a server's answer to a request
   * for another page, so it arrives as a document every time and is never swapped
   * in under a reader.
   *
   * No `bands` either. The region is their heading and their form together, and
   * there is nothing else on the page.
   */
  bands: []
}

/**
 * Every page this extension stands on, for the rules that hide GitHub's version of
 * them.
 *
 * A place left out of this list is a page whose gate is never written, so it is
 * worth being the same list the interfaces are chosen from — see
 * `scripts/build-gates.ts`, which turns it into the two stylesheets.
 */
export const PLACES: ReadonlyArray<Place> = [
  SIGN_ON,
  CONVERSATION,
  COMMIT,
  COMMITS,
  DASHBOARD,
  REPO_PULLS,
  RAISE,
  REPO_ISSUES,
  REPO_HOME,
  ISSUE,
  ISSUES,
  RUN,
  ACTIONS,
  RELEASES,
  NOTIFICATIONS,
  HOME,
  PROFILE,
  PERSON_REPOS,
  PERSON_STARS,
];

/**
 * The same places, in the order an address is offered to them.
 *
 * The order is the whole of the routing. `/owner/repo/pull/1` and `/owner/repo/pulls`
 * differ by a character; a repository's front page is the shortest address of the lot
 * and is asked last, or it would answer for every tab in the repository.
 *
 * Home is not here. It is the Working Set standing somewhere else, and the dashboard
 * already owns that address — `placeFor` in the shell is what tells the two apart.
 *
 * Nor is the wall, though leaving it out is no longer what keeps it out: it refuses
 * every address, so adding it here would change nothing. See `SIGN_ON`.
 */
const BY_ADDRESS: ReadonlyArray<Place> = [
  CONVERSATION,
  COMMIT,
  COMMITS,
  DASHBOARD,
  REPO_PULLS,
  ISSUE,
  RAISE,
  REPO_ISSUES,
  ISSUES,
  RUN,
  ACTIONS,
  /*
   * Before a repository's front page, as everything else is. Its own neighbours are no trouble:
   * `releasesIn` refuses `/releases/tag/{tag}`, `/releases/latest` and `/tags` outright, so this
   * claims one address and never a page beside it.
   */
  RELEASES,
  /*
   * Before a repository's front page, as everything else is, and the order does not otherwise
   * matter: `/notifications` is one address that no other place here claims.
   */
  NOTIFICATIONS,
  REPO_HOME,
  /*
   * Last of all, after a repository's front page, because a login is the shortest
   * address GitHub has: one segment and nothing else. Asked earlier, the profile
   * would answer for every two-segment address whose parser had not yet had a look.
   *
   * The three of them in any order among themselves — each refuses the other two's
   * `tab`, so no two ever claim one address.
   */
  PERSON_REPOS,
  PERSON_STARS,
  PROFILE,
];

/**
 * Whose page an address is, or nothing where it is one of GitHub's own.
 *
 * The one answer to that question. The shell routes a press by it and `mount.ts`
 * holds a takeover back until it agrees, so a page routed by one rule and stood up
 * by another cannot happen.
 *
 * The search is optional and the places that do not need it ignore it. Left out, an
 * address on a person's path reads as their profile, which is what `/LOGIN` is.
 */
export const placeOwning = (path: string, search?: string): Place | null =>
  BY_ADDRESS.find((place) => place.owns(path, search)) ?? null;

/**
 * Whose page the document in front of the reader is, markup and address together.
 *
 * The address alone answers for every page but one. An organisation's single
 * sign-on is served *in place of* whatever was asked for and under that page's own
 * URL, so `placeOwning` reads it as the pull request or the repository it is
 * standing in front of — and that screen then waits for a region their wall does
 * not have. Which is what a reader saw: eight seconds of nothing, then the wall.
 *
 * Asked of the page a document was loaded on and of nothing else. A press is
 * routed by `placeOwning` above, because a link is an address and there is no
 * document behind it yet to read.
 *
 * The document is asked first and the address second, which is the order the two
 * facts deserve: a place that recognises the markup in front of the reader is
 * looking at the page, and a place that recognises the address is looking at what
 * was asked for. The wall is the whole of the difference between those.
 */
export const placeLoadedOn = (
  page: Document,
  path: string,
  search?: string
): Place | null =>
  PLACES.find(
    (place) => place.loadedWhen !== undefined && page.querySelector(place.loadedWhen) !== null,
  ) ?? placeOwning(path, search);
