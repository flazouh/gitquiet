# Spec: Which files conflict

Status: measured

## Problem

The merge card says a pull request has a conflict and does not say with what.

The card draws GitHub's own failed merge conditions verbatim, so on a conflicted
pull request it reads:

> **Pull request merge conflict state**
> Pull request cannot be merged because it has a merge conflict.

Their own page says the same thing and then lists the paths, with a button to
resolve them in their web editor. A reader who wants to know whether this is one
lock file or eleven source files has to leave for GitHub's page to find out,
which is the trip this extension exists to save.

## What GitHub knows, measured

Probed on `flazouh/stack-probe#76`, made for this: a branch off the first commit
that adds `format.js` and `parse.js`, both of which `main` already has with other
contents, so the merge is an add/add conflict on two files.

**It is in the payload the gateway already fetches.** The
`PULL_REQUEST_MERGE_CONFLICT_STATE` condition of `page_data/merge_box` carries
three fields beyond the five every condition has:

```json
{
  "type": "PULL_REQUEST_MERGE_CONFLICT_STATE",
  "displayName": "Pull request merge conflict state",
  "description": "The pull request must not have any unresolved merge conflicts",
  "message": "<div>Pull request cannot be merged because it has a merge conflict.</div>",
  "result": "FAILED",
  "conflicts": ["format.js", "parse.js"],
  "isConflictResolvableInWeb": true,
  "webEditorConflictResolution": { "viewerCanResolve": true, "viewerCannotResolve": null }
}
```

`conflicts` is a flat array of paths, in the order GitHub gives them, with no
count and no line numbers. Nothing else has to be asked for: this is the same
route, the same request and the same response the card is already drawn from.

**The keys are always there and the values are null when there is nothing to
say.** On `#73` and `#74`, both `CLEAN`, the condition is `PASSED` and carries
the same eight keys with `conflicts: null` and `isConflictResolvableInWeb: null`.
So the schema reads them as optional and nullable, which is what every remembered
payload needs in any case.

**Two routes that looked like the answer are not.**
`GET /<owner>/<repo>/pull/<number>/page_data/conflicts` is a 404, nine bytes.
`GET /<owner>/<repo>/pull/<number>/conflicts` is their web editor: 200 and 109 KB
of HTML on `#76`, and on a pull request with no conflict it redirects to the pull
request itself, which is how the ten clean ones were told apart before `#76`
existed. Both are the wrong shape for a file list that arrives free with a
payload already in hand.

**`webEditorConflictResolution` is not read.** It was `{viewerCanResolve: true,
viewerCannotResolve: null}` on the one conflicted pull request measured, where
`isConflictResolvableInWeb` was also `true`. One observation cannot say how the
two differ or which one refuses first, and a guess about it would be a claim
about the reader's permissions. `isConflictResolvableInWeb` is read on its own
terms, and where a difference turns up, this is the field to look at.

## Decision

`MergeBlocker` carries `files`, the paths GitHub named, and `mayResolve`,
whether GitHub says their web editor could take them.

**On the blocker rather than on the merge state.** A conflict is one condition
among seven and the paths belong to it, the way `bypassable` belongs to the rule
it is about. Hung off `MergeState` they would be a second fact needing to be
matched back to the row that explains them.

**`files` is an array and empty everywhere else**, rather than an Option. Six of
the seven conditions have nothing to list, and an empty list is what "nothing to
list" already means — the card draws no blockers at all on the same reasoning.

**`mayResolve` is `false` unless GitHub said `true`.** Null is GitHub declining to
say, which is not the same as yes, and the one thing that must not happen is
offering a reader an editor that then refuses them.

### What is drawn

The paths under the blocker's own explanation, one per line, in GitHub's order,
each in the type the diff uses for a path.

**Not a count.** "2 files conflict" over a list of two is the count restating the
list, which is the fault the issues list header was just cut down for.

**Where GitHub says the web editor could take them, one link to it**, reading
"Resolve them on GitHub" and going to `/<owner>/<repo>/pull/<number>/conflicts`.
Their editor is the only thing that can resolve a conflict from a browser, this
extension is not going to grow one, and a list of files with nowhere to go is
half an answer.

**Nothing is truncated.** A pull request that conflicts in forty files is a pull
request whose reader needs to see that, and the card is already as long as its
blockers.

## Out of scope

- Resolving a conflict here. Their editor does it, and this links to it.
- The conflicting hunks, which are only on the web editor page as HTML.
- `webEditorConflictResolution`, for the reason measured above.

## Acceptance

1. On a conflicted pull request the card lists every path GitHub named, under the
   conflict blocker and nowhere else.
2. No other blocker grows a list.
3. A clean pull request is unchanged.
4. A payload remembered before this existed decodes, with no paths.
5. Where GitHub says the web editor could take them, one link to their conflicts
   page stands under the list; where GitHub says nothing or says no, there is no
   link.
6. No count of the files is drawn.

## Related

- The condition this reads: `src/github/wire.ts`, `MergeBoxRoute`
- Where a failed condition becomes a blocker: `src/github/snapshot.ts`, `mergeState`
- The card: `src/ui/Merge.tsx`
- The route's headers, and the 406 without them: `docs/spec/github-write-api.md`
