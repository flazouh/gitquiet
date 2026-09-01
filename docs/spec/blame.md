# Spec: Blame

Status: built. The vocabulary below is in `CONTEXT.md`. Re-blaming and very large files are
still open, per Open Questions.

Covers one address: `/{owner}/{repo}/blame/{branch}/{path}`. Correction to the survey that
led here: `docs/uncovered-pages-pain-points.md` named "the file view, `/blob`, `/tree` and
`/blame`" as one uncovered surface. Reading `src/domain/repoHome.ts` and
`src/screens/repoHome.tsx` found that two of those three are already built — `REPO_HOME`
owns `/tree/...` and `/blob/...` today, and a file opened there is drawn by the same diff
renderer a pull request uses, which is the fix the research's own complaints (slow scrolling,
hijacked Ctrl+F, broken text selection) were asking for. Blame alone has no place, no reader,
and no screen. This spec covers blame only.

The worked example is
[oven-sh/bun's README](https://github.com/oven-sh/bun/blame/main/README.md), read live on
2026-09-01: 157 ranges over 30 commits. A second file,
[microsoft/vscode's textModel.ts](https://github.com/microsoft/vscode/blob/main/src/vs/editor/common/model/textModel.ts),
2,745 lines, was read the same day to measure what the code view's virtualization does to a
file blame is asked about most: a large one.

## Problem Statement

Blame answers one question: who wrote this line, and when. GitHub's own page answers it by
drawing a virtualized code view — the same renderer as `/blob` — with a coloured strip and a
commit summary glued to every unbroken run of lines one commit touched. The renderer is the
same one the file-view complaints in `docs/uncovered-pages-pain-points.md` are about, and
blame inherits every one of them on top of its own.

### The renderer does not put the file in the document

Read live on `microsoft/vscode/blob/main/.../textModel.ts`, 2,745 lines: the embedded JSON
payload carries all 2,745 lines as `rawLines`, and the live DOM has **zero** matches for the
last line's own text in `document.body.innerText`. The file is fully shipped and not fully
drawn — GitHub's own virtualization keeps only the rows near the viewport in the DOM, so the
browser's native find (`Ctrl+F`) fails on anything scrolled out of view. This is
[discussion 40949034 on Hacker News](https://news.ycombinator.com/item?id=40949034), 129
points, "GitHub is starting to feel like legacy software": the blame page in particular
"renders lazily, so browser find fails." Blame's own strip adds a second failure on top:
the commit summary rows interleave with code rows, so a browser find that does land on a
visible line lands beside prose that is not code and not blame, either.

### The commit story repeats itself once per contiguous range, not once per commit

Read on `oven-sh/bun/blame/main/README.md`: 157 ranges, 30 distinct commits. A commit that
touched three separated groups of lines — the common case for a file edited more than once —
tells its whole story three times: the same author, the same date, the same message, three
times down the page. GitHub's own page draws each range as its own strip with its own avatar
and its own "Add Bun logo" caption, so a reader scanning for "who touched this most" reads the
same five words repeated as many times as the commit happened to land in separate places.

### `ignoreRevs` is read and not offered

The blame payload carries a flag, `ignoreRevs.present`, read live and `true` on repositories
that keep a `.git-blame-ignore-revs` file — the file `git blame --ignore-revs-file` reads to
skip a mechanical reformat and blame through to the change underneath it. GitHub's page reads
the same flag and, as of this survey, does nothing with it: there is no control on the page to
turn the file on, and the request that it exist is
[discussion 5033](https://github.com/orgs/community/discussions/5033), 588 upvotes, the single
most upvoted complaint about this page recorded in the earlier survey.

### Non-consecutive line selection cannot be done at all

[Discussion 5022](https://github.com/orgs/community/discussions/5022), 477 upvotes, "select
non-consecutive lines" for the purpose of copying more than one range's numbers at once, or
linking to a scattered set. GitHub's own page permits a single contiguous drag and nothing
else — proved live: no keyboard modifier or second click adds to a selection already made.

## Language

`CONTEXT.md` has words for a Version, a Change and a Build, none of which apply here. These
are proposed, and go in that file before the first line of code, per its Language section.

**Blamed Line**: one line of a file, carrying the commit that last touched it. The unit this
screen draws one row per, in place of GitHub's Range.
_Avoid_: blame entry, line attribution

**Span**: every consecutive Blamed Line naming the same commit, drawn as one strip with the
commit told once at its top rather than once per line. GitHub calls this a chunk in its own
payload field names and nowhere in its own words; a repository's `.git-blame-ignore-revs` file,
where present, changes which commit a Span names without changing where the Span itself
breaks.
_Avoid_: chunk, range, group

**Repeat**: a Span whose commit already told its story higher up the same page. Drawn thin,
without the avatar and the message repeated a second time, the way a Bare Version on the
releases screen is drawn thin rather than as a card with nothing on it.
_Avoid_: duplicate commit, same commit again

**Ignore File**: the repository's `.git-blame-ignore-revs`, kept verbatim as the name of the
convention `git blame --ignore-revs-file` and GitHub's own payload both use. Its presence is
`ignoreRevs.present` in the payload this screen already reads.
_Avoid_: ignore revs, blame ignore file

## Solution

Three principles.

1. **A Span tells its commit once.** The commit and its message are the answer to the question
   blame exists to ask, and repeating them at every Span is what turns 30 commits into 157
   near-identical strips. A Span is drawn full — avatar, message, date — the first time its
   commit appears on the page, and as a thin **Repeat** every time after.
2. **The whole file is in the document.** The renderer this extension already ships for every
   other page draws every line into the DOM at once — see `docs/spec/releases.md`'s neighbour
   complaints and `src/ui/ReadingPane.tsx`'s `Source` component, which already does this for
   `/blob`. Blame reuses it: the file's lines are already in the payload blame reads, so the
   same renderer draws them, with the Span's author in the gutter rather than in a floating
   strip.
3. **The Ignore File is named, not silently obeyed or silently ignored.** GitHub's `commitOid`
   per range already reflects the ignore file when one is present — the range names the commit
   *behind* the mechanical one. This screen says so in one line at the top of the page rather
   than leaving the reader to wonder why the newest commit never appears as an author.

### The screen

**One row per Blamed Line, banded into Spans.** A Span heading carries the author's face, their
name, "committed the message" and a relative date, drawn once. Every line under it is a
Blamed Line: a line number, the line's own text through the diff renderer's line drawing (so
syntax highlighting, wrapping and font size all match the reader's own settings), and nothing
else — the commit is above, not beside every line.

**A Repeat is a rule, not a card.** Where a commit's Span has already been drawn higher on the
page, the second Span for that commit is a single thin divider naming the commit in one line —
"same as above: Add Bun logo" — with its lines listed under it exactly as any Span's are. The
157-range, 30-commit worked example collapses its repeated commits into thin dividers the same
way a Bare Version collapses into a marker on the releases screen.

**The Ignore File is one line, when present.** "Blame follows `.git-blame-ignore-revs`" at the
top of the page, linked to the file, only drawn when `ignoreRevs.present` is true. Nothing
drawn when it is absent, which is the ordinary case.

**Selection matches the file view's, because it is the same renderer.** The diff renderer this
extension already ships supports a drag selection and permalinking a range; blame gains
whatever the renderer already does for line selection at no extra work, and gains nothing
beyond it. Non-consecutive selection, `discussions/5022`, is out of scope here for the same
reason it would be out of scope on `/blob`: it is a renderer capability, not a blame one, and
belongs to a change in `src/diff/engine.ts` that would apply to every screen at once rather
than to this one.

### What the screen does not do

Re-blaming — clicking a line to blame the commit *before* the one shown, GitHub's own
"View blame prior to this change" — is not covered. It is a real GitHub feature
(`reblamePath` on every range in the payload already points at it) and a real navigation, to
a different blame of a different commit, which this screen can link to as an ordinary address
rather than draw inline.

## Implementation Decisions

### The place

Read live on `oven-sh/bun/blame/main/README.md`, 2026-09-01: the page carries
`react-app[app-name="code-view"]`, `#repo-content-pjax-container`,
`turbo-frame#repo-content-turbo-frame`, and one `script[data-target="react-app.embeddedData"]`
— the same three hooks `REPO_HOME` already keys on, because blame is one more page of the
same code view application. So `BLAME` is a sibling of `REPO_HOME` rather than a rewrite of the
takeover machinery: same `regions`, same `fallback`, same `stages`, same
`soft: { within: 'react-app[app-name="code-view"]' }`.

It is not a redraw of `REPO_HOME`, unlike `/blob` and `/tree`. Blame answers a different
question with a different shape of data — a per-line commit column that a file's own reading
pane has no room for beside the tree — so it is a fourth top-level `Wanted` screen,
`"blame"`, with its own `BLAME` place, ownership decided by a new address parser rather than
by widening `repoHomeIn`.

### Address parsing

`src/domain/blame.ts`, a sibling of `repoHome.ts` rather than a case inside it:

```ts
export type BlameAt = {
  readonly repo: { readonly owner: string; readonly repo: string }
  readonly branch: string
  readonly path: string
}

export const blameIn = (url: string): Option.Option<BlameAt> => { ... }
```

Same host gate, same `NOT_AN_OWNER` refusal, same per-segment `decodeURIComponent` as
`repoHomeIn`, matching `kind === "blame"` where that function matches `"tree" | "blob"`. A
branchless or pathless blame address — `/owner/repo/blame` or `/owner/repo/blame/main` with
nothing after it — is refused, because GitHub itself serves neither.

### Data access

One HTML fetch, same as `fileAt`. `readRepoPage(reference, `/blame/${branch}/${path}`)` reads
the document, and a new decoder over `codeViewBlameRoute.blame` in the embedded payload reads:

| Want | Source |
| --- | --- |
| Every range: which lines, which commit | `blame.ranges`, keyed by starting line |
| Every commit named: author, avatar, message, date | `blame.commits`, keyed by SHA |
| Whether an Ignore File is in play | `blame.ignoreRevs.present` |
| The file's own lines, for the renderer | `codeViewBlobLayoutRoute.StyledBlob.rawLines`, the same field `openedFrom` in `src/github/file.ts` already reads for `/blob` |

One request answers the whole page: the lines and the blame both live in the one document, the
same way `openedFrom` already finds lines and rendering in one document for a file. A new port
method, `blameAt(reference, branch, path): Effect<Blame, GatewayError>`, joins `fileAt` and
`rawFileAt` in `src/ports/GitHubGateway.ts`, implemented against the same `readRepoPage` call,
and both `GitHubGateway.ts` recording stubs (line 4249 and line 4396) need the new method added
alongside `fileAt`/`rawFileAt` or the file stops compiling.

### Spans from ranges

`spansOf(ranges, commits): ReadonlyArray<Span>` in `src/domain/blame.ts`, a pure fold: walk
`ranges` in line order, start a new Span when the `commitOid` changes from the previous range,
and mark a Span `repeat: true` when its commit's OID has been the head of an earlier Span on
the same page. The fold is the whole of the domain logic; nothing else here needs a request.

## Open questions

- **Very large files.** `microsoft/vscode`'s `textModel.ts` at 2,745 lines is what this spec
  measured; nothing here was measured against a file whose blame document is itself
  megabytes. `Front`'s cousin, `Opened`, already draws a whole file this size through the same
  renderer for `/blob`, so the expectation is that blame costs the same, but it is not
  confirmed on a file an order of magnitude larger.
- **Re-blaming's address.** `reblamePath` on a range is a path segment blame reads and this
  spec declines to draw inline; whether it is worth becoming a link on a Span, into a second
  blame address at an earlier commit, is undecided.
- **Binary and generated files.** GitHub's blame refuses some files outright — a generated
  lockfile, for one — with its own message. Whether that refusal is read from the payload and
  shown in this screen's own words, or the read is simply allowed to fail and the reader is
  handed back to GitHub's page, is undecided.

## Evidence

Read live on 2026-09-01, `oven-sh/bun/blame/main/README.md` and
`microsoft/vscode/blob/main/src/vs/editor/common/model/textModel.ts`, via the embedded
`react-app.embeddedData` payload each page ships.

| Fact | Value |
| --- | --- |
| Ranges in the worked example | 157 |
| Distinct commits across those ranges | 30 |
| Lines shipped in the payload for `textModel.ts` | 2,745 |
| Matches for the file's last non-trivial line in the live DOM's `innerText` | 0 |
| `ignoreRevs.present` on the worked example | `true` |
| `--ignore-revs-file` request | [discussion 5033](https://github.com/orgs/community/discussions/5033), 588 upvotes |
| Non-consecutive line selection request | [discussion 5022](https://github.com/orgs/community/discussions/5022), 477 upvotes |
| The renderer's lazy draw breaks browser find | [Hacker News 40949034](https://news.ycombinator.com/item?id=40949034), 129 points |

## Further Notes

**This is the narrower of the two pages the survey named.** `docs/uncovered-pages-pain-points.md`
named "the file view" as the single largest uncovered surface, by all four sources. Reading the
code before writing this spec found two of its three addresses — `/tree` and `/blob` — already
built, drawn by the same renderer the pull request diff uses, which independently answers the
loudest complaint in that survey: slow scrolling and broken browser find. What was left uncovered
is smaller than the survey estimated, and this spec is scoped to exactly that: blame, and only
blame.

**Comment-anywhere still wants a permalink to land somewhere.** `docs/plan/comment-anywhere.md`
records `/blob` as where a Remark's permalink needs to point, and that page already exists. This
spec does not touch that plan; it is noted here only because it is the reason the original survey
raised the file view's priority as high as it did, and the reason for it turns out to already be
answered.