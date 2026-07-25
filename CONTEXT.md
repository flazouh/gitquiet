# Pull Request Review

A replacement interface for reviewing pull requests on GitHub. It exists because GitHub's own pull request pages organise information by object type — conversation, commits, checks, files — which forces every participant to re-derive what actually needs their attention on every visit.

## Language

### Attention

**Attention Item**:
Anything on a pull request that can be owed to someone: a review thread, a failing check, a bot finding, an unread file change, or an out-of-date branch.
_Avoid_: task, todo, notification

**Court**:
The participant who owes the next move on an Attention Item. Every Attention Item sits in exactly one Court.
_Avoid_: owner, assignee, status

**Your Move**:
The Court holding Attention Items that the viewing Participant must act on.
_Avoid_: open, actionable, pending

**Waiting On Others**:
The Court holding Attention Items where the viewing Participant has acted and someone else owes the response.
_Avoid_: blocked, awaiting

**Settled**:
The Court holding Attention Items that need no further action from anyone.
_Avoid_: closed, done, resolved

### Views

**Control Center**:
The single-screen view of one pull request showing every Attention Item grouped by Court, with no scrolling required to see what is owed.
_Avoid_: dashboard, overview, summary page

**Focus**:
The view of a single Attention Item, entered from the Control Center and left by returning to it.
_Avoid_: detail view, drill-down, modal

**Queue**:
The ordered set of Attention Items entered together from one Control Center row, traversed one at a time in Focus.
_Avoid_: list, backlog, stack

### Reviewing

**Review Pass**:
One traversal of a Queue, beginning when a Participant enters Focus and ending when that Queue is empty.
_Avoid_: session, sweep

**Last Review Point**:
The commit a Participant most recently reviewed a pull request up to.
_Avoid_: last seen, watermark, bookmark

**Since Last Review**:
The difference between a Participant's Last Review Point and the current head of the pull request.
_Avoid_: incremental diff, delta, new changes

**Reviewed State**:
A record that a Participant has read one specific version of one file. It expires when that file changes again.
_Avoid_: viewed checkbox, seen flag

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

### Participants

**Participant**:
Any actor on a pull request, human or automated.
_Avoid_: user, member, collaborator

**Author**:
The Participant who opened the pull request. Determines which Attention Items land in their Your Move Court.
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
