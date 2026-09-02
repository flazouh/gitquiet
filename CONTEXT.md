# gitquiet

## Vision

Make the work around a pull request as good as it can be: reading a diff, reviewing,
commenting, answering what an automated reviewer left behind, and merging.

That is the whole of it. Everything below is a mechanism in service of it, and any
mechanism here can be replaced by a better one without the vision changing.

GitHub is where this work happens, so GitHub is where this runs. The data and the
workflow are theirs and are not the part worth replacing — the interface over them
is. Their pull request pages file information by object type, conversation, commits,
checks and files, which leaves every participant re-deriving what is owed on every
visit. This interface files the same data by what is owed to whom, and writes back
through GitHub's own routes so that nothing done here is invisible to anyone still
using their page.

## Language

### Attention

**Attention Item**:
Anything on a pull request that can be owed to someone: a review thread, a failing check, a bot finding, what has landed since the reader's Last Review Point, or an out-of-date branch. Not a file the reader has left un-ticked: Reviewed State is a bookmark they keep for themselves, and `docs/spec/control-center.md` counts the evidence.
_Avoid_: task, todo, notification

**Remark**:
Something said about a pull request as a whole rather than about a line of it: a deploy notice, a "pushed the fix", a screenshot report. Not an Attention Item — nobody owes it a move and there is nothing on it to resolve — but part of the conversation, and the only conversation some pull requests have.
_Avoid_: issue comment, timeline comment, general comment

**Court**:
Who owes the next move on an Involved Pull Request: the Participant, another person, a machine, or nobody. Every Involved Pull Request sits in exactly one of the four.
_Avoid_: owner, assignee, status

Courts sort the Working Set — the Participant's pull requests across repositories. They do not sort what is inside one pull request: that screen is laid out by kind, description then checks then conversation then commits then merge. Grouping a single pull request by Court is a thing that could be built and has not been.

**Needs You**:
The Court holding pull requests the viewing Participant can act on now. Includes one GitHub's own dashboard leaves elsewhere: their own pull request, green, with no rule requiring an approval, which is a live merge button rather than a wait.
_Avoid_: open, actionable, pending

**Waiting**:
The Court holding pull requests where another person owes the next step. A review asked of somebody else, and nothing more. Was "Waiting On Others", which also held a running build and a stranger's pull request nobody was waiting on, so the word told a reader to relax about three unrelated things.
_Avoid_: waiting on others, blocked, awaiting

**Running**:
The Court holding pull requests where a machine owes the next step and only time moves it: a check run still going, and the merge queue. Separate from Waiting because nobody can be asked to hurry, so the two Courts ask different things of the reader.
_Avoid_: in progress, pending, building

**Settled**:
The Court holding pull requests that need no further action from anyone.
_Avoid_: closed, done, resolved

### Reviewing

**Last Review Point**:
The commit a Participant most recently reviewed a pull request up to.
_Avoid_: last seen, watermark, bookmark

**Since Last Review**:
The difference between a Participant's Last Review Point and the current head of the pull request.
_Avoid_: incremental diff, delta, new changes

**Reviewed State**:
A record that a Participant has read one specific version of one file. It expires when that file changes again.
_Avoid_: viewed checkbox, seen flag

**Reveal**:
Drawing the lines of a changed file that GitHub's own patch leaves out. Their diff carries the hunks and three lines either side, so a reader who wants to read around a change, or to say something about a line between two hunks, has nothing there to press. Revealing fetches the file's two whole halves and hands them to the renderer, which works the diff out again and draws as much as was asked for. Costs nothing on a file nobody reveals: the fetch is a function the renderer calls on the press, never before, and the halves are named by commit so a file revealed twice is read once.
_Avoid_: expand, unfold, show more

**Out of Reach**:
A review thread hung on a line the diff GitHub sent for that file does not contain, so there is no line in the drawing to open it under. GitHub's own Files changed page lets a reviewer comment on any line of a changed file, expanded or not, and those threads arrive in the payload like any other while the diff stays the hunks. Drawn above the file, with the line it names said in words, rather than handed to a renderer that has nowhere to put it. Judged on the last line of a range, which is where a row hangs, and never claimed before the file's diff has landed.
_Avoid_: orphan, unanchored, hidden comment

**Unsent Comment**:
A comment a Participant has written on a line and GitHub is holding, shown to nobody else until the review carrying it is submitted.
_Avoid_: pending comment, draft comment, unpublished comment

GitHub labels this `PENDING`, which readers take to mean somebody else owes a
reply, and it is the most reported confusion on their pull request pages:
[discussion 10369](https://github.com/orgs/community/discussions/10369) has 463
upvotes and four years of people saying their comments sat invisible. Nothing
here may use their word. Draft is not the replacement either, because GitHub
already spends that word on a pull request's own state, and one word meaning two
things is what caused this.

### Findings

**Bot Finding**:
A review comment authored by an automated reviewer rather than a person.
_Avoid_: AI comment, robot comment, automated review

**Stale Finding**:
A Bot Finding whose target lines have changed since it was written, making it unlikely to still apply.
_Avoid_: outdated comment, orphaned comment

**Duplicate Finding**:
Two or more Bot Findings from different automated reviewers describing the same defect in the same place. Presented as one Attention Item.
_Avoid_: merged comment, deduped comment

**Dismissal**:
A Participant's decision that a Bot Finding requires no action. It persists across subsequent pushes.
_Avoid_: resolve, hide, ignore

### Runs

**Workflow**:
A file in the repository that says what should run, and when. Named by its own `name` when it
has one, by its filename when it does not.
_Avoid_: pipeline, action, CI

**Run**:
One execution of one Workflow against one commit. Has a conclusion, a duration, a trigger and
an actor. This is the thing GitHub's Actions tab lists, and it is not the unit this interface
lists, because twenty-five Runs on one screen described ten pull requests.
_Avoid_: build, workflow run, job

**Strand**:
One line of work, and every Run against it. A pull request where the Runs name one, and a
branch where they do not. This is the unit the Actions list screen lists, in place of the Run:
read on 2026-08-04, one page of `octo-org/octo-repo` was 25 Runs over 10 Strands, and one
page of `oven-sh/bun` was 25 Runs over 2. A Strand stands on its head commit; Runs against a
commit it has moved past are counted and not drawn.
_Avoid_: branch, group, row, line

**Superseded**:
An Attempt of one Workflow on one commit that a later Attempt of that same Workflow answered
for. A Strand's standing is the worst of the newest Attempt of each of its Workflows, never the
worst of every Attempt: a Run that was cancelled and re-run is not the standing of the work,
and a failure a re-run fixed is not either.
_Avoid_: stale, old, replaced

**Job**:
One unit of parallel work inside a Run, made of Job Steps. A Job is the same object a pull
request calls a Check: the Check on a pull request and the Job on its Run are one thing seen
from two pages, and GitHub gives them two ids, a check run id and an internal job id. Both
words stay, because a reader on a pull request asks about Checks and a reader on a Run asks
about Jobs, but nothing here may treat them as two kinds of thing.
_Avoid_: task, stage

**Attempt**:
One re-run of a Run, numbered from 1. A Run's Jobs, Job Steps and logs all belong to an
Attempt, so a screen showing any of them says which.
_Avoid_: retry, rerun, try

**Fault**:
Why a Run failed, as a reader would say it: the failing Job, the failing Job Step, and the
text of the log that names the cause. A Run has one Fault per failing Job. This is the answer
to the only question anybody brings to a Run, so it is the content of the Run screen and never
sits behind a click.
_Avoid_: error, failure, root cause

**Tolerated**:
A Job that failed inside a Run that succeeded, which is what `continue-on-error: true` in the
Workflow file produces. GitHub has no word for it and no field either: the Job answers
`conclusion: "failure"` exactly like a real one, and the only thing that says otherwise is the
Run around it concluding `success`. So a Tolerated Job is not a Fault, is never the reason a
Strand or a pull request is red, and is still shown, because it did fall over and its log is
worth reading. On screen it is **Allowed to fail** — the Workflow's author allowed it, and a
reader who has never opened the file can act on that sentence.
_Avoid_: soft failure, non-blocking, warning, expected failure, flaky

**Note**:
Something a Job reported about a specific place, either a line of the log or a line of a file:
a compiler error, a lint opinion, a deprecation warning. GitHub calls these annotations and
draws them all alike, so ten copies of one lint opinion outrank the assertion that broke the
build. Notes carrying the same message are one Note with a count, and a Note whose whole text
restates that something exited non-zero ranks below the Note that says what.
_Avoid_: annotation, check output, message

**Put Away**:
A Participant's decision that a Workflow should not appear on their Actions screens. Persists
across sessions, like a Dismissal, and hides every Run of that Workflow.
_Avoid_: hide, mute, filter out

### Participants

**Participant**:
Any actor on a pull request, human or automated.
_Avoid_: user, member, collaborator

**Author**:
The Participant who opened the pull request. Authorship is part of what decides the Court a pull request lands in.
_Avoid_: owner, submitter

**Reviewer**:
A Participant asked to review the pull request.
_Avoid_: approver, assignee

### Working set

**Involved Pull Request**:
A pull request the Participant authored, was asked to review, was assigned to, or was mentioned in.
_Avoid_: my PR, relevant PR, subscribed PR

**Working Set**:
Every Involved Pull Request for a Participant. Defines the scope of what is kept ready to open instantly.
_Avoid_: inbox, watch list

### Notices

**Notice**:
One row of GitHub's `/notifications` page: one thread the Participant is subscribed to, carrying the Reason they were told about it, whether they have read it, and the state of the subject it is about. The word "notification" is already spoken for — it is what an Attention Item must not be called — and "inbox" is spoken for by the Working Set, so a row of that page needed a word of its own. Notice sits with Court and Docket.
_Avoid_: notification, inbox item, alert

**Reason**:
GitHub's own word for why a Notice reached the Participant, and their string kept verbatim: `review_requested`, `mention`, `subscribed` and twelve more. It belongs to the thread rather than to the event and it is the strongest one that has ever fired, so it says why the Participant was ever told about this thread and not what happened last. Every Reason maps to exactly one Court, and the subject's own state overrules the map.
_Avoid_: trigger, cause, type

### Releases

**Version**:
One entry of a repository's releases list: a tag, notes about what changed, and the files attached to it. GitHub calls all three of those a release, and calls the act of publishing one a release as well, which is why a repository can hold 365 tags under the words "There aren't any releases here". Reserving one word for the entry leaves Tag free for the git ref it stands on.
_Avoid_: release, tag, version number

**Change**:
One thing that changed in a Version, as a person would say it: the pull request's title, who wrote it, and its number. This is the unit the releases list screen lists, in place of the Version, and `docs/spec/releases.md` counts why: read on 2026-08-14, 67 Versions of `zeronsh/comet` described 60 Changes between them, and 30 of the 67 described none.
_Avoid_: release note, changelog entry, commit, bullet

**Bare**:
A Version whose notes name no Change, which is what GitHub's generated notes produce when nothing landed through a pull request. Forty-four percent of the worked example. A Bare Version is drawn as a marker between the Changes around it and never as a row of its own, because there is nothing on it to read.
_Avoid_: empty release, no-op release, patch release

**Build**:
One file attached to a Version, and the platform it runs on, read out of its filename. Carries a size and a `sha256:` digest, because GitHub's own asset fragment carries both.
_Avoid_: asset, artifact, binary, download, release asset

**Yours**:
The Build matching the reader's own operating system and processor, resolved before they ask and drawn as one row at the top of the screen. Only ever one Build: where no Build agrees on both the operating system and the processor, or more than one does, there is no Yours and every Build is named by platform instead. A wrong file is worse than no answer, and the most upvoted thing anybody has written about GitHub's releases page is where the download is.
_Avoid_: recommended, suggested download, your platform, best match

**Source Archive**:
The zip and the tarball GitHub attaches to every Version, which nobody uploaded and nobody can remove. Never a Build and never Yours, and drawn below the Builds rather than above them, which is the order GitHub uses and the reason curl's maintainer reports users taking the wrong file.
_Avoid_: source code zip, auto-generated asset

**Pre-release** is GitHub's word and is kept verbatim, like Reason. It is exact, readers use it,
and it comes off a flag on the record rather than from anything this interface works out.

### Blame

**Blamed Line**:
One line of a file, carrying the commit that last touched it. The unit the blame screen draws one row per, in place of GitHub's Range.
_Avoid_: blame entry, line attribution

**Span**:
Every consecutive Blamed Line naming the same commit, drawn as one strip with the commit told once at its top rather than once per line. `docs/spec/blame.md` counts why: 157 ranges of `oven-sh/bun`'s README described 30 commits between them, and a repository's `.git-blame-ignore-revs` file, where present, changes which commit a Span names without changing where the Span itself breaks.
_Avoid_: chunk, range, group

**Repeat**:
A Span whose commit already told its story higher up the same page. Drawn thin, without the avatar and the message told a second time, the way a Bare Version is drawn thin rather than as a card with nothing on it.
_Avoid_: duplicate commit, same commit again

**Ignore File**:
The repository's `.git-blame-ignore-revs`, kept verbatim as the name of the convention `git blame --ignore-revs-file` and GitHub's own payload both use.
_Avoid_: ignore revs, blame ignore file

**Web Landing**:
A commit GitHub applied itself, because it was landed with their Merge button or written in their browser. Git records `GitHub` at `noreply@github.com` as the committer on those and leaves the person as the author, so the name GitHub sends is nobody's while the face beside it is still the right person's. A Span on one names nobody rather than naming GitHub, and the message leads the row instead. Two of the four commits in `fixtures/github/blame.json` are one.
_Avoid_: web-flow, bot commit, noreply

### Gists

**Label**:
A word a reader attaches to one of their own gists, kept by this extension rather than by
GitHub, because gists carry none. A gist may carry more than one.
_Avoid_: tag, folder, category

**Named**:
A gist whose own display name a reader has set, in place of the filename GitHub picked by ASCII
sort. Stored the same way a Label is, because GitHub has no field for either.
_Avoid_: renamed, titled, custom name

**Own Gists**:
The set a reader's own gist list is read from and organized over — every gist the signed-in
reader owns, public and secret both.
_Avoid_: my gists, personal gists

## Not built

Words removed from the vocabulary above because nothing answers to them yet. Kept
here so the idea is not lost and so nobody writes copy that promises them.

**Control Center**: a single pull request laid out by Court rather than by kind, with
what is owed visible without scrolling.

**Focus**: the view of one Attention Item, entered from a Control Center row and left
by returning to it.

**Queue**: the ordered set of Attention Items entered together from one row, walked
one at a time in Focus.

**Review Pass**: one traversal of a Queue, from entering Focus to the Queue being
empty.
