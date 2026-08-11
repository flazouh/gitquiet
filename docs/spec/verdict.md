# Saying what you think of a pull request

GitHub's path to an approval is four acts: scroll to the top of Files changed, press "Review
changes", choose a radio, press "Submit review". The three verdicts sit on the page here, under
the conversation, where the reading ends.

The panel is `Verdict.tsx`. The route is `GitHubGateway.review`, which was written long before
anything called it.

## The route

```
PUT /:owner/:repo/pull/:number/page_data/submit_review
GitHub-Verified-Fetch: true
```

```json
{ "body": "the retry bound is off by one", "event": "request changes", "headSha": "177ca53…" }
```

`event` is lower case, and `request changes` carries a space where every other name in GitHub's
API would have an underscore. `APPROVE`, `REQUEST_CHANGES` and `request_changes` are each
answered with 422 `Invalid event`, so the spelling that looks like the rest of their API is the
one this route refuses. See `eventFor`.

## What the panel says, and why

- **Folded, with the approval beside the fold.** Every other box here is folded until it is
  pressed — `Saying`, and the answer at the foot of a thread — and open by default this one was
  two hundred pixels of empty box under a conversation that is usually read without a word being
  added. An approval needs no words and is the common answer, so that one button stands at rest
  and the box opens under it on a press. Two acts for an approval where GitHub asks four, and one
  for the reader who only wants to approve.
- **The three verbs wear the merge card's tones.** Green for the one that lets a change land, red
  for the one that holds it up, the plain fill for the one that decides nothing. Same strings as
  `Merge.tsx`, so a reader who has learnt that card has learnt this one, and the word swaps into
  its waiting word in one grid cell rather than moving the buttons beside it. See `says.tsx`.
- **The commit.** GitHub does not clear a verdict when the branch moves, which is the oldest
  complaint about reviews: an approval given now goes on standing over whatever is pushed next.
  So the panel names the commit it is about, and the verdict is sent with that commit rather
  than with whatever the branch has moved to since.
- **Approve takes no words.** GitHub refuses the other two without a body, so those two buttons
  are out until there is one. A button that earns a 422 teaches the reader nothing.
- **No approval of your own.** GitHub answers that with 422. It is not offered; commenting on
  your own is, because answering a round of review is what an author does.
- **The words stay on a refusal.** Everything else on the screen can be read again. A paragraph
  cannot, and losing one in their dialog is what people write bug reports about.
- **Nothing is batched.** A comment typed against a line was posted when it was written, so this
  box holds only what is being said about the whole reading. Reviews that have to be submitted
  somewhere else are the reviews that get lost when the tab closes.

## The one thing GitHub will not hand back

Their payload carries `latestOpinionatedReviews`, and the word is theirs: an approval and a
request for changes are in it, and a review that only commented is in nothing at all. Their
timeline route lists such a review by id and state with no body, and no `page_data` route hands
the body over.

So a comment-only verdict is remembered locally, under the pull request, with the commit it was
about. See `verdicts.ts`. What GitHub says outranks it always, so a review they dismissed cannot
be resurrected from local storage; the remembered one is only read where their payload says
nothing about this reader.
