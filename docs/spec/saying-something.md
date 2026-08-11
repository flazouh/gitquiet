# Saying something, and not losing what was said

Two things, written together because they are the same act from a reader's side: getting a
comment onto GitHub, and not losing the words before it gets there.

Companion documents: `raising-an-issue.md` for the mutation that makes one, and
`settling-an-issue.md` for the mutations that close and reopen one.

## The comment on an issue, which their page gave no way to make

A pull request carries GitHub's own comment form in the served HTML, so a remark on one is
posted the way their page posts it: read the form, keep what it carries, send it back. See
`saying.ts`.

Their issue page is React and renders no such form. There is nothing signed to post with, so
until now this extension drew every issue and let a reader write on none of them. The write
goes the way closing one does: their own persisted mutation, recorded on 2026-08-06 with a
recorder over `fetch` while their box posted a comment on `flazouh/stack-probe#77`.

```json
POST /_graphql
{
  "persistedQueryName": "addCommentMutation",
  "query": "<hash for the release the page is on>",
  "variables": { "input": { "body": "…", "subjectId": "I_kwDOTndREM8AAAABLoOHsA" } }
}
```

Headers are the four in `settling-an-issue.md`: `Accept`, `X-Requested-With`,
`GitHub-Verified-Fetch`, and the page's `X-Fetch-Nonce`. The hash is found the way every other
one is, by reading their chunks. See `persisted.ts`.

### What Relay sends and the server does not want

Their own call carries a fifth variable:

```json
"connections": ["client:I_kwDOTndREM8AAAABLoOHsA:__Issue__backTimelineItems_connection(visibleEventsOnly:true)"]
```

That names a list inside Relay's store, so their cache can splice the new comment into the
timeline it is already showing. It is bookkeeping for their client and means nothing to the
server: sending the mutation without it answers the same, measured both ways on the same
issue. So it is not sent.

### The answer is the comment

Unlike the close, this mutation hands back what it made: the id, the author, the body, the
time, and `bodyHTML`. That last one is why nothing is read again after a post. The comment
appears in the conversation with GitHub's own rendering of it, so a mention, a reference, a
code fence and a task list look on the second they are posted exactly as they will look an
hour later. A read-back would cost a request to arrive at the same words.

## Words typed and not yet sent

The one thing on any of these screens that GitHub has no copy of. Every read can be made
again. A paragraph somebody wrote and lost is gone.

This extension makes that risk worse than an ordinary page does. Every screen is its own
bundle with its own React tree, so pressing a link unmounts the box as surely as closing the
tab would. Before this, a half-written comment did not survive a press.

So the box writes through to `localStorage` on every keystroke, under the subject it is about,
and reads it back when it next stands up. See `held.ts`. Three rules:

- A draft that exists opens the box on arrival. Folded, it is words the reader left behind and
  cannot see, which is losing them with an extra step.
- Cancel keeps them. It is not a word that means delete, anywhere else people write.
- Posting drops them, and so does emptying the box by hand.

Synchronous storage rather than the extension store, for the same reason the bar's row is:
the box is drawn in the first render, and a box that filled itself a tick later would take a
keystroke with it.

## What the box does that a textarea does not

All of it is in `typing.ts`, tested there, and applied in `Writing.tsx`.

- Enter under a list carries the list on: the next bullet, the next number counted up from the
  one that is there, the next unticked task box, the indent kept. Enter under a marker with
  nothing after it takes the marker away, which is how everybody leaves a list.
- Command with B, I, E and K marks the selection bold, italic, code and a link. The same four
  every editor uses. The tooltip says so, and `aria-keyshortcuts` says so to a screen reader.
- An address pasted over chosen words wraps them in a link. A paste with nothing chosen, or
  over an address, is left to the browser, because neither is a link anybody meant.
- The box grows with what is in it, up to a screenful. A five line window with a scrollbar in
  it is the thing people complain about in their own.

## Offering a name and a number

An at sign offers the people who can be mentioned here, a hash offers what can be referred to by
number. The rule for what the caret is asking for, which of them to offer, and how the chosen one
is written in, is in `domain/suggesting.ts` and tested there. The list itself is drawn under the
box in `Writing.tsx`, taking the arrows, Enter, Tab and Escape while it is up.

Both lists come from the route their own box asks, read once when a box opens:

```
GET /suggestions/issue?mention_suggester=1&repository=<repo>&user_id=<owner>
GET /suggestions/issue?issue_suggester=1&repository=<repo>&user_id=<owner>
```

Three things measured about it, each of which is a 406 when it is missing:

- `X-Requested-With: XMLHttpRequest` on the request. Accept alone is not enough: `application/json`,
  `text/fragment+html` and `*/*` were all refused without it.
- Standing inside the repository being asked about.
- The session cookie, so `credentials: "include"`.

Neither flag takes a query. Each answers with the whole list, so a keystroke asks nobody anything:
the filtering happens where the box stands. A list that will not read is an empty list rather than
a failure, because a comment that could not be written because a suggester changed shape would be
absurd.
