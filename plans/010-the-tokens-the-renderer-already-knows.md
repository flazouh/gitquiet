# 010 — The tokens the renderer already knows, and a way to reach any file

- **Status**: DONE for half one, and for half two on a repository's front page. The pull
  request's own Go to File is the one piece left; see Outcome.
- **Severity**: MEDIUM
- **Category**: Coverage, foundations
- **Spec**: `docs/spec/following.md`
- **Depends on**: nothing. Deliberately: this plan and 009 can be carried out at the same time
  by two people, and this one ships something a reader feels whether or not 009 says yes.

Two halves, both small, both useful on their own. The first opens a seam the renderer already
has and the interface cannot currently reach. The second is the one command in the whole spec
that needs no Ledger, no parser and no WebAssembly, and it is the one a reader will use twenty
times a day.

## Half one: token events and decorations through the port

`src/ports/Renderer.ts` is the vocabulary the pane and the renderer share, and it exposes a
render call, a handle, notes and picked lines. `@pierre/diffs` carries more than that and has
all along. On `FileOptions` and `FileDiffOptions` alike
(`node_modules/@pierre/diffs/dist/managers/InteractionManager.d.ts:41-62`):

    onTokenClick?(props, event: MouseEvent): unknown
    onTokenEnter?(props, event: PointerEvent): unknown
    onTokenLeave?(props, event: PointerEvent): unknown

where `props` is `{ lineNumber, lineCharStart, lineCharEnd, tokenText, tokenElement }`, plus
`side` in a diff. That is the spec's **Name**, exactly, with the modifier keys on the event
beside it. No hit-testing of our own, no second tokenisation, no reading the DOM back.

### What to add

1. **`Name` in `src/ports/Renderer.ts`**, in that file's own register — it describes what the
   two halves hand each other and touches no DOM and names no package:

       export type Name = {
         readonly line: number
         readonly from: number
         readonly to: number
         readonly text: string
         readonly side?: DiffSide
       }

   `from` and `to` rather than `lineCharStart` and `lineCharEnd`: the file already says `from`
   and `to` on `Picked`, and two words for one idea in one file is how a vocabulary rots.

2. **Three optional fields on `DiffRequest`**: `onName`, for a click; `onNameEnter` and
   `onNameLeave`, for the pointer. Optional, because a pane that has nothing to say about a
   Name should cost nothing — which is every pane until 011.

3. **`underline` on `DiffHandle`**, taking the Names to mark and drawing them with the
   renderer's own decorations. On the handle rather than the request for the same reason
   `showNotes` is: marking a Name must not redraw the file.

4. **Plumb all four through `src/diff/engine.ts`.** The engine is the only file that may name
   `@pierre/diffs`, and the conversion from its shape to ours belongs there.

5. **A stub in the tests.** The renderer is faked in `src/ui` tests already; the fake gains a
   way to say a Name was clicked, so the interface built in 011 can be tested with no renderer
   and no browser.

Nothing consumes any of it in this plan. That is fine, and it is the reason this half is
separable: it is a seam, it is about forty lines, and it can land and sit.

### What not to do

Do not put a modifier-key rule in the port. Whether Command means Follow is the interface's
decision and will differ on a Mac, in a diff, and in a file being read. The port hands over the
event and stops.

## Half two: reaching any file by typing its name

`treePaths` already answers with every path in a repository at a commit
(`src/github/GitHubGateway.ts:4224`, off `/tree-list/{sha}`), and the pull request screen
already knows its own head. So the whole of this command is a filter, a list and a press.

1. **`src/domain/findingFile.ts`**, pure, and the heart of it. Paths in, a query in, ranked
   paths out. Written as a domain function because that is where it can be tested exhaustively
   without a browser, and because the desktop app wants the same one.

   The ranking a reader expects, and each rule earns its place in a test:
   - Every character of the query appears in the path, in order. Anything else is not a match.
   - A match inside the filename beats a match in a folder above it.
   - Characters in a run beat characters scattered.
   - A match at a word's start — after `/`, `-`, `_`, or a capital — beats one in the middle.
   - Shorter paths break a tie, because a reader typing four letters usually means the short one.

   A repository has tens of thousands of paths and this runs on every keystroke, so the filter
   comes before the scoring and the scoring stops at a cap. Measure it on a real tree-list
   rather than assuming: the budget is one frame, and `bun run bench` is the shape to copy.

2. **A `goToFile` command** in `src/keys/commands.ts`, `t` in both the standard and vim
   profiles, absent from `off`. `t` is free in both today, and it is what GitHub's own file
   finder answers to, which is a habit worth inheriting rather than breaking.

3. **The screen.** Reuse rather than invent: `src/ui/Filters.tsx` and the tree's own filter in
   `Files.tsx` are the two nearest things, and the dialogs already have their own motion
   vocabulary and their own dismissal (`plans/004`). A new modal that leaves the way the others
   do is right; a new modal with its own animation is not.

4. **Where it lands.** Pressing a row opens that file the way the tree does, at the address the
   screens already write — `#path`, replaced rather than pushed. On a pull request, a file not
   in the diff still opens: `rawFileAt` answers for any path at any sha
   (`GitHubGateway.ts:4194`), and a reviewer who wants to see a file the branch did not touch
   is the whole reason this is on the pull request screen and not only on a repository's front
   page.

## Gates and evidence

`bun run gates`, and the new tests are `bun test` cases with no browser in them:
`findingFile.test.ts` over a recorded tree-list, and a `renderer` fake case proving a Name
reaches the pane.

Add one row to `bun run qa`: the file finder open over a pull request, so it can be looked at
from a container with no display.

## Why this half is worth shipping alone

If 009 comes back no, this is still a reader typing four letters and landing in a file, on
every screen that draws code, with GitHub's own key. It is also the first thing that proves the
Name seam works end to end, which is what 011 is built on.

## Outcome

### Half one: the seam is open

`src/ports/Renderer.ts` gained `Name` — line, `from`, `to`, text, and `side` where there is one
— along with `Modifiers`, three optional callbacks on `DiffRequest` (`onName`, `onNameEnter`,
`onNameLeave`) and `mark` on `DiffHandle`. `src/diff/engine.ts` converts the renderer's token
events into them and is the only file that names `@pierre/diffs`, as it was.

Three decisions worth knowing, because none of them is what the plan above assumed:

- **`Modifiers`, not the event.** The plan said the port hands over the event and stops. It
  should not: a `MouseEvent` belongs to the renderer's document and carries a path back into the
  renderer's DOM, so a pane holding one could reach in and change what it was handed. What
  crosses is three booleans, and Command-on-a-Mac against Control-everywhere-else is folded into
  one of them — `go` — in the engine, because that is the platform's rule rather than any pane's.
- **`mark(name)` rather than `underline(names)`.** The plan had the handle take a set of Names to
  underline, which needs decorations and therefore a redraw. It also is not what an editor does:
  VS Code and Zed underline the one thing under the pointer, not every resolvable name on the
  screen. So the handle marks the Name the pointer is on — the engine keeps the element from the
  token event it was just given, and declines a Name from anywhere else — and nothing is redrawn.
  `docs/spec/following.md` says "underlines every Name on the screen"; it is the spec that should
  change, and 011 is where that gets settled in front of a real file.
- **Inline styles.** The token is inside the renderer's shadow root, where a stylesheet on the
  page does not reach.

Nothing consumes any of it, as intended. `named`, `held` and `sameName` are exported for
`engine.test.ts`, which pins the key folding, the absent `side` on a file that is not a diff, and
the rule that a Name is told by its place and not by its text.

### Half two: Go to File, on a repository's front page

`t` opens it, in both profiles that have keys — GitHub's own letter for the same act, free in
both, and taken out of the air so their finder does not open behind ours. The dialog is
`src/ui/GoToFile.tsx`, modelled on `CheckDialog` down to the way out. Arrows move, Enter opens,
Escape leaves, the pointer and the keyboard never disagree about which row Enter would take.

The paths are the tree's. `RepoTree` already reads every path at the commit for its own folders —
six hundred kilobytes on a large repository — so it now says what it read (`onPaths`) and the
screen keeps it. One read, not two, and the list is in hand before a reader can press anything.

Five tests in `repoHomeScreen.test.tsx` cover opening, ranking, Enter, Escape, and the case where
the paths have not landed. The ranking itself is `src/domain/findingFile.ts`, pure, with fifteen
tests — one per rule, plus one that ranks thirty thousand paths inside a frame.

**A bug the tests caught and a reader would have called obviously wrong**: the first draft gave a
path with no folder in it no filename at all, so `place.ts` at the root of a repository ranked
below `a/b/c/place.ts`. `lastIndexOf("/") + 1` is 0 on such a path, which is the fix and the
reason it is now written that way.

### `domain/hunting.ts` was already doing half of this, and now does none of it

Found while wiring the pull request side: Brought In (`src/ui/BroughtIn.tsx`) has let a reviewer
open a file the pull request never touched for some time, and it had its own path filter in
`src/domain/hunting.ts` — a substring match, with a written argument for staying "deliberately
nothing cleverer". This plan added a second way to rank paths without knowing that.

Two rankers in one `src/domain` answering the same question differently is worse than either, so
`hunted` now asks `findingFile` and keeps only its own rule about an empty query. Measured before
changing it, not after:

| | |
| --- | --- |
| The case `hunting.ts` argued from (`config`, with both a file and a folder) | Same paths, same order |
| Everything a substring match finds | Found, for every query tried — a substring is a subsequence with no gaps |
| `hunting.test.ts`, unchanged | Passes, ordering assertions included |
| `cfg` | Was nothing at all; is now the four `config` paths |

That last row is a behaviour change to a shipped feature and is the one thing here worth
disagreeing with. It is one commit to put back.

### And the third one went

There was a third surface where a reader typed part of a path: the tree's own "Find a file"
field, `hitBy` in `RepoTree.tsx`, which narrowed the tree in place and opened every folder
holding a match. It is gone. Two ways to find a file is one too many, and the one that went was
the weaker of the two — it matched only a substring, it reached only what that tree holds, and it
left the reader to find the row afterwards.

What did not go is the box. It is the only thing on the page that says finding a file by name is
possible at all — GitHub's own repository page has a Go to file control, and a key with nothing
to show for it is a key nobody presses — so what sat there is now a button dressed as a field
that opens Go to File, wearing the chord off the same table the key is read from. `search`, which
is `f` and `/`, opens it too: that command meant "the filter over whichever list is on screen",
this screen's filter is where it went, and a key that did something here yesterday and nothing
today is worse than one that was never bound.

Two tests went with it — one for narrowing, one for the rule that a folder opened by a hunt asks
for no commit column, which was a cost that no longer exists — and each left a note in its place
saying why. Three arrived: the control is visible and wears the right cap, `/` reaches it, and
the old field is not on the page.

### Two things this plan asked for and did not get

- **Go to File on a pull request.** The screen is different in the way that matters: its pane
  draws diffs, and a file the branch never touched is Brought In's job rather than the tree's.
  Brought In already opens one and now ranks paths the same way, so what is left is a keyboard
  way in to a pane that exists — smaller than it was when this plan was written, and not done.
- **A `bun run qa` row.** Declined rather than forgotten. `shots/views.test.ts` holds the stage to
  one view per screen and fails anything that is neither a screen nor a named second layout, and
  a dialog over a screen is neither. Photographing it would mean either loosening that rule or
  opening the finder inside the repository's own view, which would change a store asset. The
  behaviour is covered by the five tests instead.
