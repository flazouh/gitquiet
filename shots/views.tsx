import { ACTIONS_VIEW } from "./mock/actions"
import { COMMIT_VIEW } from "./mock/commit"
import { COMMITS_VIEW } from "./mock/commits"
import { ISSUE_VIEW } from "./mock/issue"
import { ISSUES_VIEW } from "./mock/issues"
import { NOTIFICATIONS_VIEW } from "./mock/notifications"
import { PERSON_REPOS_VIEW } from "./mock/personRepos"
import { PROFILE_VIEW } from "./mock/profile"
import { PULL_REQUEST_VIEW } from "./mock/pullRequest"
import { RAISE_VIEW } from "./mock/raise"
import { RELEASES_VIEW } from "./mock/releases"
import { REPO_HOME_VIEW } from "./mock/repoHome"
import { REPO_ISSUES_VIEW } from "./mock/repoIssues"
import { REPO_PULLS_VIEW } from "./mock/repoPulls"
import { RUN_VIEW } from "./mock/run"
import { SIGN_ON_VIEW } from "./mock/signOn"
import { WORKING_SET_VIEW } from "./mock/workingSet"
import type { View } from "./view"

/**
 * Every view this stage can photograph, in the order the landing page tells them.
 *
 * The order is the reader's journey rather than the codebase's, and the first three
 * carry the argument on their own: the Working Set is what the product is for, the
 * pull request is where the reader spends the day, and the commit shows that the same
 * reading applies to something that is not a pull request at all.
 *
 * The nine under them answer questions the first three raise, roughly in the order a
 * reader raises them. Does this work on a whole repository. What about issues. Can I
 * write as well as read. What happens to CI. `capture.js` photographs this array and
 * writes the landing page's manifest from it, so this order is the page's order and
 * nothing else has to be told about a view being added.
 */
/**
 * The pull request again, wearing what GitHub cannot: a colour pack and a
 * side-by-side layout. Same screen and same data as PULL_REQUEST_VIEW; only
 * the remembered settings differ, which is the point — these are a reader's
 * own choices, photographed so the video can show them.
 *
 * The store reads one blob under `gitquiet.settings` (see `src/ui/keeping.ts`),
 * so a per-view choice nests the group it touches under that key.
 */
const SETTINGS_KEY = "gitquiet.settings"
const prUnder = (name: string, caption: string, settings: Record<string, unknown>): View => ({
  ...PULL_REQUEST_VIEW,
  name,
  caption,
  chosen: { [SETTINGS_KEY]: settings },
})

const PR_DRACULA = prUnder(
  "pull-request-dracula",
  "The same pull request in a colour pack, the code and the interface following it together",
  { theme: { pack: "dracula", appearance: "dark" } },
)
const PR_TOKYO = prUnder(
  "pull-request-tokyo",
  "One of thirty packs, because a reviewer reads this page all day",
  { theme: { pack: "tokyo-night", appearance: "dark" } },
)
const PR_SPLIT = prUnder(
  "pull-request-split",
  "Side by side when a block was rewritten, chosen and remembered without a reload",
  { diff: { layout: "split" } },
)

export const VIEWS: ReadonlyArray<View> = [
  WORKING_SET_VIEW,
  PULL_REQUEST_VIEW,
  COMMIT_VIEW,
  REPO_PULLS_VIEW,
  ISSUE_VIEW,
  ISSUES_VIEW,
  REPO_ISSUES_VIEW,
  COMMITS_VIEW,
  REPO_HOME_VIEW,
  RUN_VIEW,
  ACTIONS_VIEW,
  RELEASES_VIEW,
  NOTIFICATIONS_VIEW,
  PROFILE_VIEW,
  PERSON_REPOS_VIEW,
  RAISE_VIEW,
  SIGN_ON_VIEW,
  PR_DRACULA,
  PR_TOKYO,
  PR_SPLIT
]

export const viewNamed = (name: string): View | undefined =>
  VIEWS.find((view) => view.name === name)
