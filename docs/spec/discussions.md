# Spec: Discussions

Status: draft-for-review. The vocabulary is proposed in the Language section below and is not
yet in `CONTEXT.md`.

Covers three addresses:

| Address | Is |
| --- | --- |
| `/{owner}/{repo}/discussions` | every discussion in a repository |
| `/{owner}/{repo}/discussions/categories/{slug}` | the same list, one category |
| `/{owner}/{repo}/discussions/{number}` | one discussion |

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

| Repository | Rows | Questions | Answered | Replies, no answer | No reply yet |
| --- | ---: | ---: | ---: | ---: | ---: |
| `vercel/next.js` | 25 | 16 | 1 | 15 | 0 |
| `tailwindlabs/tailwindcss` | 25 | 10 | 4 | 6 | 0 |
| `supabase/supabase` | 25 | 14 | 2 | 11 | 1 |
| `vitejs/vite` | 25 | 18 | 5 | 13 | 0 |
| `shadcn-ui/ui` | 25 | 10 | 2 | 8 | 0 |
| `nuxt/nuxt` | 25 | 16 | 3 | 11 | 2 |
| `laravel/framework` | 25 | 25 | 3 | 21 | 1 |
| `denoland/deno` | 25 | 11 | 2 | 9 | 0 |
| **Total** | **200** | **120** | **22** | **94** | **4** |

"Question" here means a row in a category that takes answers, which is the only kind of row
GitHub prints the word Answered or Unanswered on. Eighteen percent of them are answered. The
rest are not, and 94 of those 98 have somebody's reply sitting in them already.

Those 94 and those 4 are two different states of the world. One needs a person to write an
answer. The other needs a person to point at an answer that is already there. GitHub draws
them the same, and it is the 94 that make the page feel abandoned.

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
| **Settled** | Answered Questions, locked Discussions, and everything in a category that takes no answers. |

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
page that readers use and it is already legible.

### One discussion opens on its Answer

A Question that has an Answer draws the Answer under the body, before the other replies, with
the rest below it in order. That is what the reader came for, and GitHub already knows which
comment it is: the comment carries `timeline-chosen-answer` and the page carries `answered`.

A Stale Question draws the reply the reader is most likely to mark, which is the most upvoted
one, under the body with the mark offered on it. Nothing is marked without a press.

## What this does not do

- **No cross-repository list.** `github.com/discussions` exists for a signed-in reader and is
  a separate screen with a separate spec. This one is about a repository.
- **No poll voting.** A Poll is drawn and counted, and voting goes back through GitHub's own
  page. Writing a vote is in the write spec, not this one.
- **No category management.** Making and ordering categories is a maintainer setting and
  belongs where the other settings are.
- **No claim about spam.** Spam in Discussions is a real complaint and a moderation problem.
  This interface does not guess at it.
