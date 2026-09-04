# Spec: Discussions

Status: draft-for-review. The vocabulary is proposed in the Language section below and is not
yet in `CONTEXT.md`.

Covers six addresses, which are three pages in two homes:

| Address | Is |
| --- | --- |
| `/{owner}/{repo}/discussions` | every discussion in a repository |
| `/{owner}/{repo}/discussions/categories/{slug}` | the same list, one category |
| `/{owner}/{repo}/discussions/{number}` | one discussion |
| `/orgs/{org}/discussions` | every discussion in an organisation |
| `/orgs/{org}/discussions/categories/{slug}` | the same list, one category |
| `/orgs/{org}/discussions/{number}` | one discussion |

An organisation's are not a lesser version of a repository's. `orgs/community` is where GitHub
runs its own product feedback, and it is the busiest Discussions surface there is: read on
2026-09-04, its first page carries 25 rows across 23 categories, and one thread on it has 30
comments of which 8 have been folded away by a moderator.

The two are one page in two layouts. Every row, comment, category, poll and press is identical,
which the parsers prove by reading both without a line of difference. What differs is the path in
front of the word `discussions`, and the markup GitHub wraps the page in: a repository's uses the
pjax container its other tabs use, and an organisation's has neither that nor a Turbo frame.

The worked examples are eight repositories that run Discussions in earnest, read live and
signed out on 2026-09-03: `vercel/next.js`, `tailwindlabs/tailwindcss`, `supabase/supabase`,
`vitejs/vite`, `shadcn-ui/ui`, `nuxt/nuxt`, `laravel/framework` and `denoland/deno`. Where one
number is quoted below it comes from the first page of each, two hundred rows in all.

## Problem Statement

A discussion is the only thing on GitHub that can be finished by a word rather than by an
event. A pull request is merged, a run passes, an issue closes. A question is answered when
somebody who is not the maintainer says the right thing and the person who asked walks away.
Nothing in the system notices that they walked away, so the question stays open forever and
the page fills up with them.

### Four of five questions have replies and no answer

Counted over the first page of the eight repositories above, 2026-09-03:

| Repository | Rows | Questions | Answered | Replies, no answer | No reply yet | Closed | Locked |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `vercel/next.js` | 25 | 16 | 1 | 15 | 0 | 3 | 0 |
| `tailwindlabs/tailwindcss` | 25 | 10 | 4 | 6 | 0 | 2 | 0 |
| `supabase/supabase` | 25 | 14 | 2 | 11 | 1 | 0 | 1 |
| `vitejs/vite` | 25 | 18 | 5 | 13 | 0 | 6 | 0 |
| `shadcn-ui/ui` | 25 | 10 | 2 | 8 | 0 | 0 | 0 |
| `nuxt/nuxt` | 25 | 16 | 3 | 11 | 2 | 4 | 0 |
| `laravel/framework` | 25 | 25 | 3 | 21 | 1 | 1 | 0 |
| `denoland/deno` | 25 | 11 | 2 | 9 | 0 | 7 | 0 |
| **Total** | **200** | **120** | **22** | **94** | **4** | **23** | **1** |

"Question" here means a row in a category that takes answers, which is the only kind of row
GitHub prints the word Answered or Unanswered on. Eighteen percent of them are answered. The
rest are not, and 94 of those 98 have somebody's reply sitting in them already.

Those 94 and those 4 are two different states of the world. One needs a person to write an
answer. The other needs a person to point at an answer that is already there. GitHub draws
them the same, and it is the 94 that make the page feel abandoned.

Closing cuts across all of it. Twenty-three of the two hundred rows are closed, and a closed
row keeps whatever answer word it had: their own row prints "· Closed · Unanswered" together.
So closing is the one thing on the page that ends a question without answering it, and any
reading of these rows has to take it before the answer word rather than after.

### The mark that says which is a fill on a check

The answered mark is `octicon-check-circle-fill` in `color-fg-success`. The unanswered mark is
`octicon-check-circle` in `color-fg-muted`. Same glyph, same 16 pixels, same slot beside the
comment count, filled and green against outlined and grey. Twenty-five rows of one column, one
or two of them filled.

The word is on the row as well, and it is the last thing in a sentence that begins with a
name: "ShivamArora asked Sep 17, 2024 in Help · Unanswered", set in `text-small
color-fg-muted`. A reader scanning for what is stuck is scanning for the tail of a sentence.

### One category is the same row as another

`vercel/next.js` runs nine categories: App Router, Feedback, Help, Ideas, Polls, RFC,
Security, Show and tell, and Turbopack error report. The list opens on all nine at once,
newest first. An idea nobody has to answer, a poll nobody has to close, and a support question
that has been open for a year are the same row, and the only thing that separates them is an
emoji in a box and a category name inside the sentence.

Three of those nine take answers. Six do not. A row from the six carries no state at all,
because there is no state for it to carry, and a reader cannot tell that from looking.

### The page is a thousand bytes of chrome per character of prose

`vercel/next.js#70178`, nine comments and one reply thread, read on 2026-09-03: 396,008 bytes
served, of which 4,165 characters are what anybody wrote. That is 1.05 percent. The document
carries 151 inline SVGs, 24 `include-fragment` elements, and a per-comment actions menu that
is fetched from a separate route when it is opened.

## What this interface does about it

### Language

Four words, three of them already the product's own.

| Word | Means |
| --- | --- |
| **Discussion** | One thread, whatever category it is in. |
| **Question** | A Discussion in a category that takes answers. |
| **Answer** | The one reply somebody marked. A Question has none or one. |
| **Stale** | A Question with replies and no Answer. |

Stale is the word this screen exists for. It is not GitHub's, because GitHub has no name for
the state, and 94 of 120 rows are in it.

### The list is grouped by what is owed, not by when it arrived

A repository's issue list carries no Court, and says so: the issues of a repository are not
owed to the reader, and a search that lists them says nothing about why the reader is in any
one. A repository's Discussions are different in one way that matters. A Question is owed an
answer by whoever reads the page, and a Stale Question is owed a mark by whoever asked it.
Both facts are on the row already.

So this list is grouped, and by the same four the rest of the product uses:

| Group | Holds |
| --- | --- |
| **Needs You** | Stale Questions. Somebody replied and nobody marked it. |
| **Waiting** | Questions with no reply yet. |
| **Running** | Nothing, and it is drawn as nothing. See below. |
| **Settled** | Answered Questions, closed and locked Discussions, and everything in a category that takes no answers. |

Needs You is deliberately the biggest group on a busy repository, because that is what the
census says is true. A reader who disagrees with the grouping has the category filter and
GitHub's own sort, both of which are kept.

Running is empty on this screen and stays empty. No machine works on a discussion: there is no
check to run, no build to wait for, and a poll has no closing time to run down to. The group is
kept in the vocabulary and left off the screen, rather than filled with something that is not
a machine working.

Settled is not a claim that a Show and tell post is finished. It is a claim that nothing is
owed on it, which is what Settled means everywhere else in this product.

### The row says the state first

The order on the row is state, then title, then category, then who and when. The mark is a
word rather than a glyph, because "Stale" and "Answered" are two words and an outline and a
fill are one shape.

The upvote count stays where GitHub puts it, on the left, because it is the one number on the
page that readers use and it is already legible. A locked row has none: GitHub replaces the
whole vote control with a padlock in the same pill, so the count and the discussion's own id
both go with it.

### One discussion opens on its Answer

A Question that has an Answer draws the Answer under the body, before the other replies, and
leaves it in the thread as well. That is what the reader came for, and GitHub already knows
which comment it is: the comment carries `timeline-chosen-answer` and the page carries
`answered`. Their own page leaves it wherever it happened to be said, which on a nine-comment
thread is somewhere in the middle.

A Stale Question draws the reply the most people upvoted, under a heading that says nobody
marked an answer. It is offered as what it is and never as the answer: guessing at one would be
this screen making the claim it exists to say GitHub cannot make. Marking one is a write, and
the write is not built.

The question itself folds after about a screenful. `vercel/next.js#70178` is 700 pixels of
question before the first reply, and on this page what is under the question is the point of it.

The screen is not grouped into the four Courts, unlike the list it is opened from. Those sort
many things by who owes the next move; a discussion is one thing, one move is owed on it, and
the header says which.

### The filter bar, in their own vocabulary

Their controls offer Unanswered. On the census above that is 98 rows of 120, and 94 of those
already have somebody's reply in them, so it is very nearly the whole list. `is:unanswered
comments:>0` is the 94 a person can finish by pointing at what is already there, and GitHub
answers it: measured on 2026-09-03, `comments:0` returned rows whose counts were all zero and
`comments:>5` rows whose counts were all above five, so the qualifier is real on this route and
not merely accepted.

So Stale leads the bar and is one press. Nobody would think to type it.

Every control is a link, which means what a reader is looking at is an address they can copy,
send and come back to, and the filtering is GitHub's across every page rather than this screen's
over the twenty-five rows it holds. Pressing a category keeps whatever the reader was filtering
by; their own sidebar drops it every time.

The pager is Newer and Older with no page count, because their list prints no total anywhere on
the page and answers no route that does.

### Polls

A poll is drawn where their body carries one, with its results always shown. Their page hides the
results behind a press until you have voted, and a poll's answer is the point of it.

A vote is the one write on this screen that guesses at nothing: their markup names the route in
`data-vote-url`, the radio group carries the poll's id as its `name`, each option carries its own
id as its `value`, and the token sits beside them.

Nothing about a poll runs down. There is no closing time anywhere in their markup, which is the
second reason the Running Court is empty on the list.

### Reactions

The faces people put on a discussion, and only the ones somebody used. Their page renders a
button for all eight with a zero on the seven nobody chose, and a row of eight zeroes under every
comment is eight things to read and nothing to learn.

Drawn apart from the upvote beside them, because GitHub counts them apart: an upvote ranks the
thread and a face is an opinion about one thing somebody said. The last comment of
`vercel/next.js#70178` carries one rocket and two upvotes.

### Writing

Every write is GitHub's own form, sent back. Their discussion page is Rails, so each control that
changes something is a form whose token is signed for that render and cannot be minted — and the
extension is standing on the page that form was rendered into, which is the whole of why this
works. See `discussionForms.ts`.

Six presses: say something, reply under a comment, mark a comment as the answer, upvote, put a
face on something, and answer a poll.
Each is drawn only where their form for it was on the page, so a reader who is not signed in, a
locked discussion and an archived repository all draw nothing. Their disabled "Marked as answer"
badge is not a press and is not offered as one.

### Everything else, without learning its name

Close, lock, edit, delete and report are one menu behind one button, and none of it is in the
page: their markup carries an `include-fragment` per comment whose `src` is the route that serves
it. That route answers 404 to a reader who is not signed in, so its contents cannot be recorded here
— which is the reason for the design rather than a gap in it. The route itself is on all four
recordings, for the discussion and for each of its comments.

So this screen does not learn them. It reads that route — theirs, off their own markup, never
written here — and draws whatever came back, in GitHub's own sentences and GitHub's own order.
Pressing one sends the form that sentence sits on. The day GitHub adds an entry it is here; the
day they rename one it is renamed here; and there is no name in this codebase that can be wrong
about any of it.

The menu is asked for when a reader opens it, which is when their own page asks, and because a
thread of thirty comments would otherwise be thirty-one requests to draw one page.

A destructive entry asks twice. GitHub marks those in their own markup where they mark them at
all, and nothing here decides which of their entries deletes something.

Raising a discussion is handed over to GitHub's own form. Which category one goes in, and what
each of a repository's categories is for, is their page's to explain.

## What this does not do

- **No cross-repository list.** `github.com/discussions` redirects a signed-out reader to
  `/login`, so there is no recording of it and nothing here reads it. It is the one Discussions
  surface this extension does not answer.
- **No category management.** Making and ordering categories is a maintainer setting and
  belongs where the other settings are.
- **No claim about spam.** Spam in Discussions is a real complaint and a moderation problem.
  This interface does not guess at it.
