# Other GitHub pages worth replacing

Research date: 2026-08-12

Scope: Pages GitQuiet does not take over yet, ranked by user pain about slowness and by fit with the product vision (work around a pull request: read a diff, review, comment, answer bots, merge).

GitQuiet already redraws thirteen addresses. Listed in `README.md` and `src/ui/place.ts`. This note covers the rest.

## Recommendation

Replace `/owner/repo/pull/N/files` next.

That tab is still GitHub's on purpose. `src/domain/PullRequestRef.ts` says Files, Commits and Checks stay GitHub's. The test in `src/domain/PullRequestRef.test.ts` calls those tabs "good". The public record does not match that for Files changed.

GitHub's own changelog still reports 10+ second switches into that tab, a 1 GB JavaScript heap on large diffs, and a 1,000 or 3,000 file cap. Users still route around it with `github.dev`, the CLI, and other review products.

Code view (`/blob`) is the second page. Notifications is the third. Job logs are already this product's run screen, so they are not a new page.

## Method

Primary sources only:

- GitHub Community discussions, with upvote and comment counts read on 2026-08-12
- GitHub Blog changelogs and engineering posts
- A GitHub employee post about the Actions log viewer
- Hacker News threads
- One Reddit thread on r/github, read live
- This repository's own place list and parsers

Reddit search on r/github returned few recent performance threads. The strongest public complaints sit on GitHub Community and Hacker News.

## Already replaced, so skip

| Address | Why it is not a candidate |
| --- | --- |
| `/owner/repo/actions/runs/ID` and `.../job/JOB` | `runAddressIn` treats a job URL as the same Run screen. The spec in `docs/spec/actions.md` already answers "what broke". |
| `/owner/repo/pull/N` | Conversation takeover. |
| Home, pulls, issues, repo home, commits, one commit, one issue, raise, actions list | Already in `PLACES`. |

## Ranked candidates

### 1. Files changed — `/owner/repo/pull/N/files`

Fit: high. This is the review surface.

Strength: very high

GitQuiet leaves this URL to GitHub. The parser matches only `/pull/N`, not `/pull/N/files`.

GitHub's own numbers, from the Files changed engineering post (3 April 2026):

- JavaScript heap over 1 GB on large pull requests
- More than 400,000 DOM nodes
- v1 INP about 450 ms on a 10,000-line split diff (M1 MacBook Pro, 4x slowdown)
- v1 about 183,504 React components on that same diff
- Virtualization for p95+ diffs (over 10,000 lines) cut INP from 275–700+ ms to 40–80 ms

Source: https://github.blog/engineering/architecture-optimization/the-uphill-climb-of-making-diff-lines-performant/

The February 2026 changelog still says tab switches from Conversation to Files changed went from "10+ seconds to a few seconds".

Source: https://github.blog/changelog/2026-02-05-improved-pull-request-files-changed-february-5-updates/

The default Files changed page still has hard limits (read from the official feedback thread on 2026-08-12):

- 1,000 files in single-file mode, or 3,000 in experimental virtualized mode
- 40 comments on the page (350 in the side panel)
- 20 replies per comment
- Virtualized mode breaks find-in-page, select-all, print, and extensions that need the full diff in the DOM

Source: https://github.com/orgs/community/discussions/163932 (408 upvotes, 3,188 comments)

Older threads that GitHub has not closed:

- "Pull request page become so slow when pr is big" — 175 upvotes, 52 comments, 2022-09-21. Quote: "It's very difficult to review or check comment with code in Pull request page because it become too laggy to review in page." https://github.com/orgs/community/discussions/33663
- "Bad Performance in Pull Request File Tree" — 219 upvotes, 72 comments, 2022-11-17. Quote: "Browser tab can crash. Browser freezes. Scrolling clunky. Chrome warns about slow unresponsive page." https://github.com/orgs/community/discussions/39341

Hacker News, 12 May 2025, lists Files changed as 5 to 60 seconds, including marking a file viewed.

Source: https://news.ycombinator.com/item?id=43961329

A 7 February 2026 review of a 70-file pull request reports 0.5 s lag between keypress and character in the comment box, on an M2 Max with 32 GB RAM.

Source: https://tvonwolfe.com/posts/why-github

Safari thread #170758 (404 upvotes, 63 comments, 2025-08-23) names the same page: "even checking the Viewed checkbox sometimes takes several seconds". A later comment on an 855-file, 403-commit compare: "the GitHub UI becomes completely unusable."

Source: https://github.com/orgs/community/discussions/170758

Why an extension can be faster: GitQuiet already fetches diffs for the conversation screen. A Files takeover can virtualize from the start, keep find-in-page via a hidden textarea (GitHub's own code-view trick), and skip the React tree GitHub measured at 183,504 components. The review-mode note in `docs/research/review-mode-pain-points.md` already lists the product work this page needs.

### 2. Code view — `/owner/repo/blob/REF/PATH` and `/tree/`

Fit: medium-high. Reviewers leave the pull request to read a file. Authors do the same while they write the change.

Strength: high

GitHub's own code-view post (21 June 2023) measured the React first pass on an 18,000-line `CODEOWNERS` file at nearly 27 seconds. LCP and TTI got worse around 500 lines, and users noticed around 2,000. Pressing End on that file blocked the main thread for 3,700 ms when React owned the lines.

Source: https://github.blog/engineering/architecture-optimization/crafting-a-better-faster-code-view/

Hacker News, 2025: "The code viewer is completely unusable for any file longer than a hundred lines. I have to clone it and browse locally instead."

Source: https://news.ycombinator.com/item?id=44799861

A later Ask HN (about 11 months before this note) names the file explorer: "drops frames, scrolling and searching cause lockups" on an M1 Max with 64 GB RAM. The same post says clicking files in a review "lazily loads them and never finishes".

Source: https://news.ycombinator.com/item?id=44988854

Community #54962 (184 upvotes, 33 comments, 2023-05-09) is about the symbols panel, not raw FPS, but it is the same page: double-click opens "All symbols", which duplicates the word and breaks browser find.

Source: https://github.com/orgs/community/discussions/54962

Safari #170758 again: "browsing any file with a thousand or more lines of code is fully broken."

Why an extension can be faster: a textarea plus a virtualized overlay is the architecture GitHub already described. A takeover that ships only that, without the symbols panel and the character-by-character overlay, can stay findable and stay small. Raw view (`?plain=1`) is the workaround people already use.

### 3. Notifications inbox — `/notifications`

Fit: high for workflow, medium for raw page weight. This is how many people find the next pull request. GitQuiet's Working Set already answers "what is owed" across repositories, so a notifications takeover overlaps that job.

Strength: medium for speed, high for noise

Hacker News on the 2025 "Why is GitHub UI getting slower?" thread: "The GitHub app takes between 3 and 4 seconds to refresh the notifications, and I only have about 20 in my list."

Source: https://news.ycombinator.com/item?id=44799861 (comment 44802617)

Community threads are about filters more than FPS:

- Inbox custom filter exclusion: 46 upvotes, 19 comments. https://github.com/orgs/community/discussions/5601
- Filter notifications by PR status: 37 upvotes, 10 comments. https://github.com/orgs/community/discussions/55098
- Move bot issues and pull requests into a separate tab: 43 upvotes, 3 comments. https://github.com/orgs/community/discussions/4520
- Notification subscriptions cannot be customised anymore: 37 upvotes, 8 comments, 2026-08-10. https://github.com/orgs/community/discussions/204563

A person who "lives on the notification UI as a means to watch for PRs" is in #12976.

Why an extension can be faster: the Notifications API is a small JSON list. Three to four seconds for 20 rows is client work, not payload size. Courts already sort Involved Pull Requests. A notifications page that files rows by Court, and hides bots, is closer to the Working Set than to a second inbox.

Do this after Files changed, unless the goal is to steal the bell-icon habit. The Working Set already covers much of the "what needs me" question.

### 4. Compare and new pull request — `/owner/repo/compare/...`

Fit: high. This is how a pull request starts.

Strength: medium. The public record is more about failures than FPS.

Community #202875, "500 Internal Server Error when creating a Pull Request": 50 upvotes, 24 comments, 2026-07-24.

Source: https://github.com/orgs/community/discussions/202875

Safari #170758 comments name the new-PR reviewers picker as the worst control on that page.

The 855-file compare in that same thread is a compare, not a Files changed tab.

Why an extension can be faster: GitQuiet already draws diffs on commits and pull requests. A compare page that lists files first, and loads hunks near the viewport, avoids GitHub's full compare document. Raising a pull request from that list is a write GitQuiet already knows how to send.

Weaker evidence than Files changed. Build it if compare is a daily path for the same people who review.

### 5. Blame — `/owner/repo/blame/REF/PATH`

Fit: medium. Used while reading a file during review.

Strength: medium, and old

A Perl 5 issue (2019) reports GitHub blame on large files as a unicorn: "This page is taking way too long to load."

Source: https://github.com/Perl/perl5/issues/17310

Community #5033 (587 upvotes, 24 comments) asks for `--ignore-revs-file` on the blame view. That is a feature gap, not a speed report, but it shows the page still has a large audience.

Source: https://github.com/orgs/community/discussions/5033

Why an extension can be faster: blame is expensive on GitHub's servers. A takeover cannot make `git blame` cheaper. It can page by line range and avoid drawing the whole file. Local `git blame` remains faster. Lower priority than Files changed and blob.

### 6. Conflict editor — `/owner/repo/pull/N/conflicts` (and the web editor)

Fit: high. Merge is in the vision.

Strength: low for speed, high for missing facts

`docs/spec/conflicted-files.md` already measured that `page_data/merge_box` carries the conflict paths. The gap is the editor, not the list. Community reports are about wrong merge direction and false conflicts, not FPS.

Do the path list on the pull request first. Replace the editor only if people still leave for GitHub after they see the paths.

## Weaker or out of scope

| Page | Why it waits |
| --- | --- |
| `/pull/N/checks` | GitQuiet already files Checks on the conversation. A separate tab adds little. |
| `/pull/N/commits` | The conversation already lists commits. The branch commits page is already replaced. |
| Actions job log viewer as GitHub draws it | Already owned. A GitHub employee still says "Stop Using the Log Viewer" and points at `gh run view --log-failed`. https://dev.to/andreagriffiths11/github-actions-the-stuff-nobody-tells-you-19md |
| Network graph, contributors, insights | Classic timeouts. Not pull-request work. |
| Projects, Discussions, Wiki, Releases, Search | Real pain, different product. Search needs GitHub's index. |
| Settings, billing, packages, codespaces | Out of vision. |

## Reddit

r/github search on 2026-08-12. The recent performance thread is "Does GitHub's UI feel slow to anyone else? No good alternative exists." (about 4 months old, 16 votes, 34 comments).

https://www.reddit.com/r/github/comments/1swonb5/does_githubs_ui_feel_slow_to_anyone_else_no_good/

The author names clicking between files, issues, and branches. A commenter who reviews pull requests says: "my main pain point is code reviews. The rest is slow but tolerable." Another says they only notice slowdown at "tens of thousands of lines across hundreds of files".

Older r/github threads about "the new GitHub UI" are from 2019 to 2020 and talk about layout, not the current React diffs.

Reddit is weaker evidence than Community and GitHub's own blog.

## What GitHub already admits

These are first-party statements, not user guesses:

1. Files changed: 1 GB heap, 400k DOM nodes, 10+ second tab switches, file caps, virtualization that breaks find-in-page.
2. Code view: 27 second React first paint on an 18,000-line file.
3. Actions logs: a GitHub employee tells people to stop using the web viewer.
4. Safari: staff confirmed a `:has()` CSS change on most pages, then shipped a fix. The 404-upvote thread remains the record of how far the site fell.

An extension that draws less DOM, virtualizes from the first byte, and keeps native find, is doing the work GitHub's own posts describe.

## Five strongest findings

1. Files changed is still GitHub's, and it is the loudest slow page. Official feedback thread: 408 upvotes, 3,188 comments. https://github.com/orgs/community/discussions/163932
2. GitHub measured 1 GB heap and 400k DOM nodes on large Files changed views, then still needed virtualization that breaks Ctrl+F. https://github.blog/engineering/architecture-optimization/the-uphill-climb-of-making-diff-lines-performant/
3. Code view's own team measured a 27 second React paint on one file. https://github.blog/engineering/architecture-optimization/crafting-a-better-faster-code-view/
4. Safari users on M4 Max hardware reported 100% renderer CPU on pull requests and files over 1,000 lines. 404 upvotes. https://github.com/orgs/community/discussions/170758
5. Job logs are not a new page. This product already stands on the job URL.

## Source index

### This repository

- Thirteen pages: `README.md`
- Place list: `src/ui/place.ts`
- Pull request parser leaves `/files`, `/commits`, `/checks` to GitHub: `src/domain/PullRequestRef.ts`
- Run and job addresses: `src/domain/run.ts`
- Conflict paths already in merge_box: `docs/spec/conflicted-files.md`
- Review-mode pain: `docs/research/review-mode-pain-points.md`

### GitHub first party

- Files changed default: https://github.blog/changelog/2026-01-22-improved-pull-request-files-changed-page-on-by-default/
- Files changed 5 Feb 2026: https://github.blog/changelog/2026-02-05-improved-pull-request-files-changed-february-5-updates/
- Diff performance: https://github.blog/engineering/architecture-optimization/the-uphill-climb-of-making-diff-lines-performant/
- Code view performance: https://github.blog/engineering/architecture-optimization/crafting-a-better-faster-code-view/
- Actions log advice: https://dev.to/andreagriffiths11/github-actions-the-stuff-nobody-tells-you-19md

### GitHub Community

- Files changed feedback: https://github.com/orgs/community/discussions/163932
- Big PR lag: https://github.com/orgs/community/discussions/33663
- File tree crash: https://github.com/orgs/community/discussions/39341
- Safari: https://github.com/orgs/community/discussions/170758
- Code view symbols: https://github.com/orgs/community/discussions/54962
- Notifications filters: https://github.com/orgs/community/discussions/5601, https://github.com/orgs/community/discussions/55098, https://github.com/orgs/community/discussions/4520
- Blame ignore-revs: https://github.com/orgs/community/discussions/5033
- Create PR 500: https://github.com/orgs/community/discussions/202875

### Hacker News and blogs

- Ask HN, May 2025: https://news.ycombinator.com/item?id=43961329
- Why is GitHub UI getting slower?: https://news.ycombinator.com/item?id=44799861
- File explorer lockups: https://news.ycombinator.com/item?id=44988854
- 70-file review lag: https://tvonwolfe.com/posts/why-github

### Reddit

- https://www.reddit.com/r/github/comments/1swonb5/does_githubs_ui_feel_slow_to_anyone_else_no_good/
