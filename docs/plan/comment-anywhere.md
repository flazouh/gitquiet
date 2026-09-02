# Commenting where the diff does not reach

Status: steps 0 to 4 done, 2026-09-02. Only step 5 is left, and it needs a decision rather than
a build: step 2 found GitHub takes such a comment and draws it nowhere. Step 2 answered all three questions and reversed
this plan's section 3; steps 3, 4 and 5 are now unblocked and section 5 needs re-reading
against what was measured. See `docs/spec/github-write-api.md`, "What `create_review_comment`
takes, measured".

Two GitHub Community discussions ask for the same thing from two directions.
[#4452](https://github.com/orgs/community/discussions/4452), 2,352 upvotes, asks
to comment on and suggest changes to unedited lines of code.
[#9099](https://github.com/orgs/community/discussions/9099), 1,299 upvotes, asks
to comment on files the pull request did not change. Together they are the
largest recorded piece of unmet demand for this product.

This plan answers what each of them needs, says which half GitHub's server will
take, and orders the work so the cheapest useful slice ships first.

The short version. The first discussion is mostly already solved, and the piece
that is missing is a correctness bug plus the ability to draw more of the file.
The second discussion asks for something GitHub's own server refuses, so the
honest answer is a Remark carrying a permalink rather than a review thread that
cannot exist.

## 1. Can a comment go on a context line today

Yes, on the additions side. Nothing in this repository filters a pick by the
kind of line it landed on.

`renderDiff` turns selection on for the whole file at once:

```212:216:src/diff/engine.ts
    enableLineSelection: request.onPick !== undefined,
    enableGutterUtility: request.onPick !== undefined,
    lineHoverHighlight: "both",
    onGutterUtilityClick: (range) => request.onPick?.(picked(range)),
    onLineSelected: (range) => request.onPick?.(range === null ? null : picked(range)),
```

The condition is whether anything is listening, not what is on the line. The
pick travels to `onPost` in `Files.tsx`, to `onPost` in `FileBrowser.tsx`, and
into `NewComment` in `Shell.tsx` without any of them reading the line kind. So a
context line inside an existing hunk is already commentable.

GitHub's REST reference says the right side covers context lines outright:

> Use RIGHT for additions that appear in green or unchanged lines that appear in
> white and are shown for context.

That is documentation for `POST /repos/{owner}/{repo}/pulls/{n}/comments`, which
is not the route this gateway calls. **Inference**: the `page_data` route behaves
the same way, because GitHub's own page has always let a reviewer comment on the
three context lines around a change.

### What is broken: the deletions side

`Picked` carries a side and the write throws it away. Follow it:

- `src/diff/engine.ts:122` builds `Picked` with `side: range.side ?? "additions"`.
- `src/ui/Files.tsx:570` calls `onPost({ ...picked, body })`, so the side is in
  the object.
- `src/ui/FileBrowser.tsx:45` declares `onPost` as `{path, from, to, body}`. The
  side survives the spread at runtime because TypeScript does not check excess
  properties introduced by a spread.
- `src/ui/Shell.tsx:302` reads four fields and drops the fifth.

Then the gateway hardcodes the side:

```1651:1654:src/github/GitHubGateway.ts
        path: note.path,
        line: note.line,
        side: "right",
        subjectType: "line",
```

A reader who marks a deleted line therefore posts a comment against the new
file, at the old file's line number. Either GitHub refuses it, or it lands on
whatever now sits at that number. No test in `GitHubGateway.test.ts` covers a
left-side comment: the `commenting` helper takes only `line` and `startLine`.

One smaller loss sits beside it. Pierre's `SelectedLineRange` carries `endSide`
as well as `side`, and `picked` in `src/diff/engine.ts:122` reads only `side`. A
drag that starts on a deleted line and ends on an added one collapses to one
side.

## 2. What the write route needs

### Recorded as established

`docs/spec/github-write-api.md` records the position marker:

```124:128:docs/spec/github-write-api.md
`create_review_comment` carries the position as GitHub's own line marker rather
than a number: `R{line}` for the right side of the diff, `L{line}` for the left,
or the literal `FILE` when the comment is on the file rather than a line. A
multi-line comment adds the same marker for its start. `submitBatch` decides
whether the comment posts immediately or joins a pending review.
```

The same document records that this half was read from GitHub's shipped
JavaScript rather than exercised, and that a later attempt to re-read it from an
anonymous session failed because a logged-out session is never served the write
chunks. So `FILE` is read from their source and not verified against the server.

The body the gateway actually sends was captured off the wire, and its
`submitBatch` behaviour was exercised against `flazouh/ghpro-scratch#5` on
1 August 2026. That is the established part of the write: the field names in
`GitHubGateway.comment`, and the fact that `true` posts at once.

### What a file-level comment needs, and what it does not

| Field | For a line comment | For a file comment |
| --- | --- | --- |
| `comparisonStartOid` | the base sha | needed, **inferred** |
| `comparisonEndOid` | the head sha | needed, **inferred** |
| `path` | the file | needed, **inferred** |
| `text` | the body | needed |
| `submitBatch` | `true` to post at once | needed |
| `line` | the last line of the range | **inferred**: omitted |
| `side` | `right` or `left` | **inferred**: omitted |
| `subjectType` | `"line"` | **inferred**: `"file"` or `"FILE"` |
| `positioning.type` | `"line"` | **inferred**: `"file"` |

Every cell marked inferred is a guess. The two commits stay because a comment is
anchored to a comparison rather than to a file, and the route already refuses a
body it cannot read. The spelling of the subject type is the weakest guess of
the set: the spec quotes the literal `FILE` in upper case, GitHub's REST
reference spells the same enum `file` in lower case, and the two routes are not
the same route. There is no dry run on these routes, so the only way to settle
it is to send one against a scratch pull request and read what comes back. Step
2 below does that.

### What a line outside the diff needs

Nothing extra, as far as anything here can tell. GitHub shipped this on their
own new Files changed page on 25 September 2025:

> Using the new "Files changed" page, you can now comment on any line of a
> changed file!

Their instructions are to expand the diff to reveal unchanged lines, then click
the plus on a line. That is the same gesture this interface already has, against
the same route. **Inference**: the body is unchanged and only the line number
falls outside the hunks. The obstacle is not the request. It is that this
interface never draws those lines, so nobody can click one.

Two limits from the same announcement, both stated by GitHub:

> Note: This feature is rolling out gradually on a per-repository basis.

> These comments can only be added to files already changed (i.e., not unchanged
> files).

## 3. For an unchanged file: `FILE`, a whole-file patch, or neither

> **Corrected 2026-09-02 by the experiment in step 2.** The premise below is wrong. GitHub's
> `page_data` route *does* accept a review comment on a file the pull request did not change:
> `flazouh/ghpro-scratch#14` answered 200 with a real thread on `notes.md`, which that pull
> request never touched. It refuses only a path it cannot resolve in any tree, with 422
> `{"error":"Path could not be resolved."}`. Their own changelog sentence quoted below
> describes their client, not their server.
>
> The conclusion still holds and the reason is now different and weaker. Such a thread is
> real and every reader finds it on the Conversation page, but the file gets no entry in
> `diffSummaries`, so it is drawn nowhere in any diff and the Conversation page does not say
> which file it is about. It is not invisible; it is unplaceable. Section 5 is worth
> re-reading against that before it is built.

Neither. GitHub does not accept a review comment on a file the pull request did
not change, and the sentence above says so in their own words. The route belongs
to a pull request and the path is checked against the comparison the pull request
carries. A patch synthesised in the browser does not change what the server
compares against.

So discussion #9099 asks for an object GitHub does not have. Any comment this
interface invented for it would live nowhere GitHub can show it, which breaks
the promise in `CONTEXT.md` that nothing done here is invisible to a colleague on
GitHub's own page.

For a file the pull request did change, both forms are useful and they are not
substitutes:

- `subjectType` naming the file, with no line, for a remark about the file as a
  whole. "This file should not be in this pull request" is not about line 40.
- A line comment on a line the pull request did not edit, for a remark about
  code near the change. This needs the line to be inside what GitHub considers
  the file's diff, which their page reaches by expanding.

The read side already tolerates the first one. `spotAt` in
`src/github/snapshot.ts:143` accepts `L{n}` and `R{n}` and rejects everything
else, so a thread whose marker is `FILE` arrives with no anchor. `Conversation`
in `src/ui/About.tsx:111` draws every thread regardless of anchor, so the remark
appears in the column rather than disappearing.

## 4. Reaching a file the pull request did not touch

The rail is built from `snapshot.files`, which is GitHub's list of changed files.
An untouched file is not in it and never will be. Two reads that already exist
close the gap.

| Read | What it gives | Cost |
| --- | --- | --- |
| `treePaths(reference, sha)` | every path in the repository at one commit | one request. The gateway's own note records seven thousand paths and six hundred kilobytes on `react/react` |
| `fileAt(reference, branch, path)` | one file, its lines, and GitHub's rendering where they have one | one request per file opened |

`fileAt` reads GitHub's blob page rather than the raw host, because the raw host
answers `Access-Control-Allow-Origin: *` and a request carrying the reader's
session may not accept that. So the answer is an HTML document. Its size is not
measured anywhere in this repository, and step 5 measures it before anything is
built on it.

`wholeFile` in `src/domain/wholeFile.ts` already turns those lines into a patch
whose every line is context, and `ReadingPane.tsx` already draws one with the
reader's own theme, font size and line numbers. The machinery for showing an
untouched file as a diff is finished. Only the write is missing, and section 3
says the write does not exist.

## 5. What breaks

### Threads already arrive that the diff cannot draw

This is the sharpest finding in the plan, and it needs no new write at all.

Colleagues using GitHub's new Files changed page are creating comments on
unchanged lines today. Those threads arrive in the pull request payload like any
other. `anchorsIn` in `src/github/snapshot.ts:157` reads the marker `R150` off
`markersMap` and produces an anchor at line 150. Then:

```53:61:src/ui/threads.ts
export const threadNotes = (
  threads: ReadonlyArray<ReviewThread>,
  path: string
): ReadonlyArray<Note> =>
  threadsIn(threads, path).map(({ thread, at }) => ({
    key: threadKey(thread),
    side: sideOf(at.side),
    line: at.line
  }))
```

Line 150 is not in the patch GitHub sent, so it is not a line the renderer drew.
What Pierre does with an annotation on a line it did not draw is not established
here. **Inference**: it drops it silently. The thread still shows in the
Conversation column and in the Control Center, so nothing is lost outright, but
the file reads as though nobody said anything about it.

### The branch moving

A comment carries `comparisonStartOid` and `comparisonEndOid`, so it is anchored
to a pair of commits rather than to a file. A comment on a line the pull request
did not edit is anchored to a line that no commit touched, which should make it
more stable than an ordinary one, not less. That is a guess. GitHub says
otherwise in the same announcement:

> This feature changes the positioning logic for comments in general.

`docs/spec/github-write-api.md` records a second warning from the same area:
GitHub gates a flag called `unified_batch_pr_comments`, behind which their client
keeps batched comments in local storage with `isOutdated` per item and re-anchors
them against `headSha`. They are rebuilding this. Nothing here should assume the
positioning is settled.

### Drafts

`src/ui/drafts.ts` keys a draft by path, side and range:

```20:21:src/ui/drafts.ts
export const draftKey = (at: Pick<Draft, "path" | "side" | "from" | "to">): string =>
  `${at.path}:${at.side}:${at.from}-${at.to}`
```

Four consequences follow from that key and from where the list is held.

- No commit is in the key. A draft written against line 150, then a push that
  moves line 150, is offered again against a line that has moved. Nothing warns
  the reader.
- The list lives in React state in `FileBrowser`, not in `localStorage`. It dies
  when the page does. `docs/spec/saying-something.md` explains why the comment
  box writes through to storage on every keystroke, and this list does not.
- `FileBrowser` draws one pane per entry of `files`. A draft on a file outside
  that list has no pane to be drawn in, so any work on untouched files has to
  put the file into the walk first.
- The key already carries a side, so the side fix in step 1 does not disturb it.

### The colleague without GitQuiet

`CONTEXT.md` states the promise: this interface writes back through GitHub's own
routes so that nothing done here is invisible to anyone still using their page.
Measured against each of the three cases:

- A comment on a context line inside a hunk. Visible everywhere, on every page,
  today. Nothing to consider.
- A comment on an expanded unchanged line. GitHub says the Conversation page and
  the new Files changed page both show it, and that the classic Files changed
  page shows a warning saying there are additional comments only available on the
  new page. So it is reachable from every page but not drawn inline on one of
  them. That is GitHub's own behaviour for GitHub's own feature, and this
  interface cannot improve on it. The interface should say so where the comment
  is written, rather than let a reader find out from a colleague.
- A comment on a file the pull request did not touch. There is no GitHub object
  for it, so this plan does not invent one. Step 5 posts a Remark carrying a
  permalink instead. GitHub renders a blob permalink as the lines it names, in
  every comment, on every page, for everybody. It is not a review thread and it
  is not offered as one.

## The steps

Ordered so the first one is worth shipping alone and each later one stands
without the ones after it. Every step names its failing test first.

### Step 0. Draw the threads that already arrive

**Built, 2026-09-02.** `threadsOn` in `src/ui/threads.ts` splits a file's threads by
whether its diff holds the line they hang on, and `Files.tsx` draws the ones it does not
above the file with their line said in words. The renderer is handed no row for them, so
what Pierre does with an annotation on a line it never drew stopped mattering and is still
unestablished. `Out of Reach` is in `CONTEXT.md`. Both new pane tests were run against the
old behaviour first and failed.


The cheapest useful slice, and the only one that changes nothing about writing.
When a thread is anchored outside the lines the renderer drew, say so instead of
dropping it. The file heading gains a line saying how many remarks sit outside
the drawn lines, and pressing it opens them in the column.

Failing test first: in `src/ui/threads.test.ts`, `threadNotes` is given a thread
at line 150 and a patch whose hunks cover lines 1 to 40, and is asked to report
line 150 as out of reach rather than as a note. The test fails because
`threadNotes` today takes no patch and reports every thread as a note.

Files: `src/ui/threads.ts`, `src/ui/Files.tsx`, `src/ui/FileHeading.tsx`.

Estimate: about 3 hours.

### Step 1. Carry the side

**Already built when this plan was re-read on 2026-09-02.** `NewComment` in
`src/domain/PullRequest.ts` carries a side, `Shell.tsx` sends `anchorSideOf(note.side)`, and
`GitHubGateway.comment` writes `asTheyNameIt(note.side)` rather than a hardcoded `"right"`.
The `endSide` half below is not done: `picked` still reads only `side`, so a drag crossing
the two halves still collapses to one.


Take `Picked.side` from the pick through to the wire, so a remark on a deleted
line is posted against the old file.

Failing test first: in `src/github/GitHubGateway.test.ts`, add to the
`writing a comment on some lines` block a test named "posts a remark on a
deleted line against the old file". It sends `side: "before"` and expects
`side: "left"` in the body and in `positioning`. It fails today because the
gateway writes `"right"` unconditionally.

Then widen `NewComment` in `src/domain/PullRequest.ts` with a side, and carry it
through `Files.tsx`, `FileBrowser.tsx` and `Shell.tsx`. Read `endSide` in
`src/diff/engine.ts` while the file is open, and refuse a range that crosses
sides rather than silently picking one.

Files: `src/domain/PullRequest.ts`, `src/github/GitHubGateway.ts`,
`src/diff/engine.ts`, `src/ui/Files.tsx`, `src/ui/FileBrowser.tsx`,
`src/ui/Shell.tsx`, and the gateway's test file.

Estimate: about 2 hours.

### Step 2. Settle the route by experiment

**Done, 2026-09-02, against `flazouh/ghpro-scratch#14`.** All three answers are recorded in
`docs/spec/github-write-api.md` under "What `create_review_comment` takes, measured". In
short: a line below the hunks is taken and comes back as `R150` with `ctx: [147, 153]`, the
lines GitHub says to reveal around it; both `"file"` and `"FILE"` are taken and both answer
`"file"`; a path outside the comparison is taken too, and only an unresolvable path is
refused. Nothing needed GitHub's per-repository rollout — the route took the line on a
repository whose own page offers no such thing.

Nothing below this line should be built on a guess about what the server takes.
Three questions, one scratch pull request, one signed-in browser. There is no dry
run on these routes, so each question costs a real comment on a throwaway pull
request.

Open a pull request on `flazouh/ghpro-scratch` that changes one line near the top
of a file of two hundred lines. Then send, and record the answer for each:

1. `create_review_comment` with `line` set to a line far below the hunks, and
   everything else exactly as `GitHubGateway.comment` sends it now. Does it take
   the comment, and does the thread come back with marker `R150`?
2. The same request with `subjectType: "file"` and no line, and again with
   `"FILE"`. Which spelling is accepted, and what does `positioning` have to say?
3. The same request with a `path` naming a file the pull request did not change.
   Record the refusal word for word.

Write the answers into `docs/spec/github-write-api.md` beside the rows they
correct, in the style of the verification tables already there. Note the
repository, the date, and that the first answer may depend on GitHub's
per-repository rollout.

Estimate: about 1 hour, plus the wait for a repository that has the rollout. If
question 1 is refused on the scratch repository, repeat it on one where GitHub's
new Files changed page offers the plus on an expanded line, because that proves
the rollout is on there.

### Step 3. Expand the context of a changed file

**Built, 2026-09-02.** `src/domain/revealing.ts` says which halves a file needs,
`src/app/revealing.ts` fetches and keeps them off the raw route, and `src/diff/engine.ts`
hands Pierre a `loadDiffFiles` it calls on the press. `Reveal` is in `CONTEXT.md`.

Two things were learned that the plan could not have known. `expandUnchanged` is not the
switch for this: it renders every line of every file from the first paint, and turning it
on took the shots stage from ten seconds to over ten minutes on a seven-file pull request.
The separators between the hunks already offer the expansion and `loadDiffFiles` is what
they call, so the option stays off. And Pierre throws
`deletionLine and additionLine are null` when the halves it is handed do not reconcile with
the patch it parsed — which is why `src/app/revealing.ts` fails rather than sending
`before: null` for a file that had an old half.

Neither was catchable by a unit test, because the tests stub the renderer. Both came out of
`bun run qa`, and the QA mock now builds its halves from each file's own patch so the stage
keeps exercising the real renderer.

Verified end to end in a browser against the stage: pressing a separator's down arrow drew
exactly `expansionLineCount` lines, and Expand all drew the remaining 2,416.

Give the reader the rest of the file to click on. Pierre already has the shape
for it: `processFile` in `@pierre/diffs` takes a patch together with `oldFile`
and `newFile`, and `FileDiff` takes `expandUnchanged`, `expansionLineCount` and
an expansion region per hunk. So the renderer does the drawing once it has the
file. The gateway already has `fileAt` to fetch it.

Failing test first: in `src/domain/library.test.ts`, a test named "asks for the
whole file once and reuses it for the second expansion". It fails because
nothing fetches a blob for a changed file today.

Then a second failing test in `src/ui/files.test.tsx`: a pane whose patch covers
lines 1 to 40, handed a file of two hundred lines, offers a pick on line 150.

Files: `src/ports/Renderer.ts`, `src/diff/engine.ts`, `src/domain/library.ts`,
`src/ui/Files.tsx`, and their tests.

Two risks worth naming before starting. The renderer is built as its own bundle
by `scripts/build-diff-engine.ts`, so the expansion API has to stay behind the
`DiffRequest` seam rather than leak Pierre's types upwards. And a file fetched
per expansion is a request the reader waits for, so the pane needs the same
`PATIENCE` treatment the diff fetch already has.

Estimate: about 2 days.

### Step 4. A remark about a changed file as a whole

**Built, 2026-09-02.** `ThreadAnchor` and `NewComment` nest their lines under the path now,
and null there is a File Remark. The gateway sends a subject type instead of a line, the pane
draws such a thread above the file, and a reader can write one from the same place.

The plan said the reading half needed nothing. It did. `spotAt` dropped a `FILE` marker and
the path beside it went too, so a File Remark reached the conversation naming no file at all.

Two things worth keeping. `lines` was written optional first, the way `LookingAt` has it, and
that quietly accepted every anchor still written the old flat way: each one satisfied the new
type and read as a File Remark, so every thread in the shots stage drew as one. Nothing in
4,374 tests caught it and the type checker was happy; `bun run qa` caught it in a picture. It
is required-and-nullable now, and the same change found eight other sites that would have been
wrong. And `Note` had a Save draft button that a File Remark cannot honour, because a draft
hangs on the lines it is about — it is hidden rather than left to discard quietly.

Failing test first: in `src/github/GitHubGateway.test.ts`, a test named "says
something about the file rather than about a line" sends a comment with no line
and expects a body carrying the path, both commits, and the subject type step 2
recorded, with no `line` and no `side`. It fails because `comment` always writes
a line.

The reading half needs nothing: `spotAt` already drops a `FILE` marker and the
Conversation column already draws an anchorless thread.

Files: `src/domain/PullRequest.ts`, `src/ports/GitHubGateway.ts`,
`src/github/GitHubGateway.ts`, `src/ui/FileHeading.tsx`, and the gateway's test
file.

Estimate: about 4 hours.

### Step 5. Reach an untouched file, and say something about it

Independent of steps 3 and 4. It needs step 2's third answer only to be sure the
interface is not offering something GitHub refuses.

Two halves. Reaching the file reuses everything: `treePaths` for the list,
`fileAt` for the content, `wholeFile` for the patch, and the renderer for the
drawing. Saying something about it is a Remark, through `GitHubGateway.remark`,
carrying a permalink of the form
`https://github.com/{owner}/{repo}/blob/{headSha}/{path}#L120`, which every
GitHub page renders as the lines it names.

Failing test first: in a new `src/domain/quoting.test.ts`, a test named "writes
a permalink a reader can follow to the line" turns a file, a head sha and a line
range into the address above. It fails because nothing builds one for a comment
today. `Shell.tsx:339` builds the same shape for a different purpose, so the
function replaces that too.

Then a failing test in `src/ui/fileBrowser.test.tsx`: an untouched file opened
from the tree appears in the walk and draws its content, with the box under it
saying that a remark about this file goes to the conversation rather than to the
file.

Before writing any of it, measure what `fileAt` costs on a large file and record
it in `docs/spec/`. If a blob page runs to a megabyte, the tree-plus-blob route
needs a second look before the rail is opened up to every path in the repository.

Files: `src/domain/quoting.ts` and its test, `src/ui/FileBrowser.tsx`,
`src/ui/Files.tsx`, `src/ui/Shell.tsx`, `src/screens/pullRequest.tsx`.

Estimate: about 1 day, plus half a day for the measurement and the write-up.

## What could not be established here

- Whether the `page_data` route takes a line outside the hunks, and whether that
  depends on GitHub's per-repository rollout. Step 2, question 1.
- The spelling of the subject type on the `page_data` route, against the literal
  `FILE` the spec read from their bundle and the lower-case `file` their REST
  reference documents. Step 2, question 2.
- What GitHub answers when the path is not in the comparison. Their changelog
  says the comment cannot be made. The refusal itself is unrecorded. Step 2,
  question 3.
- What Pierre does with an annotation on a line it did not draw. Step 0's test
  settles it, and the answer decides whether the fix is a filter or a fallback.
- How a comment on an unchanged line moves when the branch moves. Nothing here
  can answer it without a scratch pull request, a comment, a push, and a re-read.
- What `fileAt` costs in bytes. Step 5 measures it.
