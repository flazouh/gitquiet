# Spec: Notifications

Status: draft-for-review. The screen is specified. Two of the five threads it was written for
are answered, one is answered in part, and two are refused with reasons.

Covers one address, `/notifications`, and the query strings GitHub hangs off it. Everything
measured below was read live from a signed-in inbox on 2026-08-13.

## Problem Statement

This is the largest page GitHub has that this interface does not replace, and the complaint
about it is one complaint said five ways. Every one of the five is a reader trying to reach the
notifications that need them and away from the ones that do not:

- "Filter notifications by `status`" ([#15591](https://github.com/orgs/community/discussions/15591)),
  621 upvotes. The reader wants open, closed and merged apart.
- "Inbox custom filter exclusion/inversion" ([#5601](https://github.com/orgs/community/discussions/5601)),
  46 upvotes. Their custom filters can say `org:my-org` and cannot say "not that org".
- "Move all bot issues and pull requests into a separate tab"
  ([#4520](https://github.com/orgs/community/discussions/4520)), 43 upvotes. "My notifications
  are frequently filled with automated dependency updates (Dependabot) and documentation updates
  that do not affect me."
- "Filter notifications by pull request status"
  ([#55098](https://github.com/orgs/community/discussions/55098)), 37 upvotes.
- "Notification subscriptions cannot be customised any more"
  ([#204563](https://github.com/orgs/community/discussions/204563)), 37 upvotes.

### Most of the inbox is about work that is already over

Counted on the first screen of a live inbox on 2026-08-13: 15 rows, 5 unread and 10 read, every
one of them the same height and the same weight. Seven of the fifteen are pull requests that are
already merged. Nothing on those seven is a move anybody can make, and they are drawn exactly
like the eight that are still open.

That proportion holds when the inbox is asked a narrower question. Three of GitHub's own reason
queries, counted the same day:

| Query | Rows | Subject already merged or closed |
| --- | --- | --- |
| `reason:review-requested` | 15 | 12 |
| `reason:mention` | 24 | 20 |
| `reason:comment` | 12 | 9 |

That is 51 rows, of which 41 concern something finished. Eleven of the fifteen review requests
are for pull requests that were merged without the reader, and a review request on a merged pull
request is the clearest case there is of a row that looks like work and is not.

### Their filters cannot ask the question

`?query=` is the whole of GitHub's control over this page, and it does not have the terms the
threads ask for. Tried against the same inbox on the same day:

| Query | Rows | What it means |
| --- | --- | --- |
| `is:unread` | 8 | works |
| `is:read` | 11 | works |
| `reason:mention` | 24 | works |
| `author:app/dependabot` | 7 | works, one named machine at a time |
| `is:open` | 0 | no such term |
| `is:merged` | 0 | no such term |
| `is:bot` | 0 | no such term |

`is:open` and `is:merged` return nothing rather than an error, which is the worst of the two
answers: a reader who tries the obvious thing is told they have no open notifications. That is
[#15591](https://github.com/orgs/community/discussions/15591) and
[#55098](https://github.com/orgs/community/discussions/55098) in one line, and it is why both
threads exist.

`is:issue` is worse than absent. It returned 16 rows, and pull requests were among them, because
GitHub models a pull request as an issue in this data and their own filter never undoes it. A
filter that answers a different question than the one it is named for is a filter a reader
cannot build on.

### There is no way to say "not that"

`author:app/dependabot` works. There is no negation, so the reader in
[#5601](https://github.com/orgs/community/discussions/5601) can say "only work" and cannot say
"everything except work", and the reader in
[#4520](https://github.com/orgs/community/discussions/4520) would have to name every machine
that has ever opened a pull request against them, one term at a time, and keep the list up to
date by hand.

## What GitHub's page actually gives us

This is the crux, and all of it was read off the live document rather than inferred.

### It is server-rendered HTML, and that is the good news

No `react-app`, no `turbo-frame`, and no `include-fragment` carrying the list. The document
GitHub serves at `/notifications` already contains every row, marked up as Rails HTML with
Rails forms in it. The body carries `notifications-v2`, `main` is `#js-repo-pjax-container` —
an id from an older era of their own navigation that other pages carry too — and the whole
two-column layout is one `div.js-notifications-container` inside it, measured 1512 by 1313.

Two `react-partial` elements exist on the page and neither holds the list; both are zero-height
furniture. So one fetch of the page is the whole read, the same bargain
`runsOnPage` in `src/github/actionsList.ts` already takes with the Actions list.

### What marks a row

`li[data-notification-id]`, whose value is GitHub's own thread id — `NT_kwHOAYg86No…`, the id
every write form on the page addresses the row by. Fifteen of them on the measured page,
matching the fifteen rows drawn.

The rows are flat whether or not GitHub is grouping them. The plain inbox reports
`is_grouped_by: "repository"` and a queried inbox reports `is_grouped_by: "date"`, and both
produce the same flat list of `li` elements, so the parser does not have to know which mode the
reader left the page in.

### What each row carries

Every field below is on the row. Nothing here needs a second fetch.

| Want | Where it is |
| --- | --- |
| Thread id | `data-notification-id` on the `li` |
| Subject URL, repository and number | `a.notification-list-item-link[href]`, e.g. `/fluentai-pro/fluentai/pull/2169` |
| Title | `p.markdown-title` |
| Repository | the first `p.f6` in the row, with the number in a muted span |
| When it last moved | `relative-time[datetime]` |
| Reason | `data-hydro-click`, `payload.metadata.reason` |
| Read state | `payload.metadata.is_unread`, and the `notification-unread` / `notification-read` class on the `li` |
| Pull request or not | `payload.metadata.is_pull_request` |
| What kind of event | `payload.comment_type` |
| **The subject's own state** | the Octicon at the head of the row |
| Recent participants, and which are machines | `a.avatar` in the `AvatarStack`, `href` starting `/apps/` for an App |
| Saved | `svg.octicon-bookmark` in the row |

The `data-hydro-click` attribute is JSON in the served HTML rather than something their bundle
injects, so a plain fetch has it. It is analytics markup and it is the richest thing on the row,
which is worth saying plainly: the reason is a machine string there and a humanised phrase in
the visible text — `assign` reads "assigned", `comment` reads "commented", `state_change` reads
"state change". The JSON is what to read, and the visible label is the cross-check.

### The subject's state is on the row, and this is what makes the screen possible

[#15591](https://github.com/orgs/community/discussions/15591) and
[#55098](https://github.com/orgs/community/discussions/55098) both assume the state is not
there. It is. GitHub draws it as the Octicon at the head of every row, in the same colour
tokens their own pull request pages use. Observed live, each on real rows:

| Icon and colour | The subject |
| --- | --- |
| `octicon-git-pull-request` `color-fg-open` | pull request, open |
| `octicon-git-merge` `color-fg-done` | pull request, merged |
| `octicon-git-pull-request-closed` `color-fg-closed` | pull request, closed without merging |
| `octicon-issue-opened` `color-fg-open` | issue, open |
| `octicon-issue-closed` `color-fg-done` | issue, closed |
| `octicon-alert` | a security advisory, whose subject is `/advisories/GHSA-…` |

Six shapes seen on a real inbox. GitHub's icon vocabulary is larger than this — a draft pull
request, a discussion, a release, a completed workflow run and an issue closed as not planned
all have their own — and none of those five appeared in the measured inbox, so this spec does
not claim to know their spelling. The parser reads the icon it is given and treats a shape it
does not recognise as a subject whose state is unknown, which is the same "come back empty
rather than wrong" rule `actionsList.ts` follows.

### The reasons, all fifteen

GitHub publishes the list, and it is the same set of strings the page's own markup carries:
`approval_requested`, `assign`, `author`, `ci_activity`, `comment`, `invitation`, `manual`,
`member_feature_requested`, `mention`, `review_requested`, `security_advisory_credit`,
`security_alert`, `state_change`, `subscribed`, `team_mention`
([REST reference](https://docs.github.com/en/rest/activity/notifications)). Six of them were
seen on live rows: `author`, `assign`, `state_change`, `mention`, `review_requested`,
`comment`, and `security_alert` makes seven.

One property of the reason matters more than any single value, and GitHub states it on the same
page: the reason belongs to the thread rather than to the event, and it is the strongest one
that has ever fired. "If you're then @mentioned on the same issue, the notifications you fetch
thereafter will have a reason of `mention`. The reason remains as `mention`, regardless of
whether you're ever mentioned again."

So a reason is why the reader was ever told about this thread, and not what happened last. A
`review_requested` row says a review was asked for at some point; it does not say the review is
still outstanding, and nothing on the page says whether the reader has since given it. That
limit is the reason the state override below exists and is the reason it does most of the work.

### What a bot is, in data terms, and why it is not enough

The `AvatarStack` names the thread's recent participants and marks each one. An App's link is
`/apps/<name>`; a person's link is `/<login>` and carries `data-hovercard-type="user"`. So the
row does say, exactly and without inference, whether a machine has been in the thread.

It does not say who opened the subject, and that is what
[#4520](https://github.com/orgs/community/discussions/4520) asks about. The stack is recent
participants, not authorship, and their order is not authorship either: on a pull request the
reader opened themselves, `/apps/railway-app` is drawn first and the reader second.

The gap is measurable. Of the fifteen rows on the plain inbox, fifteen carry a machine in the
stack and none carries only machines, because a human had commented on every one. Of the seven
rows GitHub returns for `author:app/dependabot` — pull requests Dependabot really did open —
six carry a person in the stack as well, because a person merged or closed them. A rule that
called a row a machine's when every participant is an App would catch one of those seven. It is
the wrong rule, and this spec does not ship it.

### What a reader can do to a row

Six write routes, all Rails forms in the served HTML, all `POST` to `/notifications/beta/…`
with `authenticity_token` and one or more `notification_ids[]`, form-encoded:

| Route | What it does |
| --- | --- |
| `mark` | mark read |
| `unmark` | mark unread |
| `archive` | Done, which takes it out of the inbox |
| `unarchive` | put it back |
| `unsubscribe` | stop being told about this thread |
| `subscribe` | start again |
| `star` / `unstar` | Save and un-save |

None of this was recorded in `docs/spec/github-write-api.md`, which covers a pull request's
`page_data` routes and the two Rails forms on a run. It is recorded there now, in a section
beside the run forms, because it is the same mechanism: a Rails form in the document, an
authenticity token off the page, and a body the caller has to form-encode itself.

Two of them are exercised rather than read. Against a real notification on 2026-08-13, taking a
row that was already read and putting it back the way it was found:

| Request | Answer | The inbox afterwards |
| --- | --- | --- |
| `POST /notifications/beta/unmark` | 200, empty body | the row is in `is:unread` |
| `POST /notifications/beta/mark` | 200, empty body | the row is not in `is:unread` |

The body is zero bytes both ways and there is no redirect, so the status code and a re-read are
all there is to go on — the same thing the run forms do, and the same caution applies: a refusal
is not distinguishable from a success by the body.

### Paging

`nav.paginate-container[aria-label="Pagination"]`, inside the region. It appears on a queried
inbox and not on a short one. This screen reads the first page, which is the page the reader's
own bell opens, and says so — the same limit the Actions list screen already takes.

## Solution

Four principles, and the rest is their consequence.

1. **The subject's state outranks the reason.** A merged pull request is Settled whether the
   reader was its author, its reviewer or merely mentioned in it. This is not a new rule: it is
   what `courtOf` in `src/domain/workingSet.ts` says about a pull request in a list and what
   `attentionIn` in `src/domain/attention.ts` says about the pieces of one, both of which open
   by returning `settled` for anything merged or closed. Applied to the 51 measured rows it
   moves 41 of them into one Court off a fact already on the page.
2. **The reason decides the rest.** For a subject that is still open, the reason is the only
   thing on the row that says anything about who acts next, and it is enough for the four
   Courts.
3. **Read state is weight, not a Court.** Whether the reader has opened a row is their own
   bookmark and says nothing about who owes the next move. It orders rows within a Court and
   never moves one between Courts.
4. **No filter pane.** This screen groups, and their pane is a filter, so it goes with the list
   — the argument `DASHBOARD` and `ACTIONS` already make in `src/ui/place.ts`, and the one their
   own `is:open` proves they cannot win: a filter that silently answers "none" is worse than no
   filter at all.

### The mapping, reason by reason

Every reason, and the Court it lands in when the subject is still open. Where the subject is
merged, closed or resolved, every row in this table is Settled instead.

| Reason | Court | Why |
| --- | --- | --- |
| `review_requested` | Your Move | Somebody asked the reader to review. Agrees with the `review-requested` shelf. |
| `approval_requested` | Your Move | A deployment is held until the reader approves it. Nothing else moves it. |
| `assign` | Your Move | The reader is the assignee. |
| `mention` | Your Move | Somebody wrote the reader's name, which is a question addressed to them. |
| `security_alert` | Your Move | A vulnerability in the reader's own repository. Only a person fixes one. |
| `member_feature_requested` | Your Move | Organisation members are waiting on an administrator's decision. |
| `author` | Waiting | The reader opened it; somebody else reviews or lands it. |
| `comment` | Waiting | The reader spoke; nobody asked them anything back. Matches `courtOfThread`, which puts the reader's own last word in Waiting. |
| `manual` | Waiting | The reader subscribed on purpose and the thread moved. Somebody else is driving it. |
| `subscribed` | Waiting | The reader watches the repository. This is the largest and least personal category there is. |
| `team_mention` | Waiting | A team was named, not a person. Somebody on it owes an answer and the page does not say who. Drawing this as Your Move is what makes a busy team's inbox indistinguishable from a personal one. |
| `invitation` | Settled | The reader already accepted. |
| `security_advisory_credit` | Settled | The reader was credited. Nothing is owed. |
| `state_change` | Settled | The reader closed or merged it themselves. |
| `ci_activity` | by the icon | A run the reader triggered has finished, so the machine is no longer working: a failure is Your Move and a pass is Settled. No `ci_activity` row appeared in the measured inbox, so the icon a completed run draws here is unread and the parser will treat an unknown one as unknown. |

**Running is empty on this screen, and that is a finding rather than an omission.** Running
means a machine owes the next step and only time moves it. A notification is sent when a machine
has *finished* — `ci_activity` is documented as "a workflow run that you triggered was
completed" — and a row about an open pull request carries no check state at all. So nothing on
this page can honestly be filed there. The Court is still drawn, empty, for the reason
`docketsIn` returns all four: a Court that vanished on a quiet inbox would take the reader's
bearings with it.

**Where the state and the reason disagree, and the state is not the whole answer.** A
`review_requested` row on an open pull request goes to Your Move even where the reader has
already submitted the review, because the reason is sticky and the page carries nothing that
says otherwise. This is the mapping's one known lie, it is GitHub's data rather than a choice
here, and the honest mitigation is that it is bounded: only the open subjects can be wrong, and
those are 10 of the 51 rows measured.

### The screen

`/notifications`, four Courts, and the reader's own inbox in them.

**One row per Notice, and the row says the thing the icon was hiding.** Repository and number,
the title, who has been in the thread, how long ago it moved, and the reason in the product's
own words rather than GitHub's. Unread rows are drawn heavier than read ones within their
Court.

**The presses stay on the row.** Done, Mark read or unread, Unsubscribe, Save, and opening it.
Each is one of the Rails forms above, each is on the row GitHub served, so the fact that a press
is available is the form being there — a subscribed thread carries `unsubscribe` and an
unsubscribed one carries `subscribe`, and nothing here works that out from anything else. That
is the rule the run screen already follows for its two presses.

**Nothing is drawn that GitHub did not send.** Where a row's icon is a shape this parser does
not know, the row still appears, in the Court its reason gives, with its state unsaid. A row
whose link or id cannot be read is skipped. A page that has stopped looking like this yields
nothing and the screen hands the document back to GitHub.

## What this answers, and what it does not

| Thread | Upvotes | Answer |
| --- | --- | --- |
| [#15591](https://github.com/orgs/community/discussions/15591) filter by status | 621 | **Answered.** The state is on every row as an Octicon. Merged and closed subjects are one Court, and on the measured inbox that is 41 rows of 51. |
| [#55098](https://github.com/orgs/community/discussions/55098) filter by pull request status | 37 | **Answered**, by the same fact, and it is the same request said about pull requests alone. |
| [#4520](https://github.com/orgs/community/discussions/4520) bots in their own tab | 43 | **Partly.** Five of the seven Dependabot pull requests measured are already merged or closed and land in Settled without anything knowing they are a machine's. A bot lane is not built, because the row names recent participants and not the subject's author, and the rule that would approximate it caught one of seven. |
| [#5601](https://github.com/orgs/community/discussions/5601) exclusion and inversion | 46 | **Refused, with a reason.** The thread asks for a better filter language. Grouping is not one, and this codebase has twice decided not to ship a filter pane. What it delivers instead is that the reader does not have to write a query: the 41 rows they were trying to exclude are already in a Court they can leave shut. Putting a repository or an organisation away permanently is the shape that would answer this properly, and it belongs with `Put Away`, which is specified for Actions and not built either. |
| [#204563](https://github.com/orgs/community/discussions/204563) customise subscriptions | 37 | **Refused. GitHub removed the feature.** Their changelog of 2026-08-10, "Custom thread subscriptions are being deprecated", says "the Customize option in the thread-level notification settings will be completely removed. After this change, only Subscribed and Not subscribed options will be available for a thread." There is nothing left on the page or the server to drive. What this screen gives the reader instead is the read-time version of the same wish: a `state_change` is Settled and the chatter is Waiting, so "it is fixed" can be seen without reading the discussion. The notification still arrives and still counts. |

That is 658 of the 784 upvotes answered, 43 answered in part, and 83 refused with a citation.

## Implementation Decisions

### The place

`div.js-notifications-container`, the direct child of `main`, which is GitHub's own behaviour
hook and carries no per-deploy hash. Measured 1512 by 1313 at top 64, and it holds both columns:
their `nav.notification-navigation` at 247 wide and the list at 1233. Both, deliberately, for
the reason `DASHBOARD` and `ACTIONS` both record.

`main` is the fallback, as on `ISSUES`, and for the same reason: `/notifications` is a top-level
page and there is no pjax container or Turbo frame inside it to fall back to.

`soft` is nothing, as on `COMMIT`. Measured rather than assumed: a sentinel was written onto
`window` on `/pulls`, GitHub's own notifications link was pressed, and the sentinel was gone
when the address settled on `/notifications`. That is a document load, so this page is never
swapped in under a reader and there is no soft gate to write.

### Data access

One HTML fetch of `/notifications`, decoded with `DOMParser`, exactly as `strands` reads the
Actions list. Written to come back empty rather than wrong.

### Vocabulary

`CONTEXT.md` avoids "notification" as a word for an Attention Item and avoids "inbox" as a word
for the Working Set, so neither can be reused here. A row of this page is a **Notice**, which
sits with Court and Docket in the register this product already uses, and the entry is in
`CONTEXT.md`.

## Open questions

- **The icons not yet seen.** A draft pull request, a discussion, a release, a completed
  workflow run and an issue closed as not planned all reach this inbox and none appeared in the
  measured one. Their spelling is unread and the parser is built to say so rather than guess.
- **Paging.** The first page only, as on the Actions list. A reader with a large inbox sees the
  Courts of their first page and not of their inbox, and the screen should say which.
- **Put Away for repositories.** The shape that would answer
  [#5601](https://github.com/orgs/community/discussions/5601) properly. It needs the settings
  knob `Put Away` was specified with and neither is built.

## Evidence

| Claim | Weight |
| --- | --- |
| Filter notifications by status | [#15591](https://github.com/orgs/community/discussions/15591), 621 upvotes |
| Custom filter exclusion and inversion | [#5601](https://github.com/orgs/community/discussions/5601), 46 upvotes |
| Bot issues and pull requests in their own tab | [#4520](https://github.com/orgs/community/discussions/4520), 43 upvotes |
| Filter notifications by pull request status | [#55098](https://github.com/orgs/community/discussions/55098), 37 upvotes |
| Subscriptions cannot be customised | [#204563](https://github.com/orgs/community/discussions/204563), 37 upvotes |
| Custom thread subscriptions removed by GitHub | GitHub changelog, 2026-08-10 |
| The reason is sticky to the thread, not the event | GitHub REST reference, notifications |
| 15 rows on the first screen, 7 of them already merged | measured, 2026-08-13 |
| 41 of 51 rows across three reason queries concern finished work | measured, 2026-08-13 |
| 11 of 15 review requests are for merged pull requests | measured, 2026-08-13 |
| `is:open`, `is:merged` and `is:bot` all return zero rows | measured, 2026-08-13 |
| `is:issue` returns pull requests | measured, 2026-08-13 |
| 6 of 7 Dependabot rows carry a person in the participant stack | measured, 2026-08-13 |
| The page is server-rendered HTML with no React app and no Turbo frame | measured, 2026-08-13 |
| The subject's state is on the row as an Octicon | measured, six shapes, 2026-08-13 |
| `mark` and `unmark` answer 200 with an empty body | exercised, 2026-08-13 |
| Navigating to `/notifications` loads a document | measured with a sentinel, 2026-08-13 |
