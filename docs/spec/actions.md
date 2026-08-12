# Spec: Actions

Status: draft-for-review. The run screen is specified. The list screen has a decided shape
and no detail yet.

Covers two addresses: `/{owner}/{repo}/actions`, the run list, and
`/{owner}/{repo}/actions/runs/{id}`, one run. The worked example throughout is
[octo-org/octo-repo](https://github.com/octo-org/octo-repo/actions) and its run
[30866145080](https://github.com/octo-org/octo-repo/actions/runs/30866145080), read live on
2026-08-04.

## Problem Statement

GitHub's own advice is to stop using this page. A GitHub employee, writing on GitHub's DEV
account in 2026, gives the section the title "Stop Using the Log Viewer" and then says it
plainly: "The web UI for reading build logs is the single biggest source of frustration with
Actions, and the fastest fix is to stop using it."
([dev.to/andreagriffiths11](https://dev.to/andreagriffiths11/github-actions-the-stuff-nobody-tells-you-19md))
The same post lists what still needs work and puts the log viewer first: "It's improved, but
it's not where it needs to be for large builds. Use the CLI." No other page this extension
replaces comes with a recommendation from its own maker to go somewhere else.

A developer arrives at these two addresses with one question, and it is the same question
every time: **my change failed, what is the error?** The list page and the run page are both
built to answer a different question, so the developer pays for the mismatch twice before
reaching a single line of log.

### The list is a firehose, and it cannot be narrowed by hand

`/actions` is one reverse-chronological list of every run of every workflow. On `octo-repo` it
reports "2,500+ workflow runs". Counted on the first screen: 25 rows, and those 25 rows
concern exactly 5 pull requests. Thirteen are the `ci` workflow, twelve are `CodeQL`, and 14
of the 25 were triggered by a bot. Nineteen are green, two cancelled, three running, one
failed. The one row that could matter gets the same height, the same weight and the same
position rules as the nineteen that cannot.

The two rows about the same commit do not even look related. The `ci` row is titled with the
commit message, "fix(metrics): start session clock at process start". The `CodeQL` row for
the same head is titled "Code Quality: PR #1755". A reader scanning titles has no way to see
that these are one push.

Participants have been asking to curate this list for five years, in GitHub's own forum,
with votes:

- "Option to mark reusable workflows as templates to not show them under the Actions tab"
  ([#12025](https://github.com/orgs/community/discussions/12025)), 883 upvotes, 162 comments.
- "Support organizing workflows in directories"
  ([#15935](https://github.com/orgs/community/discussions/15935)), 575 upvotes, 169 comments,
  and it carries GitHub's own `Actions UI/UX` label.
- "Is there a way to delete or hide old/renamed Workflows?"
  ([#26256](https://github.com/orgs/community/discussions/26256)), 419 upvotes, 328 comments.
- "[REQUEST] Workflows seen in Actions UI separated by folder structure"
  ([#11831](https://github.com/orgs/community/discussions/11831)), 400 upvotes, 110 comments.

That is 2,277 upvotes and 769 comments across four threads asking the same thing, and every
one of the four is labelled "In Backlog". The filters GitHub offers instead (Workflow, Event,
Status, Branch, Actor) all narrow to one value at a time and none of them survive a page
load. They let a reader ask "show me failures" but not "show me my branch, whatever its
state, and stop showing me CodeQL forever".

### The run page spends its whole first screen not saying what broke

Run 30866145080 is a failure. Its first screen, at 1512 by 949, holds a header, a four-field
summary (Status, Total duration, Artifacts, trigger) and a job graph of twelve nodes. It
contains zero characters of the error. Scroll, and the sidebar appears and lists the same
twelve jobs a second time, in a different order. The page is 2,342 pixels tall and the job
list occupies it twice before any log text is offered.

The graph carries one bit of information: `integration-test` is red, and the `ci-complete`
gate is red because of it. Everything else about the graph is a ceremony over eleven green
rows. Participants have asked for the rows that carry nothing to stop being drawn: "Hide Jobs
in Actions UI when If is false"
([#18001](https://github.com/orgs/community/discussions/18001)), 357 upvotes; "Properly show
continue-on-error jobs/steps in PR UI"
([#15452](https://github.com/orgs/community/discussions/15452)), 316 upvotes; "Hide/Group jobs
in the status checks list"
([#26246](https://github.com/orgs/community/discussions/26246)), 137 upvotes.

### The annotations know the answer and bury it

That same run carries "3 errors, 1 warning, and 10 notices", drawn as 14 rows of one table,
all styled alike. Read them in order:

1. `architecture`: "Process completed with exit code 1."
2. `integration-test`: "Process completed with exit code 1."
3. `error: expect(received).toContain(expected):` and then the assertion itself, "Expected to
   contain: `App dev runtime listening`. Received: `[app-runtime] ... INFO
   dev.auth.configured ...`"
4. `lintcn`: Node.js 20 deprecation notice.
5 to 14. Ten copies of the same `schemaNumber` notice, on ten lines of two files, each
   telling the reader to use `Schema.Finite`.

Row 3 is the answer. It is the only row that says what broke. It sits below two rows that say
nothing, and above ten rows of a lint opinion that has no bearing on this failure and repeats
itself ten times. Sorting by severity would not fix it either, because the two useless rows
are the errors and the useful one is reported at the same level.

### The log viewer is the part everybody leaves

GitHub collected its own survey answers about Actions and published them
([gist](https://gist.github.com/jenschelkopf/8dbab326522ae01ac5ced596adf88b19)). On the log
viewer, in Participants' own words:

- "the UI is slow when showing the progress. it is also hard to see the log because the
  view-able space is too narrow"
- "log viewer is broken beyond recognition - search doesn't work - frequently can't load logs
  - scroll UX"
- "logs is too many, make the red x just go straight to the first error"
- "when the log view it should automatically show the last few lines instead of the first ones"
- "searching the logs is completely useless, because it doesn't jump to the search result. I
  always go right for the raw logs. The browser is at least three orders of magnitude faster
  at searching the raw log"
- "Copying-and-pasting from the log includes the line numbers, which I then have to manually
  delete, which is tedious."
- "windows within windows is a terrible UI"
- "when the matrix data is complex (i.e. an entry in the matrix contains 3 or more fields)
  then the matrix result is hard to read in the UI"

Under GitHub's own engineering post about how the viewer renders large logs, on Hacker News
([26582263](https://news.ycombinator.com/item?id=26582263)): "I find their log browser
infuriatingly useless... like: actively harmful. It punished me so much and so often and so
consistently for having the gall to think that logs would be useful that I finally became
demoralized and gave up trying to use their interface." And on the virtualised scrolling
specifically: "I want to jump to the end of the log immediately, since that's presumably
where I will find my error, but instead of being able to do that in one step, I get stuck in a
treadmill of endlessly lazy-loaded log lines; every time I get to the bottom of the window,
it's no longer the bottom of the window anymore."

One request about log structure has real weight: "Better log separation for composite actions"
([#21276](https://github.com/orgs/community/discussions/21276)), 402 upvotes, 154 comments. A
composite action's steps collapse into one unnamed block, so the fold structure the viewer is
built around stops corresponding to anything.

### The workaround economy is the proof

When a page fails, people route around it. The tools that exist only to avoid this page:

- `gh run view --log-failed`, recommended by GitHub's own employee in the post quoted above,
  and by every debugging guide written since.
- A browser extension whose entire purpose is to render the **raw** log instead of the pretty
  one, because the pretty one cannot be searched:
  [laurent22/github-actions-logs-extension](https://github.com/laurent22/github-actions-logs-extension).
  Its README: "searching is done in real time... which mostly means it will freeze for a
  minute or two for each letter you type in the search box."
- Three separate terminal interfaces, each advertising the same missing feature. `gha-tui`:
  "Open a failed job's log and the viewer scrolls directly to the first failed step. No more
  scrolling through 40k lines of green checkmarks to find one red x." `gh-hound`: "Multiple
  page loads to reach the failing step" listed as the web friction it removes. `gh-observer`,
  for watching runs without the page at all.

A browser extension that renders raw text instead of GitHub's viewer is the closest existing
thing to what this spec proposes, and it wins on the only axis that matters to the reader.
That is the bar.

### The cost, counted

From the list page to the text of the error, on the worked example: three page loads (list,
run, job), then find the failing step among the job's steps, then expand it, then scroll.
GitHub does offer one shortcut, the annotation deep link, `#step:4:268`, which lands on the
right line. It is only useful when the annotation says something, and on two of this run's
three errors the annotation says "Process completed with exit code 1."

## Solution

Five principles fall out of the problem, and the rest of this section is their consequences.

1. **The unit of the list is not the run.** Twenty-five rows described five pull requests.
   The list screen groups by branch, with every run of every workflow folded into the branch
   it belongs to.
2. **Green is a count, not a row.** Eleven passing jobs and nineteen passing runs are one
   number each. Failure gets the space.
3. **The error text belongs on the run screen.** Not one click away, not behind a job page.
   The reason a run is red is the content of the run screen.
4. **Annotations rank by usefulness, not by level.** Ten identical notices are one row with a
   count. "Process completed with exit code 1." is not an error report and never outranks the
   assertion that produced it.
5. **Curation is the Participant's, and it persists.** The four backlogged threads above are
   one request: let me put a workflow away. Settings are already remembered per Participant,
   so this extension can do what GitHub has not.

### The Run screen

`/{owner}/{repo}/actions/runs/{id}`. One screen, and the reader's question answered above the
fold.

**The Fault comes first.** For a failed run, the top of the screen is the failing job's name,
the failing step's name, and the tail of that step's log, on the first screen, with no click.
On run 30866145080 that means `integration-test`, step 4, and the assertion:
`Expected to contain: "App dev runtime listening"`. Where a run has more than one failing job,
each gets its own Fault, in the order the jobs failed.

**A Standing line, not a summary grid.** One line carries what GitHub spends four fields on:
the conclusion, the total duration, the trigger, the actor, the branch and the pull request.
It is a line because none of it is the answer to the reader's question.

**Jobs are a list, and passing jobs are a count.** Eleven green jobs collapse to "11 passed"
with their total time. Failing, running and cancelled jobs are rows. Skipped jobs are a
count, never rows, which is [#18001](https://github.com/orgs/community/discussions/18001)
answered. The job graph is not drawn: on the worked example it carried one bit of information
across twelve nodes, and `needs:` order is already implied by the order jobs failed in.

**The three presses are on the Standing line, and only where GitHub offers them.** Running
every job again, running the failed jobs again, and cancelling a run that is still going.
Each is a Rails form on their own run page, so the fact that a press is available is the
form being there: a finished run carries no cancel, a run with nothing failed carries no
failed-jobs press, and a run whose workflow file has gone carries neither re-run. Nothing
here works that out from the conclusion. Each press asks twice, because a re-run spends
somebody's minutes and a cancel throws away what is running. The routes and what they did
when they were exercised are in `docs/spec/github-write-api.md`.

**A failure the run carried on past is not a Fault.** A job written with
`continue-on-error: true` reports `conclusion: "failure"` and the run around it reports
`conclusion: "success"`, which is the whole of the signal GitHub gives: measured on run
31641974931 of `flazouh/ghpro-scratch`, where `might-fail` answered `failure` under a run
their own page headed "completed successfully". So a failing job inside a succeeded run is
Tolerated. It is a row rather than a count, said as "Allowed to fail", and it leads to its log
like any other row; it is not counted red, and a run whose only failures were tolerated opens
with no Fault at all. This is [#15452](https://github.com/orgs/community/discussions/15452)
answered, and it is answered the same way on a pull request's checks list, which reads the run
behind a failing check to find out. That read is behind the first paint rather than in front of
it: the checks are drawn as GitHub reported them, and a tolerated one turns from red to
"Allowed to fail" when its run answers, the way a remembered pull request has always corrected
itself a second after it appears. In front, a pull request with three failing runs would wait
for three half-megabyte documents before drawing anything, which is exactly the pull request
somebody is in a hurry about. The softening only ever goes from red to tolerated, so no check
passes through green on the way. A step written with `continue-on-error: true` is a
different thing and is not covered: GitHub reports that step as `success` outright, so its
failure exists only in the log and there is nothing to read.

**Notes are grouped, then ranked.** Identical messages collapse into one row with a count, so
ten `schemaNumber` notices are one row reading "10 files". Rows carrying no information are
demoted below rows carrying some, regardless of level: a note whose whole text is "Process
completed with exit code 1." sits under the assertion that caused it. Where a note names a
file and a line it links to the file, and where it names a log spot it links to the step.

**The log opens in place.** Selecting a step shows its log inside the screen, with no second
window. Reasons from the survey answers, each answered: it opens at the end, not the start; it
opens at the first failure when there is one; the browser's own find works because the lines
are text and not a virtualised list; and copying a selection copies the words without the line
numbers.

**Steps of a composite action are not one unnamed block.** Where the step list gives a
composite action's inner steps, they are rows under their action, which is
[#21276](https://github.com/orgs/community/discussions/21276) answered as far as GitHub's own
step data allows.

### The list screen, in outline

Grouped by branch. Each branch shows its head commit, the count of runs against that head,
and the conclusion of the worst of them. A branch with a pull request shows the pull request.
Workflows the Participant has put away never appear, and putting one away is remembered.
Detail is deferred to its own pass.

**And the unit is not quite the branch.** Read on 2026-08-04, the same page carried 25 rows
over 12 refs, and every row names a ref: ten of them are `refs/heads/<branch>` and two are
`refs/pull/<n>/head`, which is how a `pull_request_target` workflow is run. Both of those
pull refs, 1749 and 1758, are also pull requests named on rows whose ref is a head branch.
So grouping on the ref alone puts pull request 1758 on the screen twice, once as a branch
with three `ci` runs and once as `refs/pull/1758/head` with three `CodeQL` runs, which is the
fault this screen exists to remove.

The unit is therefore the work, not the ref: a pull request where the rows name one, and a
branch where they do not. Matching on the pull request number is not a guess. A row on a head
branch links its pull request by number, and a row on a pull ref has the number in the ref
itself, so two rows that agree on it are two runs of one pull request.

The count in the Problem Statement above says twenty-five rows described five pull requests.
That was an earlier reading of the same page. Recounted on 2026-08-04 it is 25 rows over ten
pull requests, which is a smaller reduction and the same complaint. On `oven-sh/bun` the same
day, the whole first page of their Actions tab was 25 rows over two pull requests.

The unit is called a Strand, and `CONTEXT.md` carries the word.

**A re-run answers for the Attempt it re-ran.** The first drawing of this screen took a
Strand's standing to be the worst of every Run on its head, which is the rule a Run uses for
its Jobs and is wrong here. Two rows of the live page said so at once: one read "Cancelled"
over a Strand whose `ci` was running at that moment, because a cancelled Attempt sat behind the
Run that replaced it, and the next read "Failure" over a Strand a re-run had already fixed. So
a Strand stands on the newest Run of each of its Workflows, and the worst of those. Across
Workflows the worst really is the answer: two Workflows of one commit are two results, and a
red one is a red head however green the other is. The Attempts they replace are counted as
superseded and drawn nowhere.

**Three things the live page corrected, and all three were readings of their markup.**

Their row's label for a screen reader is a sentence with the commit's title in it: "requires
action with the application:  Run 11317 of source-lints." and then the title. Reading the
outcome out of that whole string made a commit titled
`fix(console): prepend "Assertion failed: " prefix` report every one of its five Runs as a
failure, because the word was in the title. The outcome comes off the icon's own label, which
says only the outcome, exactly as the Run screen reads it.

Their `action_required`, which is a fork's Run held until somebody with write access allows it,
was in none of the seven words this vocabulary has and fell through to neutral. Twenty of
bun's twenty-five rows were in that state, drawn grey and reported as nothing. It is read as
queued now: it is waiting on something, and queued is drawn in the colour of something that
wants attention.

Five of bun's twenty-five rows name no ref at all, which is how their `Comment Cop` runs
arrive. Requiring a ref dropped all five silently. A Run whose row names a pull request belongs
to that pull request whether or not it names a ref, so the ref is a field that may be missing
rather than a reason to drop a Run.

### What the list screen does not do yet

Their sidebar of Workflows is a filter, and this screen groups instead, so
`/actions/workflows/ci.yml` stays GitHub's until this screen can filter. Their paging is
theirs too: this reads the first page, which is the page their Actions tab opens with. Put Away
is specified above and not built, and it is the piece that needs the list screen to exist
before it means anything.

## Implementation Decisions

### The place

A run is a server-rendered Turbo page with `react-partial` islands, measured on 2026-08-04:
the content region is `turbo-frame#repo-content-turbo-frame`, 1512 by 2242 at top 100. There
is no `#repo-content-pjax-container` and no `react-app`, so the soft gate waits on the frame
rather than on a React app name. Recorded in `scripts/probe-run-dom.js`.

### Data access

One HTML fetch of the run page carries the summary, the jobs and the notes. Everything below
was read off GitHub's own traffic and is recorded in full in `scripts/probe-run-dom.js`.

| Want | Source |
| --- | --- |
| Conclusion, duration, trigger, actor, branch, pull request, workflow, run number | `<run-summary>` in the run page HTML |
| Every job: name, conclusion, duration, check run id | `<streaming-graph-job>` elements, conclusion off the icon's `aria-label` |
| Notes | `<annotation-message>` elements, the same element `src/github/annotations.ts` already parses |
| Check suite id | `<job-summaries data-channel>`, base64, `{"c":"check_suites:…"}` |
| Jobs again, cheaply, for polling | `/actions/runs/{id}/navigation_partial?selected_tab=summary`, JSON |
| Steps of one job | `/actions/runs/{id}/jobs/{internalJobId}/steps?change_id=0`, JSON, `Accept: application/json` or it answers 400 |
| One step's log | the `log_url` the steps response already carries, which is `gateway.log`'s route |

The steps route wants an internal job id, which is not the check run id and cannot be paired
by position with the `downstream_list` fragments on the page (measured: fragment
`73783363310` is second and belongs to the fifth job). The path that works is the one
`src/github/steps.ts` already walks, from a check run id through the job page HTML. It costs
one extra fetch per job, and only failing jobs need it.

So `gateway.steps` and `gateway.log` are reused as they stand. What is new is a read of the
run page and a mapping from a run id to a job's check run id.

Two things came out of writing the parser against the real page and are now settled in code.

Their note links use two spellings for one thing. A pull request's Checks tab writes
`#annotation:4:43` and a run page writes `#step:5:54`, and both mean step five, line
fifty-four. `spotIn` in `src/github/annotations.ts` reads either, because a note is the same
note and a screen following it should not care which of their pages it came off.

A note is not one line. The note that broke the worked run is 4,271 characters: the assertion,
and then every log line the assertion had captured. Its first line is
`Expected to contain: "App dev runtime listening"`, which is the whole answer. So a gathered
note carries a `headline` beside its full `message`, and the screen shows the headline with the
rest available. GitHub does the same thing to the same text, behind a "Show more" button.

A third came out of drawing it. Their two pages colour a notice differently. A pull request's
Checks tab draws one in `color-fg-accent`; a run page draws the same note with `octicon-info`
in `color-fg-muted`. Only the accent was in the table in `src/github/annotations.ts`, and the
table falls through to `failure`, so every one of the worked run's ten notices was read as a
failure and drawn in the failure colour. Ranking then had nothing to sort by, and a notice
about `Schema.Finite` sat above a real deprecation warning. Both spellings are read now.

### The Run screen and their router

A Run stands inside `turbo-frame#repo-content-turbo-frame`, which is different from every
other screen here: the others stand in a container within that frame. Turbo replaces the
frame's children wholesale on a soft navigation, so the Run's container can be off the
document before the screen replacing it has anywhere to stand.

That broke the sweep. A takeover finds the screen it replaces by searching the document for
the leaving mark, and a container their router already removed is in no document to be found.
Nothing told that React tree it was off the page, so it stayed mounted and its bar stayed in
`#gitquiet-bar` beside the new one. Two bars, and it needs their router to be quick, which is
why it could not be reproduced on purpose: four clean transitions in a row, then one double.

`mount.ts` holds on to the container it marked, and takes it off the page when it settles and
finds it disconnected. Held in the module doing the replacing, which is the module that marked
it, so a screen never reads another screen's memory: each screen is built as its own bundle.

### Live output

Deferred, and not promised on this screen yet. The public API refuses in-progress log text:
`GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs` answers 404 until the job completes,
and the `?tail_logs=true` behaviour that once returned partial output stopped working
([#154834](https://github.com/orgs/community/discussions/154834)). GitHub's own page streams
over a websocket on the `check_suites:{id}` channel, whose signed token the run page hands
out, so the channel is reachable in principle from a content script. Until that is measured
against a running job, a running run refreshes on a timer and says so.

## Open questions

- **Vocabulary.** `CONTEXT.md` has Check, CheckNote and JobStep. It has no word for a run, a
  workflow, an attempt, or the thing this spec calls a Fault. Naming those comes before the
  first line of code, per the Language section of `CONTEXT.md`.
- **Runs with no pull request and no branch.** A `merge_group` run showed on the list with an
  empty branch cell. Grouping by branch needs a home for those.
- **Attempts.** `navigation_partial` takes `?attempt=1` and the page has a "viewingCurrent"
  flag, so re-runs are addressable. Whether the run screen shows attempts as a switch or as
  history is undecided.

## Evidence

Every claim above, with what it is worth. Counts read live on 2026-08-04. Upvote counts are
from GitHub's own community discussions, Actions category, sorted by top.

| Complaint | Weight |
| --- | --- |
| Reusable workflows clutter the Actions tab | [#12025](https://github.com/orgs/community/discussions/12025), 883 upvotes, 162 comments, In Backlog |
| Workflows cannot be organised in directories | [#15935](https://github.com/orgs/community/discussions/15935), 575 upvotes, 169 comments, `Actions UI/UX`, In Backlog |
| Old or renamed workflows cannot be hidden | [#26256](https://github.com/orgs/community/discussions/26256), 419 upvotes, 328 comments, In Backlog |
| Composite action logs have no separation | [#21276](https://github.com/orgs/community/discussions/21276), 402 upvotes, 154 comments, In Backlog |
| Workflows not separated by folder structure | [#11831](https://github.com/orgs/community/discussions/11831), 400 upvotes, 110 comments, In Backlog |
| Jobs skipped by `if` are still drawn | [#18001](https://github.com/orgs/community/discussions/18001), 357 upvotes, 93 comments |
| `continue-on-error` jobs shown as if they counted | [#15452](https://github.com/orgs/community/discussions/15452), 316 upvotes, 55 comments, In Backlog |
| Jobs cannot be hidden or grouped in the check list | [#26246](https://github.com/orgs/community/discussions/26246), 137 upvotes, 57 comments |
| No live log text from the API | [#154834](https://github.com/orgs/community/discussions/154834), 9 upvotes |
| Log viewer is the biggest source of frustration | GitHub employee, on GitHub's DEV account, 2026 |
| Log search freezes, cannot jump to a match, raw log preferred | GitHub's own survey answers, multiple Participants |
| Lazy-load treadmill defeats "jump to the end" | Hacker News, under GitHub's engineering post |
| Log line numbers come along on copy | GitHub's own survey answers |
| Matrix results unreadable past three fields | GitHub's own survey answers |
| 25 rows on the first screen describe 5 pull requests | measured, `octo-repo`, 2026-08-04 |
| 14 of 25 runs on the first screen are bot-triggered | measured, `octo-repo` |
| Two rows for one commit carry unrelated titles | measured, `octo-repo`, `ci` versus `CodeQL` |
| First screen of a failed run holds no error text | measured, run 30866145080 |
| Job list drawn twice on one run page | measured, run 30866145080 |
| The one useful annotation is row 3 of 14 | measured, run 30866145080 |
| Ten identical notices drawn as ten rows | measured, run 30866145080 |
| Three page loads from list to error text | measured, `octo-repo` |

## Further Notes

**This widens the vision again, and `CONTEXT.md` still says otherwise.** That document reads
"Make the work around a pull request as good as it can be… That is the whole of it". A Run
reached from the Actions tab is not on a pull request, and some Runs have no pull request at
all. The sibling Home spec already raised this for Home, Involved Issues and Activity and the
sentence has not changed yet. Actions is the fourth thing outside the line, so the line should
move on purpose, in writing, before more is built against it.

The Language section above is the part of that already done: `CONTEXT.md` now names Workflow,
Run, Job, Attempt, Fault, Note and Put Away, and records that a Check on a pull request and a
Job on its Run are one object with two ids.
