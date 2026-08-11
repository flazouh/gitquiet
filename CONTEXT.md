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

**Your Move**:
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
