import { ACTIONS_VIEW } from "./mock/actions"
import { BLAME_VIEW } from "./mock/blame"
import { COMMIT_VIEW } from "./mock/commit"
import { COMMITS_VIEW } from "./mock/commits"
import { COMPARE_VIEW } from "./mock/compare"
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
  BLAME_VIEW,
  COMPARE_VIEW,
  RUN_VIEW,
  ACTIONS_VIEW,
  RELEASES_VIEW,
  NOTIFICATIONS_VIEW,
  PROFILE_VIEW,
  PERSON_REPOS_VIEW,
  RAISE_VIEW,
  SIGN_ON_VIEW
]

export const viewNamed = (name: string): View | undefined =>
  VIEWS.find((view) => view.name === name)
