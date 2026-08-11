# Answering a thread, and ending it

A review thread is finished by two acts that GitHub puts in one place and this interface used to
put in none: an answer, and a tick. Until now a reader who wanted either was sent back to
GitHub's page, which is the trip this whole interface exists to remove.

Counted over twenty merged pull requests of `octo-org/octo-repo`, 50 of the 67 threads
somebody answered were resolved by the same person in the same minute. Answering and resolving
are one act, so they are one row here.

The routes are in `GitHubGateway.reply` and `GitHubGateway.unsettle`. The row is `ThreadView.tsx`,
in the diff and in the conversation column alike.

## The two routes

### Reply

```
POST /:owner/:repo/pull/:number/page_data/create_review_comment
GitHub-Verified-Fetch: true
```

```json
{ "text": "renamed it", "inReplyTo": "3724885733", "submitBatch": true }
```

The same route a new thread goes to. `inReplyTo` is what makes it a reply rather than a thread of
its own, and it is the `databaseId` of a **comment**: a thread id there is refused with 422. The
answer is the whole thread, every comment in it, rendered as GitHub renders it. So the reply is
on the screen without reading the page again.

The comment addressed is the first one in the thread, not the last. Their route files the reply
at the end either way, and the first comment is the one that is certainly still there: the last
may have been deleted by whoever wrote it a moment ago.

### Unresolve

```
POST /:owner/:repo/pull/:number/page_data/unresolve_thread
```

```json
{ "threadId": "2530224233" }
```

The exact opposite of `page_data/resolve_thread`, which this interface already used from the
findings panel. A thread id here, not a comment id.

## What the payload had to start carrying

Two fields that were read from GitHub's page and thrown away:

- `databaseId` on a thread comment, which is the number a reply is addressed to. Absent on a
  comment this interface wrote itself and has not read back, and nothing can be replied to until
  the next read. That is why `ThreadComment.id` is optional.
- `viewerCanReply` on a thread, which is false on a locked conversation. No box is drawn there,
  rather than a box that earns a 403 on the press.

## The row

Folded until pressed. A box under every thread on a pull request with twenty of them is two
hundred pixels twenty times, on a page that is usually read without a word being added.

- **Answer this** opens the box. It is the same box as everywhere else here, so `@` names people
  and `#` finds issues and a pasted screenshot goes up. See `saying-something.md` and
  `attaching.md`.
- **Reply** posts it. The words stay in the box if GitHub refuses, in their words, because the
  paragraph that was typed is the one thing that cannot be fetched again.
- **Resolve** / **Open again** is the same button in its two states, beside the reply and not
  hidden behind a menu. The glyph says what the press will do rather than what a tick means
  elsewhere: muted while there is something to end, and the circle that reopens things — the one
  `Settle` puts on an issue — once it is ended. A green tick beside the word "Resolve" was the row
  saying the thread was settled and offering to settle it in the same breath.

The row is divided from the remarks above it, the way those are divided from each other: it is the
foot of the thread rather than another paragraph in it.

In the diff the tick moves at the press and goes back if GitHub refuses. A tick that waits for a
round trip reads as a button that did nothing, and the reader presses it again. That is also why
this one button says no waiting word while GitHub is asked: the mark and the label have already
flipped, and "Resolving…" in the same cell would be the button saying it is still asking while the
mark beside it says the thread is settled. `aria-busy` carries the wait to a reader being read to.
