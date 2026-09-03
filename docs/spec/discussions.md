# Spec: Discussions

Status: partly built. The addresses of the whole surface and the four rules that need nothing
of GitHub's markup are in `src/domain/discussions.ts` and tested. No screen stands on a
Discussions page yet, and the reason is in **What is waiting on a capture** at the end: every
other screen in this codebase was written against a page somebody had in front of them, and
this one has not been read yet.

The vocabulary below is deliberately not in `CONTEXT.md`'s body. `CONTEXT.md` names it under
**Not built**, which is where words live until something answers to them.

Covers every address the surface has, listed under **The surface** — a repository's list, one
category, one discussion, the form, and the two organisation addresses that are the same pages
with an organisation in place of a repository. `github.com/orgs/community/discussions` is one of
those, which makes this the one surface in this codebase whose own bug reports are filed on
itself.

## The surface

| Address | What it is |
| --- | --- |
| `/{owner}/{repo}/discussions` | The list, every category |
| `/{owner}/{repo}/discussions?discussions_q=…` | The list, narrowed by their query language |
| `/{owner}/{repo}/discussions/categories/{slug}` | The list, one category |
| `/{owner}/{repo}/discussions/{number}` | One discussion |
| `/{owner}/{repo}/discussions/{number}#discussioncomment-{id}` | One discussion, at one comment |
| `/{owner}/{repo}/discussions/new?category={slug}` | The form |
| `/orgs/{org}/discussions` and `/orgs/{org}/discussions/{number}` | The same two pages, organisation-wide |
| `/search?type=discussions&q=…` | Across repositories, and the only place that is possible |

`src/domain/discussions.ts` parses all of them and refuses everything else under `/discussions`,
which matters more here than elsewhere: `new` and `categories` sit exactly where a number sits.

## How this was gathered, and what is missing

Two kinds of evidence stand behind the specs in this folder. One is a live read — "read on
2026-08-14, ten Versions of `zeronsh/comet` described 60 Changes between them" — and the other
is the record of people saying what hurt, quoted with a number beside it.

**This spec has neither yet, and says so rather than inventing them.** It was written in an
environment with no route to `github.com`: every fetch of a discussions page, of
`orgs/community/discussions`, and of the forums where people complain about it answered 403 at
the proxy. So what is below is read off the surface's own mechanics — the addresses it serves,
the shapes its data has, and what its features are and are not — and each pain point carries a
**Measure** line naming the count that would settle its size.

The mechanics are not guesses; they are what the surface is. But a count is a claim, and no
count here is one this spec is entitled to make. Anybody continuing this work should fill the
Measure lines first, because their answers decide the shipping order below, and one of them may
well delete a slice.

## The complaint

### 1. Nothing anywhere says what is owed to the reader

Every other object on GitHub that can be owed to somebody has a page that lists what is owed:
`/pulls` for pull requests, `/issues` for issues, `/notifications` for the rest. A discussion has
none. There is no `/discussions` for a signed-in person, no dashboard tab, and no filter on any
existing dashboard that would show one — the only way to ask "what discussions am I in" is to
type `involves:@me` into the global search with `type=discussions` and read the result as a
search result rather than as a list of work.

This is the largest gap on the surface and the one that costs most, because a discussion is
owed to somebody in exactly the way an issue is. A maintainer has a question nobody answered. A
person who asked has an answer they have not read. Both are moves somebody has to make, both are
invisible, and the only thing that ever tells either party is a notification, which is a stream
rather than a state: read it once and the fact that a move is still owed is gone.

This interface already has the word for the missing thing. A **Court** is who owes the next move,
and the Working Set sorts pull requests by it. Discussions are the one kind of work in this
codebase that can be owed and has no Court.

**Measure**: on an account with real involvement, `involves:@me type=discussions` against the
same account's open issues — how many discussions are owed, and to how many repositories.

### 2. The unanswered backlog has no size

A Q&A category's questions divide into answered and unanswered, and this is the one number a
maintainer of a busy repository wants. GitHub's list can be narrowed to `is:unanswered`, so the
rows exist. What does not exist is the count: their pager is a cursor with **Newer** and
**Older** on it, the sidebar counts categories and not states, and a narrowed list of twenty-five
rows looks the same at 25 unanswered as at 2,500.

This is the same defect their releases page has and this codebase already answered once — see
`releases.md` — and it is the reason `queryFor` in `issueList.ts` carries counts through. A list
whose size is unknown cannot be worked down, because nothing tells the reader whether working it
down is possible.

The second half of it is that the count that would matter most is per category, and the sidebar,
which is the one place per-category numbers could go, spends that space on the total.

**Measure**: for three busy repositories, the unanswered count against the total, and whether
their sidebar's numbers change under `is:unanswered`.

### 3. The answer is not the thing the page is about

Where an answer has been marked, GitHub does the right thing and floats it. The defect is the
much more common case where nobody marked one.

Marking is a privilege: the person who asked, and people with write access. So the ordinary life
of a question in a large repository is that somebody answers it in comment nine, five people say
it worked, the person who asked never comes back, and nothing on the page is different from a
question nobody answered at all. The reader who arrives eight months later — and by then almost
every reader arrives from a search engine — gets thirty comments in the order they were written
and has to read them all to find out which one worked.

Everything needed to float it is on the page. The comment with the reactions on it is the answer
in nearly every such thread, and the reactions are already rendered.

**Measure**: over the first fifty results of an `is:unanswered` list on a busy repository, how
many have a comment carrying more reactions than the question itself. That fraction is the size
of this.

### 4. Replies stop at one level and are then folded away

A discussion comment can have replies; a reply cannot. Two levels, and a conversation that wants
three gets a reply that quotes the person it is answering, which is threading done by hand and
badly.

Then the second half: a comment with many replies does not show them. GitHub folds them behind a
control and shows the last few, so on the threads where the depth limit did the most damage —
the long ones — the part that was flattened is also the part that is hidden. What a reader sees
of a fifty-reply argument is the newest three, which is the part of an argument least likely to
contain its conclusion.

**Measure**: the reply-count distribution on a busy repository's most-commented threads, and how
many replies GitHub renders unfolded.

### 5. "+1" is three separate things and readers use all of them

A person who wants to say "this too" has an upvote on the discussion, a reaction on a comment,
and the comment box. The box is the one that reaches everybody subscribed, so it is the one
people use, and the result is the familiar column of "+1", "same here", "any update on this?"
between the substance.

This is not a complaint about the people writing them. Somebody writing "same here" is trying to
signal that a thing affects more than one person, which is exactly what the upvote is for and
what nothing on the page tells them is for.

The rows are not worth deleting — they are worth counting. `collapsedMeToo` in
`src/domain/discussions.ts` does that: a reply whose whole text is agreement becomes a number
beside the strip of faces of the people who wrote them, keeping who and how many, dropping the
thirty rows.

Written to be shy. It matches short, whole-text agreement and nothing else, because a rule that
folds away a comment carrying content has taken something from the record, and the worst version
of that is folding away the one comment that turned out to be the answer. Anything with a code
fence, a link, a number that could be a version, or more than a few words is a comment.

**Measure**: on twenty long threads, the fraction of comments the rule folds, and — the number
that decides whether it ships — how many of the folded ones a reader would call content.

### 6. Search is a second query language in a second box

The list's filter writes `discussions_q`, not `q`. It is a vocabulary of its own, overlapping
issue search without being it, and a person who has learned `is:open label:bug author:@me` on
issues has learned most but not all of it. Nothing on the page says which.

Across repositories there is one route, `type=discussions` on the global search, and it is the
only address on this surface that crosses a repository boundary at all.

This is the cheapest thing here to answer and the least important, so it ships last: the box in
this interface takes the terms it understands, passes the rest through verbatim, and says which
is which — the arrangement `issueList.ts` already has, `seeding` and all.

### 7. The category is chosen once, at the worst possible moment

A discussion's category is picked in the form, before the thing has been written, by somebody who
in the common case has never seen this repository's categories before and is choosing between
"Q&A", "Ideas", "General" and four the maintainer invented. Only a maintainer can move it
afterwards.

So categories drift into meaninglessness on exactly the repositories that most need them, and the
list's own sidebar — the surface's main organising device — is organised by the field least
likely to be right.

There is no client-side fix for the choosing. There is one for the reading: the row should say
what a discussion is from what it has done — a question with an answer, a question without one, a
thing announced, a thing being argued about — and the category should be a word on the row rather
than the axis everything is filed under.

**Measure**: on five repositories with custom categories, how many of the newest fifty rows sit
in a category that matches their content.

### 8. Nothing says what changed since the reader last looked

A discussion the reader has read before opens at the top, exactly as it did the first time. There
is no marker, no count of what arrived since, and nothing to press to get to it. On a thread of
any size the reader's own last comment is the landmark they scroll to find, and finding it is the
whole cost.

This codebase has the word and the mechanism: **Last Review Point** on a pull request, and
**Since Last Review** for what has landed past it. A discussion wants the same pair, kept the same
way, with no help from GitHub needed to keep it.

### 9. A locked thread is discovered by typing into it

Locked, limited to contributors, or in a category the reader may not post to: all three are
found out the same way, which is by writing a comment and being refused. The state is known to
the page before the reader arrives.

Small, cheap, and the same class of defect as the Unsent Comment confusion in `CONTEXT.md`: the
page knows, and does not say until after the work is wasted.

### 10. Duplicates, in the one place duplicates are guaranteed

A Q&A category is a place where the same question is asked repeatedly, by definition. The form
offers no similar-discussion prompt, so the duplicate is created, and then the maintainer's only
tools are a close-as-duplicate and a comment.

A search across the repository's own discussions, run from the form against the title as it is
typed, is the whole of the fix and it needs nothing GitHub does not already serve.

**Measure**: on a busy Q&A category, how many of the newest fifty are answered only with a link
to another discussion.

### 11. The API is GraphQL-only, which is why nobody else fixed any of this

A repository's discussions have no REST route. Everything above — listing, reading, answering,
counting — is GraphQL or nothing, and a personal access token plus a hand-written query is a
different order of effort from `curl` against `/repos/{owner}/{repo}/issues`.

This is not a pain point of the surface for a reader. It is the explanation of why a surface with
this many gaps has almost no third-party tooling relieving them, and it is the reason this is
worth building here: this interface reads GitHub's own routes with the session of somebody
already on their page, so the token, the schema and the rate limit are all somebody else's
problem.

## What no client can fix

Named so nobody writes copy promising them.

- **Threading past two levels.** The reply has nowhere to be stored. A client can draw a
  quoted reply as a nested one, and that is a drawing, not a structure — the next reader of
  GitHub's own page sees the flat thread.
- **Who may mark an answer.** Permission is GitHub's.
- **Moving a discussion between categories** without write access.
- **Making a discussion out of an issue, or the reverse**, beyond what their own routes take.

## Shipping order

Each slice is worth its own plan under `plans/`, and none of them should start before the
Measure line above it has an answer.

1. **A Court for discussions** — pain 1. The largest, and the one that fits this codebase's
   existing shape exactly: a discussion joins the Working Set's Courts beside an Involved Issue.
   `courtOfDiscussion` is written and tested; what is left is the read that feeds it.
2. **Counts, and the unanswered backlog** — pain 2. `unansweredAmong` and `perCategory` are
   written. Cheap once the list is read at all.
3. **The list screen** — pains 2, 7, 8. A repository's discussions as rows that say what each
   one has done, with a since-last-read marker.
4. **The discussion screen** — pains 3, 4, 5, 8, 9. The one with the most in it, and the one
   most dependent on a live capture.
5. **The form** — pain 10. Search-as-you-type against the repository's own discussions.
6. **The filter box** — pain 6. Last, deliberately.

## Vocabulary proposed

Not in `CONTEXT.md` until something answers to it.

**Discussion**: One thread on a repository's or an organisation's Discussions surface. Not an
Issue — nothing is assigned, nothing closes as completed, and the thing it most often wants is an
answer rather than a fix. _Avoid_: thread, post, topic.

**Category**: The one folder a Discussion is filed in, chosen at creation and changeable only by
somebody with write access. Kept as GitHub's word because readers use it, and never the axis a
screen here is laid out by — see pain 7. _Avoid_: section, board, folder.

**Question**: A Discussion in a Category that takes an Answer. The only kind that can be owed to
anybody in the strict sense, because it is the only kind with a state that says whether the thing
it wanted has happened. _Avoid_: Q&A, ask, query.

**Answer**: The one comment somebody entitled to say so marked as the thing that worked. At most
one per Question, and absent from most Questions that have in fact been answered — see pain 3.
_Avoid_: accepted answer, solution, resolution.

**Working Answer**: A comment on a Question with no Answer that carries more agreement than the
Question itself. This interface's own conclusion rather than GitHub's fact, so it is drawn as a
suggestion and never as an Answer, and the word exists so that nothing here ever calls it one.
_Avoid_: best answer, likely answer, top comment.

**Me Too**: A reply whose whole text is agreement — "+1", "same here", "any update?". Folded into
a count and a strip of faces rather than into rows. Never deleted and never hidden: the people
are the content. _Avoid_: noise, spam, plus-one.

**Reply**: A comment on a comment, which is as deep as the surface goes. _Avoid_: nested comment,
child comment.

## What is waiting on a capture

Everything that has to read GitHub's markup: `src/github/discussionList.ts`,
`src/github/discussionView.ts`, the two gateway methods, the Place entries, and the screens.

The rule this codebase works by is that a parser is written against a page somebody has in front
of them and committed with the page beside it — `tests/fixtures/releasesList.html` is
`zeronsh/comet` as GitHub served it, unedited, and every assertion in `releasesList.test.ts` is
measured against that file. Nothing here would meet that standard, because no discussions page
could be fetched from where this was written. A scraper written against remembered markup is a
screen that draws nothing on the day it ships, and it fails in the way this codebase most
dislikes: quietly, at the reader's expense.

So the next step is two files —
`tests/fixtures/discussionList.html` and `tests/fixtures/discussionView.html`, saved from a real
repository with a real backlog, dated in the test that reads them — and then the parsers, in the
order above.
