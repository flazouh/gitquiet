# Pages GitQuiet does not draw yet, ranked by user pain

Research date: 2026-09-01. Four sweeps, read on the live pages: Hacker News
(Algolia, 40 queries, 7 main threads read in full), Reddit (about 100 JSON
searches across r/github, r/programming, r/ExperiencedDevs, r/devops, 60 threads
read), GitHub Community discussions (upvotes from the GraphQL `upvoteCount`),
and the feature lists of 20 competing tools. The covered list is the 19 places
in `src/ui/place.ts`.

## Correction, 2026-09-02

The code was read after this survey, not before it. Two of the three addresses named
below as the file view are already built: the repository front page owns `/tree/` and
`/blob/`, and a file opened there is drawn by the diff renderer every other screen uses,
whole in the document, with the browser's own find and selection left alone. That is the
fix the complaints in section 1 ask for. What was uncovered was blame alone, and
`docs/spec/blame.md` covers it; it is built on the `stand-on-body` branch. What the file
view still lacks is smaller: a line or range in the address (`#L42-L48`) opening at those
lines, a folder address opening the folder rather than a failed file, and a said reason
on a file GitHub sends without its lines. The ranking below is kept as it was found.

## The answer

The single-file view, `/OWNER/REPO/blob/BRANCH/PATH`, with the directory
listing `/tree/` and `/blame/` beside it. Every one of the four sources ranks
it first among the pages this extension does not draw. Search is second on
three of four. Compare and the new pull request page are third on three of four
and low on the community count.

## 1. Code view: `/blob`, `/tree`, `/blame`

The pain is speed and hijacked browser keys, the same pain GitQuiet already
answers on a pull request.

- HN, 11 comments across 6 threads: "The code viewer is completely unusable for
  any file longer than a hundred lines. I have to clone it and browse locally
  instead." Starlevel004, 2025, https://news.ycombinator.com/item?id=44800208.
  "scrolling a page showing a file of 200 lines is very painful. One with more
  than 2000 lines crashes the tab." https://news.ycombinator.com/item?id=38638743.
  "The inspection of identifiers interferes with being able to properly select
  text." https://news.ycombinator.com/item?id=46139550. The blame page has its
  own 129-point story, "GitHub is starting to feel like legacy software",
  https://news.ycombinator.com/item?id=40949034: the page renders lazily, so
  browser find fails.
- Reddit, 7 comments across 5 threads: "the new code view is so slow and
  bulky... I should never be forced to wait over a second after simply
  scrolling text" (https://www.reddit.com/r/programming/comments/13c724e/github_search_and_code_navigation_update/jjg9e4o/).
  "Do not mess with browser keybinds." 210 points,
  https://www.reddit.com/r/programming/comments/yrphfe/github_introduces_an_allnew_code_search_and_code/ivvxu2e/.
- GitHub Community, 1330 upvotes: `--ignore-revs-file` for blame
  [#5033](https://github.com/orgs/community/discussions/5033) 588, select
  non-consecutive lines [#5022](https://github.com/orgs/community/discussions/5022)
  477, symbols panel forced on users
  [#54962](https://github.com/orgs/community/discussions/54962) 184, code view
  beta feedback [#48301](https://github.com/orgs/community/discussions/48301)
  101 with 618 comments.
- Competitors: about 35 features across Octotree (23,240 stars), Gitako,
  Sourcegraph, Enhanced GitHub, Code Folding and Refined GitHub live on these
  two pages. Only the pull request files tab draws more third-party work, and
  GitQuiet already covers that.
- GitHub has not shipped a changelog entry for the file view, blame or tree
  since the 2023 rewrite. Nothing is on the way.

It also fits the vision. `docs/plan/comment-anywhere.md` records the largest
unmet demand for this product: commenting on lines the diff does not show
(#4452, 2,352 upvotes) and on files the pull request did not change (#9099,
1,299 upvotes). A file view is where the second half lands: a Remark carrying a
permalink needs a page to pick the permalink on, and a reviewer who leaves the
diff to read the whole file today lands on GitHub's own page.

## 2. Search: `/search?q=` and `/OWNER/REPO/search`

- HN, 10 comments across 8 threads: "GitHub search is (still) comically
  useless. I just clone and use grep instead."
  https://news.ycombinator.com/item?id=44803844. Only the default branch is
  indexed; a login is required.
- Reddit, 8 comments across 5 threads, including the 431-point rate-limit
  thread https://www.reddit.com/r/github/comments/1jjgjm0/.
- Community, 882 upvotes: branch filter
  [#8564](https://github.com/orgs/community/discussions/8564) 424, search
  without login [#77046](https://github.com/orgs/community/discussions/77046)
  211, team qualifier [#9023](https://github.com/orgs/community/discussions/9023) 164.

Most of this pain is in the index, not the page. A client cannot add a branch
filter or drop the login wall. The page can only redraw the results, which the
beta thread [#38692](https://github.com/orgs/community/discussions/38692) asks
for ("the new UI is taking double the space for each result"). Lower fit.

## 3. Compare and the new pull request page: `/compare/A...B`, `/compare/A...B?expand=1`

- HN, 5 comments across 4 threads: the compare button vanished from the code
  view; a force push shows a compare that is not linked to the review
  (https://news.ycombinator.com/item?id=47765135, 2026).
- Reddit, 6 comments across 3 threads: the base picker silently creates a
  branch; "creating stacked PRs is a major pain in the ass", 10 points,
  https://www.reddit.com/r/programming/comments/18bqz6j/your_github_pull_request_workflow_is_slowing_you/kc6wxj5/.
- Community, 36 upvotes in total. Low signal on GitHub's own forum.
- Refined GitHub ships two compare features and its open issue
  [#5938](https://github.com/refined-github/refined-github/issues/5938) asks
  to compare and merge without a pull request.

This is the page a pull request is born on, and the stack work on this branch
(`docs/spec/stack-preview.md`) already reasons about the base a branch sits on.
GitHub put stacked pull requests in public preview on 2026-07-30. Medium fit,
small evidence.

## Below the cut, and why

| Page | Evidence | Why not now |
| --- | --- | --- |
| Gists, `gist.github.com` | 2086 upvotes on org gists [#7923](https://github.com/orgs/community/discussions/7923); Reddit editor and 404 threads | A different host, and the ask is a server feature |
| Org home and org repositories, `/ORG` | Community 1478 upvotes for grouping [#4174](https://github.com/orgs/community/discussions/4174), [#41348](https://github.com/orgs/community/discussions/41348); Reddit 72 points on the suggested-task cards | GitHub shipped `/repos` with saved views 2026-02-24; the person repositories page here already draws one list |
| Milestones | 1072 upvotes, cross-repo [#6296](https://github.com/orgs/community/discussions/6296) 980 | GitHub roadmap [#1086](https://github.com/github/roadmap/issues/1086) is shipping it |
| Projects | 694 upvotes, all field types and depth | GitHub ships here monthly; the pain is depth, not the page |
| Settings, PATs | Reddit 599-point thread on buried PATs | Outside the vision, which is work around a pull request |
| Review queue, `/pulls?q=review-requested` | Reddit 6 comments | Already a Court: Needs You on the Working Set |
| Wiki, tags, merge queue page, security alerts, branches, discussions, insights, labels | 0 to 681 upvotes each | Thin, server-side, or nobody builds there |

## Already covered, for the record

The pull request files tab carries more pain than any uncovered page: 
[#12341](https://github.com/orgs/community/discussions/12341) 3708,
[#163932](https://github.com/orgs/community/discussions/163932) 416 with 3212
comments, the Safari thread
[#170758](https://github.com/orgs/community/discussions/170758) 405, and the
1484-point Reddit thread on the 1000-file cap
https://www.reddit.com/r/github/comments/1nyrip2/. Stacked pull requests, new
in 2026-07, drew 783 points on HN
(https://news.ycombinator.com/item?id=49112232) with squash re-approval and
stuck deleted bases as the complaints. The broken back button is the most
repeated single HN complaint and hits every page; a full page replacement
removes it by construction.

## Issues

One per page, opened 2026-09-01 on the private notes repository, in the order
to build them:
[gitquiet-notes#1 file view](https://github.com/flazouh/gitquiet-notes/issues/1),
[#2 folder listing](https://github.com/flazouh/gitquiet-notes/issues/2),
[#3 blame](https://github.com/flazouh/gitquiet-notes/issues/3),
[#4 compare](https://github.com/flazouh/gitquiet-notes/issues/4),
[#5 search](https://github.com/flazouh/gitquiet-notes/issues/5).
