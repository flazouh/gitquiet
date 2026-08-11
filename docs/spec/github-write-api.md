# GitHub's `page_data` write API

Status: recorded

Every write GitHub's own pull request page makes, recovered from their shipped
JavaScript on 28 July 2026 and spot-checked against a live repository. The read
half of the same map is here too, because the two share one URL shape and one
naming scheme, and reading only half of it invites the guess this document
exists to prevent.

This is not a published API. Nothing here is contractual, and the bundle hashes
below will be stale within the week. What survives is the shape: a route name
per action, a body per route, and a permission flag in `merge_box` that says
whether the Participant may take it.

Pull requests only, and the boundary is worth stating because it is not obvious:
an issue is not written by any of these. Raising one is a persisted GraphQL
mutation on `/_graphql`, addressed by a hash and a node id rather than by an
action name, and `raising-an-issue.md` beside this file records it. Closing one
is the same mechanism again, in `settling-an-issue.md`, and commenting on one is in
`saying-something.md`. Looking for any of the three in the tables below is a way
to conclude it cannot be done.

## Where it came from

GitHub's pull request page is a React application whose action names live in one
module, recovered from `7485-f8030c418cd3be19.js`: two frozen objects, one of
read routes and one of writes, mapping a camel-case action to a snake-case path
segment. The call sites — which HTTP method, which body fields — are spread over
three lazily loaded chunks: `67643-…` for the merge box, `98739-…` for review
threads and their comments, `42068-…` for the timeline, reviewers and the review
submission dialog.

To re-derive it after GitHub reshuffles their bundles: load a pull request, take
every `.js` from `performance.getEntriesByType("resource")`, and grep the ones
containing `uT.` followed by an action name.

## URL shape

```
https://github.com/{owner}/{repo}/pull/{number}/page_data/{route}
```

The same prefix serves both halves. `merge_box` takes a query string
(`?merge_method=MERGE&bypass_requirements=false`); the rest take none.

## Headers

Reads need `Accept: application/json` and `X-Requested-With: XMLHttpRequest`, or
GitHub answers 406.

Writes need those two, plus `Content-Type: application/json` and
`GitHub-Verified-Fetch: true`. The last one stands in for a CSRF token on these
routes; the cookies do the rest, so `credentials: "include"` throughout.

GitHub's own bundle passes `body` as an object to a wrapper that serialises it
and attaches those headers. A caller outside their bundle has to do both.

## No dry run

These routes have no validation-only mode, and they are more forgiving than they
look. `enable_auto_merge` sent with `mergeMethod: "NOT_A_REAL_METHOD"` did not
answer 422 — it answered 200 and created the auto-merge request, having ignored
the field it could not read. Assume every request performs its action, and reach
for a scratch pull request rather than a probe.

## Writes

Bodies are given with GitHub's own field names. Where a route takes no body,
they send none at all.

### The merge box

| Route | Method | Body |
| --- | --- | --- |
| `merge` | POST | `{mergeMethod, bypassBranchProtections, commitTitle, commitMessage, authorEmail?}` |
| `enable_auto_merge` | POST | `{mergeMethod}` — see below |
| `disable_auto_merge` | POST | none |
| `dequeue_pull_request` | POST | none |
| `update_pull_request_branch` | POST | `{updateMethod}` — `MERGE` or `REBASE` |
| `run_action_required_workflows` | POST | none |
| `agent_merge` | POST | (not traced) |

### The pull request itself

| Route | Method | Body |
| --- | --- | --- |
| `close_pull_request` | POST | none |
| `reopen_pull_request` | POST | none |
| `convert_to_draft` | POST | none |
| `mark_ready_for_review` | POST | none |
| `delete_head_ref` | POST | none — verified, see below |
| `update_title` | PATCH | `{id, title}` |
| `update_description` | PATCH | `{id, body}` |
| `change_base` | PATCH | `{new_base_binary}` |

### Discussion

| Route | Method | Body |
| --- | --- | --- |
| `create_timeline_comment` | POST | `{text}` |
| `create_review_comment` | POST | thread position and body — see below |
| `update_review_comment` | PUT | `{body, commentId}` |
| `resolve_thread` | POST | `{threadId, resolution_reason}` |
| `unresolve_thread` | POST | `{threadId}` |
| `add_comment_reaction` | POST | `{reaction, …id}` — see below |
| `remove_comment_reaction` | POST | `{reaction, …id}` — see below |
| `hide_comment` | POST | `{classifier, commentId}` |
| `unhide_comment` | POST | `{commentId}` |

A reaction names its target with a different key depending on what is being
reacted to: `issueCommentId` for a timeline comment, `reviewSummaryCommentId`
for the summary at the head of a review, `commentId` for a comment inside a
review thread. Which of the two routes to call is the caller's decision, from
`viewerHasReacted`; there is no toggle.

A verdict's `event` is not spelled the way the rest of GitHub's API spells one.
It is lower case, and asking for changes is two words with a space between
them: `request changes`. `APPROVE`, `REQUEST_CHANGES` and `request_changes` are
each answered with 422 `{"error":"Invalid event"}`, which is what this route
says about a body it could not read at all — so the plausible-looking guess
fails in the same way a malformed request does, and says nothing about why.

`create_review_comment` carries the position as GitHub's own line marker rather
than a number: `R{line}` for the right side of the diff, `L{line}` for the left,
or the literal `FILE` when the comment is on the file rather than a line. A
multi-line comment adds the same marker for its start. `submitBatch` decides
whether the comment posts immediately or joins a pending review.

### `submitBatch` decides it, and `true` sends

`true` posts the comment at once. `false` holds it in the Participant's own
unsubmitted review, where nobody else can see it. The gateway sends `true`, so
it does what `src/ports/GitHubGateway.ts` says it does.

The field is the whole switch, and the changes route reports which way it went.
Both directions were exercised against `flazouh/ghpro-scratch#5` on 1 August
2026, from a signed-in browser, reading `viewerPendingReview` from
`pull/5/changes` before and after each post:

| Request | `viewerPendingReview` after | `GET /pulls/5/comments` |
| --- | --- | --- |
| `submitBatch: true`, line 2 | `{"id": null, "comments": []}` | lists the comment |
| `submitBatch: false`, line 3 | `{"id": 4835654003, "comments": [{"threadId": "2511002630"}]}` | does not list it |

Both answered 200 with the same `{thread: …}` body carrying a real thread id and
`databaseId`, so the response says nothing about which happened — the comment
that was held looks exactly like the comment that was sent. Anything that needs
to know has to read `viewerPendingReview` afterwards. That is also the check
worth adding as a contract test, since a change of default here is invisible at
the call site.

`abandon_review` is verified by the same pass: `DELETE
page_data/abandon_review` with `{reviewId}` answered 200 `Your pending review
comments have been discarded.` and emptied `viewerPendingReview`. The key is
`reviewId`, and the id comes from `viewerPendingReview.id`.

Re-reading any of this from the bundle failed the same day, which is worth
recording because the recipe at the top of this document implies it should have
worked. An anonymous fetch of `microsoft/vscode#327442`'s files page yields a
runtime whose `.u` maps 466 chunks by name; none contains `submitBatch`,
`comparisonStartOid` or a call site for `create_review_comment`. Chunks 7485 and
43990 carry the route-name map and nothing else. The chunk ids named above —
98739, 42068, 67643 — are gone from the map entirely. A logged-out session is
never served the write chunks, since it cannot write; the recipe needs an
authenticated session, not merely a public pull request.

One more thing seen in the same pass. GitHub gates a flag called
`unified_batch_pr_comments`, behind which their client keeps batched comments in
local storage with `savedAt` and `isOutdated` per item and re-anchors them
against `headSha`. They are rebuilding this area, so the shape above may move.

### Review

| Route | Method | Body |
| --- | --- | --- |
| `submit_review` | PUT | `{body, event, headSha}` — event is `approve`, `request changes` or `comment`, in lower case |
| `abandon_review` | DELETE | the pending review's id |
| `dismiss_review` | POST | `{reviewId, message}` |
| `modify_reviewers` | POST | reviewer ids |
| `re_request_review_from_user` | POST | the reviewer |
| `add_suggested_reviewer` | POST | (not traced) |
| `apply_suggestions` | POST | `{changes, currentOid, message}` |
| `apply_review_suggestions` | POST | `{comments}` |

### The head branch, after it has landed

`delete_head_ref` takes no body and answers
`{"message":"Head ref was successfully deleted"}`. Whether to offer it is not a
guess: `merge_box` carries `viewerCanDeleteHeadRef` and `viewerCanRestoreHeadRef`
on `pullRequest`, and the two swap over the moment the branch goes. A repository
that deletes head branches on merge by itself therefore says `false` to both
before anybody presses anything, which is the difference between a control
GitHub would honour and one that reads as broken.

Putting it back is not a `page_data` route. It is a Rails form on the merged
pull request page, `POST /{owner}/{repo}/pull/{n}/undo_cleanup`, carrying an
`authenticity_token` and nothing else.

Exercised against `flazouh/ghpro-scratch#11` on 12 August 2026, a squash-merged
pull request whose branch still existed:

| Request | Answer | `merge_box` after |
| --- | --- | --- |
| `POST page_data/delete_head_ref` | 200 `Head ref was successfully deleted` | `viewerCanDeleteHeadRef: false`, `viewerCanRestoreHeadRef: true` |

`headRefName` stays put through the delete, so the name is still there to say
which branch went.

### Runs, which are not `page_data` at all

Re-running a workflow and cancelling one are Rails forms on GitHub's own Actions
pages, and neither is reachable through `page_data`. Both are `POST` with
`_method=put` and an `authenticity_token` read off the page that carries the
form, sent as `application/x-www-form-urlencoded`.

| Form | Path | Fields beyond the token |
| --- | --- | --- |
| Re-run | `/{owner}/{repo}/actions/runs/{runId}/rerequest_check_suite` | `_method=put`, and see below |
| Cancel | `/{owner}/{repo}/suites/{checkSuiteId}/cancel` | `_method=put` |

Which jobs a re-run takes is decided by two optional fields, and their absence
is meaningful:

- neither field: every job in the run.
- `only_failed_check_runs=true`: the failed ones only.
- `check_run_id={id}`: that one job. GitHub renders one form per job, so the id
  comes off the page rather than out of a read.
- `enable_debug_logging=true`: their checkbox, omitted when unchecked.

Cancel is addressed by the **check suite** id and not by the run id, which is
the one thing here that a reader of the URLs would get wrong: the run page for
run 31534838662 posts to `/suites/85543576165/cancel`. `merge_box` does not
carry that id; the form on the run page does, and the run's own JSON calls it
`check_suite_id`.

Exercised against `flazouh/ghpro-scratch`, on a `workflow_dispatch` run put
there to be interrupted:

| Request | Answer | The run afterwards |
| --- | --- | --- |
| `POST /suites/85543576165/cancel` | 200, redirected to the run page | `status: completed`, `conclusion: cancelled` |
| `POST /actions/runs/31534838662/rerequest_check_suite`, `only_failed_check_runs=true` | 200, redirected to the run page | `run_attempt: 2`, `status: in_progress` |

Both answers are the run page's HTML rather than JSON, so the status code and a
re-read are all there is to go on. A refusal is not distinguishable from a
success by the body.

The four `rerequest_check_suite` forms a failed run carries — every job, failed
jobs only, and one per job — were read from `flazouh/acepe` run 29766868856 as
well, so the shape is not a property of a one-job repository.

Both forms are in the document GitHub serves, not injected by their own
JavaScript, which is what makes a plain fetch of the run page enough to find
them. Measured by fetching the run page and searching the text that came back
rather than the DOM after their bundle had run: `flazouh/acepe` run 29766868856,
180,762 characters, four `rerequest_check_suite` forms of which two carry
`only_failed_check_runs`; `flazouh/ghpro-scratch` run 31536586292 while it was
going, one `/suites/85548529120/cancel` form. Each page carries one kind and not
the other, since a run is either still going or finished.

Exercised a second time on 12 August 2026, that time through the parsing this
extension does rather than by hand, against `flazouh/ghpro-scratch` run
31537580051: read the page, take the form out of it, post its hidden fields
form-encoded. Cancelling answered 200 and the run read `conclusion: cancelled`
twenty seconds later; the failed-jobs re-run on that cancelled run answered 200
and the run read `run_attempt: 2`, `status: in_progress`. Their unchecked
`enable_debug_logging` is not a hidden field, so reading the hidden fields alone
leaves it out, which is what a browser submitting the form would also do.

### Preferences and stacks

`update_merge_box_user_preference`, `update_show_change_groups_preference`,
`update_whitespace_preference`, `update_file_tree_width_preference`,
`update_docked_panel_width_preference`, `pull_request_stacks`, `enqueue_stack`,
`stack_rebase`, `generate_change_groups`, `cleanup_codespaces`,
`submit_copilot_groups_feedback`.

## Merging, and what a queue does to it

There is no enqueue route. On a repository with a merge queue, GitHub's own
"Merge when ready" button posts to `enable_auto_merge` with a `mergeMethod` that
is not a merge method at all:

- `GROUP` — join the queue and be merged in a batch, which is the default.
- `SOLO` — join the queue and be merged alone.

On a repository without a queue, the same route takes a real merge method and
the same commit fields as `merge`, and means what its name says.

Which of the three is on offer is not something to infer from whether
`mergeQueue` is present. `merge_box` answers it directly, in
`pullRequest.viewerMergeActions`:

```json
[
  { "name": "MERGE_QUEUE",  "allowableStatus": "ALLOWED",
    "mergeMethods": [{ "name": "SQUASH", "isDefault": true, "allowableStatus": "ALLOWED" }] },
  { "name": "DIRECT_MERGE", "allowableStatus": "BLOCKED", "mergeMethods": [] }
]
```

`ALLOWED` or `BLOCKED` per action, and per merge method within it. A repository
that permits squashing and forbids the other two says so here, which is the
difference between offering the button GitHub would offer and offering one their
server refuses.

Two flags sit beside it: `viewerCanAddAndRemoveFromMergeQueue`, which gates both
joining and leaving, and `viewerCanAddToMergeQueueSolo`, which gates `SOLO`
alone.

## Verified

Against `octo-org/octo-repo#1439`, a repository that lands through a queue:

| Request | Answer |
| --- | --- |
| `POST page_data/dequeue_pull_request` | 200 `Pull request was successfully removed from the merge queue.` |
| `POST page_data/enable_auto_merge` | 200 `Auto merge request successfully created` |
| `POST page_data/disable_auto_merge` | 200 `Auto merge request successfully disabled` |

Against `flazouh/ghpro-scratch#1`, a scratch pull request opened by the same
account that reviewed it, which is why the two verdicts a reviewer cannot give
themselves are recorded as refusals rather than as successes:

| Request | Answer |
| --- | --- |
| `PUT page_data/submit_review`, `event: "comment"` | 200, review created |
| `PUT page_data/submit_review`, `event: "approve"` | 422 `You need to leave a comment indicating the requested changes.` |
| `PUT page_data/submit_review`, `event: "request changes"` | 422, the same sentence |
| `PUT page_data/submit_review`, `event: "APPROVE"` | 422 `Invalid event` |
| `PUT page_data/submit_review`, `event: "request_changes"` | 422 `Invalid event` |

The body above was not read from their bundle: it was captured off the wire
with `Network.enable` while GitHub's own review dialog submitted, after two
attempts to patch `window.fetch` in the page recorded every other request the
page made and not that one.

Against `flazouh/ghpro-scratch` on 12 August 2026, for the branch a merge leaves
behind and the two things that can be done to a run. The requests and what they
did are in "The head branch, after it has landed" and "Runs, which are not
`page_data` at all" above, since each of them needs a paragraph rather than a
row.

The rest of this document is read from GitHub's source and not yet exercised.
