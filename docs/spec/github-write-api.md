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
| `delete_head_ref` | POST | none |
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

`create_review_comment` carries the position as GitHub's own line marker rather
than a number: `R{line}` for the right side of the diff, `L{line}` for the left,
or the literal `FILE` when the comment is on the file rather than a line. A
multi-line comment adds the same marker for its start. `submitBatch` decides
whether the comment posts immediately or joins a pending review.

### Review

| Route | Method | Body |
| --- | --- | --- |
| `submit_review` | PUT | `{body, event, headSha}` — event is `APPROVE`, `REQUEST_CHANGES` or `COMMENT` |
| `abandon_review` | DELETE | the pending review's id |
| `dismiss_review` | POST | `{reviewId, message}` |
| `modify_reviewers` | POST | reviewer ids |
| `re_request_review_from_user` | POST | the reviewer |
| `add_suggested_reviewer` | POST | (not traced) |
| `apply_suggestions` | POST | `{changes, currentOid, message}` |
| `apply_review_suggestions` | POST | `{comments}` |

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

Against `OpenRouterIncubator/ori#1439`, a repository that lands through a queue:

| Request | Answer |
| --- | --- |
| `POST page_data/dequeue_pull_request` | 200 `Pull request was successfully removed from the merge queue.` |
| `POST page_data/enable_auto_merge` | 200 `Auto merge request successfully created` |
| `POST page_data/disable_auto_merge` | 200 `Auto merge request successfully disabled` |

The rest of this document is read from GitHub's source and not yet exercised.
