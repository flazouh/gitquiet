# Spec: Control Center

Status: problem researched, first cut shipped behind the panel, one row still wrong

Covers the panel at the top of `/{owner}/{repo}/pull/{number}`: one pull request filed by who
owes the next move rather than by what its parts are. CONTEXT.md has named this the Control
Center since before anything answered to the word. The worked examples throughout are
[octo-org/hello-world#503](https://github.com/octo-org/hello-world/pull/503) and
[octo-org/octo-repo#1755](https://github.com/octo-org/octo-repo/pull/1755), read live
on 2026-08-04.

## Problem Statement

GitHub's pull request page is filed by object type. Description, then checks, then
conversation, then commits, then merge. That is a good order for reading a pull request and a
bad order for finding out what is left of one, and every participant re-derives the second from
the first on every visit.

The panels this extension already draws keep that order, because it is the right order for the
question they answer. Nothing on the page answers the other question.

### The size of the complaint

Counted from GitHub's own community discussions, by upvotes and by comments:

| Upvotes | Comments | Discussion |
|---|---|---|
| 3708 | 2401 | [#12341 Pull Request File Tree feedback](https://github.com/orgs/community/discussions/12341) |
| 2352 | 79 | [#4452 comment on unedited lines](https://github.com/orgs/community/discussions/4452) |
| 463 | 164 | [#10369 PENDING comments](https://github.com/orgs/community/discussions/10369) |
| 407 | 3173 | [#163932 Files Changed feedback](https://github.com/orgs/community/discussions/163932) |
| 214 | 35 | [#9956 changes to a file in later commits](https://github.com/orgs/community/discussions/9956) |

Three thousand one hundred and seventy three comments on a feedback thread is not a page people
are indifferent to.

### Nobody is asking for a list of unread files

The first cut of this panel treated an unread file change as something owed, because CONTEXT.md
lists it among the Attention Items. On #503 that produced thirty rows, each one a path, and the
panel came to roughly seven hundred pixels of them. The failing check and the unanswered
questions were below the fold, put there by the files.

The research says the row should not exist at all, and says it three ways.

1. The only viewed-related request with any weight is a keyboard shortcut for ticking them:
   [#10197](https://github.com/orgs/community/discussions/10197), 130 upvotes. Nothing found
   asks to see the ones not ticked.
2. The loudest demand around the checkbox is to clear every one of them at once, and it lives
   outside GitHub because GitHub never built it:
   [refined-github #2865](https://github.com/sindresorhus/refined-github/issues/2865), a
   [Stack Overflow question](https://stackoverflow.com/questions/69945775/how-to-unview-toggle-all-the-viewed-files-on-github-pull-request)
   answered with five different bookmarklets, and one answer there written by somebody who
   clicked 1100 checkboxes and got rate-limited: "GitHub doesn't like it when you send 1100
   requests at once and I got a whole lot of 429 (rate limited) responses". People fight this
   checkbox. They do not keep score with it.
3. Where it is spoken of well, it is in support of something else. The second most reacted
   comment on #163932, 66 reactions, asks for comment counts on the diff file header and gives
   the reason: "It's very useful when you've marked a file as 'viewed' because you can see how
   many comments it has".

A tick a reader puts on a file to keep their own place is not a debt. The tree beside this panel
already lists every file and marks the ones not read, and which file to open next is navigation.

### Did the author fix it

The most reacted comment on the whole Files Changed feedback thread, 160 reactions, is a request
to scroll the page while a comment is open, and the reason given is the whole review loop:

> When a comment is outdated, we need to look at the current version to check if it actually
> addresses the comment.

[#9956](https://github.com/orgs/community/discussions/9956), 214 upvotes, is the same loop
written out at length. A reviewer comments. The author replies "done" and pushes. Then:

> As reviewer, when reviewing this change, I can see the comment that author has fixed but no
> way of seeing what the change is. If I click "view changes" it just displays all the files in
> the PR not the one with the comment. For large PRs this is a pain as I have to find the file,
> and then go to the latest commit. But when viewing that file, there is no trace of my original
> comment / conversation so I cant easily recall where the comment was or what it was about so I
> have to click back to the conversations list to find it again.

It ends with the reviewer doing the thirty-row list by hand and hating it:

> when seeing the list of "viewed" files in a PR (i.e. theyre collapsed), there's no indication
> as to which ones have comments in them. So I have to unclick "viewed" on each of them to see
> if there was a comment in there that need to be re-reviewed.

The thing that person wants at the end of all that unclicking is not the file list. It is the
answer to whether the author fixed what they asked for.

### The delta breaks exactly when it is needed

GitHub's own answer to the returning reviewer is Changes since last review, and it is anchored
to a commit. A rebase or a squash orphans that commit, and the reviewer gets "We went looking
everywhere, but couldn't find those commits". What that costs, from
[Jacob Tomlinson](https://jacobtomlinson.dev/posts/2022/dont-prematurely-squash/rebase-and-force-push-your-prs/):

> I generally have to start my mental review process from the beginning and review everything in
> the PR as if it's the first time I've seen it.

The same failure has a Git-native answer nobody has wired into a browser: `git range-diff`
compares two commit ranges as patches and survives the rewrite. It is the feature every thread
of Gerrit and Phabricator refugees is describing when they say GitHub cannot do interdiffs.

### The workaround economy is the proof

When a page fails, people route around it. Around this one:

- Bookmarklets and console snippets for the viewed checkboxes, in at least four places, one of
  them with a `setTimeout` in it to avoid GitHub's rate limiter.
- Whole review products built on GitHub's API rather than its page: Graphite, Reviewable,
  CodeApprove, and a browser extension called Crocodile whose author describes it on Hacker News
  as "a file browser to the left plus floating comments".
- Reviewing in an editor instead: `microsoft/vscode-pull-request-github` exists partly so people
  can tick viewed state per folder, which the web page will not do.

### The cost, counted

On #503, a pull request with 30 changed files and 12 remarks: the reviewer's own state is spread
across the Conversation tab, the Files changed tab, the commits picker and 30 collapsed diffs.
There is no number anywhere on that page for how many threads are waiting on them. GitHub's new
Files changed page will not show more than 300 files at all, by their own changelog, and falls
back to the classic page above that.

## Solution

Four principles, and the rest is consequence.

1. **The unit is the move, not the object.** Every piece of a pull request that can be owed to
   somebody is filed in exactly one of the four Courts, the same four the Working Set sorts
   whole pull requests into.
2. **Who owes it is decided by who spoke last.** It needs no guess about whether the reader is
   the author or a reviewer, and it survives the case where they are both.
3. **A machine owing the next step is Running, not Waiting.** Nobody can be asked to hurry a
   re-review, and a Court that sends the reader to chase a person who is not blocking anything
   is the mistake the four Courts were drawn to fix.
4. **What is done is a count, not a list.** Settled starts folded. On a merged pull request in
   `octo-repo` the unfolded version was forty eight rows and twelve hundred pixels, every one of them
   true and none of them owed.

### What the panel holds

Built and verified live on #1755 and #503:

- Review threads, filed by who spoke last, resolved ones Settled.
- Bot Findings, apart from threads because six findings and six colleagues are the same number
  and not the same afternoon. A finding the reader answered goes to Running.
- Checks. Failed and cancelled are the reader's, unfinished are the machine's, green are
  Settled.
- The branch, while it is behind, and Waiting rather than Your Move where GitHub refuses the
  button because the write belongs to somebody else.
- A stack layer whose foundation is closed, which is Your Move. GitHub keeps a stacked pull
  request's base on the stack and refuses to change it while the stack holds it, so a layer
  left on a closed foundation goes on comparing against a branch nobody is landing. Nothing
  else on the page says so: the diff is not marked suspect and the file count is not marked
  inflated. `OpenRouterIncubator/ori#2103` read as sixteen files and four hundred lines for
  hours, and its change was two files and sixteen. Merged foundations are not this, being how
  a stack drains, and GitHub retargets what is left of one.

### The done state has to say so

Settled on its own is the answer "nothing is owed", and until it was checked against a
deliberately quiet pull request it did not say that. `flazouh/ghpro-scratch#9` has one passing
check and nothing else on it at all, and the panel drew two lines: the heading, and a folded row
reading `Settled 1`. The reader had to work the answer out from the Courts that were absent.

The sentence existed and was unreachable. It asked for every Court to be empty, and nearly every
repository puts a green check on every pull request, so the state it was written for almost never
happens. It now appears whenever nothing outside Settled holds anything, above the folded Settled
row rather than instead of it.

### Every row that can go somewhere, goes there

The delta row counted commits and opened nothing, which made it the one row in Your Move that
dead-ended while every thread beside it opened its line. Pressing it now opens the oldest commit
the reader has not seen, which is where picking the reading back up starts.

The rewritten row stays text on purpose. The commit it would have opened is the one thing that is
gone.

### What replaces the file row

Not "30 files to read". The returning reviewer's delta: what has landed since their Last Review
Point. `PullRequestSnapshot` already carries `viewer.lastReviewPoint` and the commit list, so
the count of commits since that point costs nothing to compute today. Naming the files in that
delta needs a second read, because `Commit` carries no file list.

For a reader who has never reviewed this pull request there is no Last Review Point and there is
no delta, and the row is simply absent. The whole pull request is the delta, and the tree says
so better than a count would.

## Implementation Decisions

### The place

No route, no screen, no build entry. The pull request address already renders `src/ui/Shell.tsx`,
whose left column is the by-kind list. The Control Center is the first panel of that column and
the five keep their order under it.

### Data access

`attentionIn` in `src/domain/attention.ts` takes six facts and nothing else: the viewer's login,
the state, the threads, the checks, the files and the merge state. It is pure, and every rule
above is one of its branches. `docketsIn` files the result into the four Courts.

### Reading a machine's login

`participantOf` in `src/github/snapshot.ts` marked an author automated only where GitHub sent
`isAgent`. Devin's review comments arrive with `isAgent` false and no `automatedComment`, so the
same app was a machine in the conversation and a colleague on a line of code. It now reads the
`[bot]` suffix as well, which is what the remarks path always did.

### Checking the situations

`bash scripts/scratch-scenarios.sh` opens one pull request per situation in
`flazouh/ghpro-scratch` and prints their numbers, and
`ego-browser nodejs < scripts/probe-owed.js` walks them and says what every row of every Court
reads as. A real repository is whatever it happens to be doing that afternoon; these are states
somebody chose.

| Situation | What the panel must draw |
|---|---|
| Commits landed after the reader's review | `2 commits since you last reviewed`, Your Move |
| The reader reviewed the newest commit | no delta row |
| Rebased since the reader's review | `Rewritten`, Your Move |
| One passing check and nothing else | `Nothing is owed here` above a folded Settled |
| The base has moved on | `Behind main`, Your Move |

The last one costs more than the others, and it is worth knowing the price before starting.
`mergeStateStatus` is `CLEAN` on a branch that is genuinely behind until some rule requires it to
be current, and `branchUpdate` reads exactly that status, so `Behind main` cannot be made to
appear without such a rule. A private repository cannot carry a ruleset without GitHub Pro:
creating one answers 403 with "Upgrade to GitHub Pro or make this repository public". So reading
this one situation means making `flazouh/ghpro-scratch` public, adding a
`required_status_checks` rule on `main` with `strict_required_status_checks_policy` true, walking
the panel, then deleting the rule and making the repository private again.

Two things follow from that, both learned the hard way on 2026-08-04. Delete the rule before
reading the done state, because while it is on every branch in the repository is behind and no
pull request there owes nothing. And confirm the deletion while the repository is still public:
once it is private again, every rulesets endpoint answers 403, so the only evidence left is that
no pull request reports `BEHIND`.

Two situations have no cheap scratch fixture and are checked on real pull requests instead: a
thread somebody else spoke in last, and a finding, since neither a second person nor a reviewing
app can be conjured into a scratch repository. `octo-org/octo-repo#1750` holds both.

## Open questions

- CONTEXT.md lists "an unread file change" among the Attention Items. The evidence above says
  that line was written before anybody looked, and it should become the Last Review Point delta.
- Whether a thread whose lines changed after it was written should be its own kind. It is the
  160-reaction complaint and the whole of #9956, and it is the next thing to build.
- Whether the delta can survive a rebase without a second read. `range-diff` is the answer in
  Git; there is no browser-side equivalent yet.
- Whether the delta row should open the whole delta rather than its oldest commit. It opens one
  commit because that is the affordance the commit list already has, and a range view would be a
  second read against GitHub.
- Whether `Behind main` belongs in Your Move at all where nothing requires the branch to be
  current. GitHub offers the update button in that case and this panel stays quiet, on the
  grounds that optional housekeeping is not a debt — the same argument that retired the file row.

## Evidence

- [#12341](https://github.com/orgs/community/discussions/12341), 3708 upvotes, 2401 comments.
- [#4452](https://github.com/orgs/community/discussions/4452), 2352 upvotes.
- [#10369](https://github.com/orgs/community/discussions/10369), 463 upvotes, already cited in
  CONTEXT.md for the word PENDING.
- [#163932](https://github.com/orgs/community/discussions/163932), 407 upvotes, 3173 comments.
  Top reacted comment 160, second 66.
- [#9956](https://github.com/orgs/community/discussions/9956), 214 upvotes.
- [#10197](https://github.com/orgs/community/discussions/10197), 130 upvotes.
- [#33663](https://github.com/orgs/community/discussions/33663), 174 upvotes, "Pull request page
  become so slow when pr is big".
- [refined-github #2865](https://github.com/sindresorhus/refined-github/issues/2865) and the
  [Stack Overflow thread](https://stackoverflow.com/questions/69945775/how-to-unview-toggle-all-the-viewed-files-on-github-pull-request).
- GitHub's own changelog, [22 January 2026](https://github.blog/changelog/2026-01-22-improved-pull-request-files-changed-page-on-by-default/)
  and [17 July 2025](https://github.blog/changelog/2025-07-17-pull-request-files-changed-public-preview-experience-july-17-updates/),
  for the 300 file ceiling and the parity gaps.

## Further Notes

Every discussion above is somewhere this extension can be described once it does the thing being
asked for. #9956 and the 160-reaction comment are the same request and are the next thing to
build; #4452 is the largest single one and is a diff feature rather than a panel.
