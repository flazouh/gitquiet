/**
 * What resting on a link reads, for every page this extension draws.
 *
 * One table, and it is the second half of a rule the `Place` table holds the first half
 * of: a page of ours is named by the address that owns it, and every page of ours is read
 * before it is asked for. Written here rather than inside the content script because a
 * decision buried in an event handler cannot be tested, and the thing worth testing is
 * the coverage — a screen whose address warms nothing opens cold, and nobody notices
 * until a reader waits for it.
 */

import { Effect, Option } from "effect"
import type { RepoRef } from "../domain/PullRequestRef"
import { fromPathname as commitIn } from "../domain/CommitRef"
import { commitListIn } from "../domain/commitList"
import { issueDashboardIn, queryFor as mineFor } from "../domain/issueDashboard"
import { issueListIn, queryFor as issuesFor } from "../domain/issueList"
import { fromPathname as issueIn } from "../domain/issues"
import { noticesIn } from "../domain/notices"
import { personPageIn } from "../domain/person"
import { showsWorkingSet } from "../domain/pages"
import { elsewhereThan } from "../domain/PullRequestRef"
import { repoHomeIn } from "../domain/repoHome"
import { repoListIn } from "../domain/repoList"
import { runAddressIn } from "../domain/run"
import { actionsIn } from "../domain/strand"
import type { GitHubGateway } from "../ports/GitHubGateway"
import { warmHistory } from "./commitList"
import { warmIssue } from "./issue"
import { warmIssueList } from "./issueList"
import { warmNotices } from "./notices"
import { warmPerson } from "./person"
import { loadPullRequest, warmCommit } from "./pullRequest"
import { warmRepoHome } from "./repoHome"
import { warmRepoList } from "./repoList"
import { warmRun } from "./run"
import { warmStrands } from "./strands"
import { warmTabs } from "./tabs"
import { warmWorkingSet } from "./workingSet"

/**
 * A page to read ahead, and the name it is read under.
 *
 * The name is what stops the same page being read twice in one visit; the read is
 * whichever page this is, already built and waiting for a gateway.
 */
export type Ahead = {
  readonly key: string
  readonly read: Effect.Effect<unknown, unknown, GitHubGateway>
}

/**
 * The page a link leads to, ready to read, or nothing where there is nothing to read.
 *
 * `href` is the link and `at` is where the reader is now, both absolute: the second is
 * read live rather than held from the document's load, because GitHub moves the address
 * without loading anything and a page held from the start goes stale on the first press.
 *
 * Nothing for another host, and nothing for the page already open — reading that is a
 * race with the screen reading it for real, for an answer nobody will wait for.
 */
export const warmingFor = (href: string, at: string): Ahead | null => {
  const page = pageFor(href, at)
  if (page === null) return null

  /*
   * The repository's tab row beside the page itself, wherever the link leads into a
   * repository.
   *
   * Because the bar stands on every one of those pages and the row is served on exactly
   * one of them. A reader whose first press into a repository is a pull request had never
   * fetched the document their row lives in, so the bar over it said Code and Pull requests
   * and nothing else until GitHub's header hydrated underneath our screen.
   *
   * Paid once. `warmTabs` reads nothing where a row is already kept, and the front page's
   * own read keeps the row out of the document it was already reading.
   */
  const repo = repoOf(link(href))
  if (repo === null || Option.isSome(repoHomeIn(href))) return page

  return {
    key: page.key,
    read: Effect.all([page.read, warmTabs(repo)], { concurrency: "unbounded" })
  }
}

/** The two segments a repository is named by, or nothing where the address has no such pair. */
const repoOf = (link: URL | null): RepoRef | null => {
  if (link === null) return null

  const [owner, repo] = link.pathname.split("/").filter((one) => one !== "")
  return owner === undefined || repo === undefined ? null : { owner, repo }
}

const link = (href: string): URL | null => URL.parse(href)

/** The page itself, which is the table proper. */
const pageFor = (href: string, at: string): Ahead | null => {
  const link = URL.parse(href)
  const here = URL.parse(at)
  if (link === null || here === null || link.hostname !== here.hostname) return null

  if (link.pathname === here.pathname && link.search === here.search) return null

  const pull = elsewhereThan(here.pathname, link.pathname)
  if (Option.isSome(pull)) {
    const { owner, repo, number } = pull.value
    return { key: `${owner}/${repo}/${number}`, read: loadPullRequest(pull.value) }
  }

  // Home as well as their dashboard, under the one name: both draw this list, and reading
  // it twice for the two addresses would be the same eight requests again.
  if (showsWorkingSet(link.pathname)) return { key: "/pulls", read: warmWorkingSet() }

  const list = repoListIn(link.href)
  if (Option.isSome(list)) {
    // The page and the search as well as the repository: paging through a busy list is the
    // same three segments over and over, and each page of it is a different list.
    return { key: keyOf(link), read: warmRepoList(list.value) }
  }

  // The same, over one request rather than seven: a repository's issues are one search.
  const issues = issueListIn(link.href)
  if (Option.isSome(issues)) {
    return {
      key: keyOf(link),
      read: warmIssueList(issuesFor(issues.value), issues.value.page)
    }
  }

  /*
   * A repository's front page, which is one of the four warms here that fetches a document
   * rather than a payload.
   *
   * Worth it. GitHub puts the whole front page inside the markup it serves — the tree, the
   * rendered README, the About panel — so on a press this read is the page rather than a
   * decoration of it. It is also the only way to get the field saying whether the reader
   * can push, which is what decides the order of the two blocks.
   */
  const home = repoHomeIn(link.href)
  if (Option.isSome(home)) return { key: link.pathname, read: warmRepoHome(home.value.repo) }

  /*
   * A repository's Actions tab, and one run of it.
   *
   * Both markup, and both worth it for the reason a front page is: their list carries every
   * row's ref, outcome and pull request, and their run page carries the jobs and the notes.
   *
   * The run is the slowest of everything here — half a megabyte of markup for twelve jobs
   * and fifteen notes — which is exactly why a pointer resting on a row is where it starts.
   */
  const runs = actionsIn(link.href)
  if (Option.isSome(runs)) return { key: link.pathname, read: warmStrands(runs.value) }

  const run = runAddressIn(link.href)
  if (Option.isSome(run)) return { key: link.pathname, read: warmRun(run.value) }

  /*
   * A branch's history, which is markup as well, and one issue.
   *
   * These two were the last pages of ours that opened cold. Both are reached from a list
   * the reader is already reading — the branch picker on a repository's front page, a row
   * on their issues — so the pointer is over the link a good while before the press.
   */
  const history = commitListIn(link.href)
  if (Option.isSome(history)) return { key: keyOf(link), read: warmHistory(history.value) }

  const issue = issueIn(link.pathname)
  if (Option.isSome(issue)) return { key: link.pathname, read: warmIssue(issue.value) }

  /*
   * One commit, which is reached from the history a reader is scrolling and from a row on a
   * pull request's own list of them. A landed commit never changes, so what this puts in the
   * store is right rather than nearly right, and the page opens from it whole.
   */
  const commit = commitIn(link.pathname)
  if (Option.isSome(commit)) {
    const { owner, repo, sha } = commit.value
    return { key: link.pathname, read: warmCommit({ owner, repo }, sha) }
  }

  /*
   * The inbox, which is the one page here that every other page of GitHub links to.
   *
   * Their bell is in the site header, so this is the only read on the table a reader can start
   * from anywhere. Worth it for the reason a repository's front page is: their document is the
   * page rather than a decoration of it, and one fetch of it carries every row, every reason
   * and every write form.
   *
   * Keyed by the address with the query on it, because `?query=is:unread` is a different inbox
   * and their own nav offers several.
   */
  if (noticesIn(link.href)) return { key: keyOf(link), read: warmNotices(link.search.replace(/^\?/, "")) }

  /*
   * A person's profile and their repositories tab, which are two pages out of one document.
   *
   * The last pages here to open cold, and the ones that opened coldest: nothing a person's
   * page draws is in the markup a press arrives on. Their column, their repositories and
   * their events all begin as requests after the screen is already standing, so a reader
   * pressing an author's name from an issue watched an empty frame for a second and a half
   * while three answers landed out of order. See `app/person.ts`.
   */
  const person = Option.filter(personPageIn(link.href), (page) => page.tab !== "stars")
  if (Option.isSome(person)) return { key: keyOf(link), read: warmPerson(person.value) }

  // The reader's own issues, which is the same one search again.
  const mine = issueDashboardIn(link.href)
  return Option.isNone(mine)
    ? null
    : { key: keyOf(link), read: warmIssueList(mineFor(mine.value), mine.value.page) }
}

/** The address as one name, for the pages whose search is part of which page they are. */
const keyOf = (link: URL): string => `${link.pathname}${link.search}`
