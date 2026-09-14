# Spec: Following

Status: built, and kept. A name follows to where it is written — in its own file by scope, in a
file it was imported from by what that file states — on a repository's front page and in a pull
request's diff, with the card, the Peek, the outline, Uses across the repository, Go to File and
Go to Name. The Ledger is kept between visits under git's own name for each file's contents, so a
repository is read once: `honojs/hono` is 386 files and 3.7 seconds the first time and 190
milliseconds in a new browser, with nothing fetched. Plans 009 to 012 are how it was carried out
and what each got wrong. The vocabulary below is this file's own until something answers
to it; it moves into `CONTEXT.md` when the first Writing is Followed on a real page.

Covers no new address. Every screen that already draws code is in scope —
`/{owner}/{repo}/blob/{branch}/{path}`, `/tree/...`, `/pull/N`, `/commit/SHA` and
`/blame/{branch}/{path}` — and the destination of a Follow is the address format those screens
already carry: `#src/ui/Files.tsx:R42-48`.

## Problem Statement

A reader in a diff cannot ask what a name means. They can read the six lines the hunk gives
them, and for everything else they leave: a second tab, the repository's front page, a path
typed by hand, a scroll to find the function again. That trip is taken several times per
review and it is taken with the review's place lost, which is the cost the pull request screen
was built to stop paying everywhere else.

### The takeover removed what GitHub had

`REPO_HOME` owns `/tree/...` and `/blob/...` (`src/ui/place.ts:510-515`), and what it replaces
is GitHub's `react-app[app-name="code-view"]` — the application that draws their symbol pane
and their find-all-references. A reader who used those on a blob page does not have them on
ours. That is a regression this extension introduced and has not answered, and it is half the
reason this spec exists. The other half is that GitHub never offered any of it in a diff,
which is where it is worth the most.

The blob payload GitHub sends carries the pieces of their own answer, and this codebase
already reads that payload: `fixtures/github/blob-code.json` holds
`payload.codeViewBlobRoute.symbols` (`{ timed_out, not_analyzed, symbols: [] }`) and
`payload.codeViewBlobLayoutRoute.blob.symbolsEnabled: true`. On the fixture's file —
`react/react`'s `package.json` — it is `not_analyzed` and empty. What they answer with on a
source file, and on which languages, is unmeasured here; see Evidence.

### Nothing about a pull request's own commit is answerable from GitHub at all

The definition a reviewer wants is the definition *at the head of the branch under review*,
which may be three commits old on the default branch and may not exist there at all. Any
answer read off GitHub's default-branch navigation is an answer about a different file than
the one on the screen. A Ledger built from the commit the reader is looking at has no such
gap, and this is the one capability in this spec that GitHub cannot be asked for.

## Language

**Name**:
The identifier under the pointer, with the line and the two columns that bound it. What the
renderer hands over on a token event, no more: a run of characters, not yet known to mean
anything.
_Avoid_: token, symbol, identifier.

**Writing**:
The one place a Name is written down — the line that declares the function, the type, the
constant. A Name has at most one Writing on any screen; where the Ledger cannot narrow it to
one, it has none and says so rather than offering a list to choose from.
_Avoid_: definition, declaration, target, jump target.

**Uses**:
Every line that mentions a Name and means the same Writing. Counted per file, because the
question a reader asks is which files depend on this, not how many lines do.
_Avoid_: references, usages, callers, occurrences.

**Follow**:
The move from a Name to its Writing. Replaces the address rather than pushing one, exactly as
opening a file in a review does, so Back is the way out of the page and not a way of undoing a
reading one hop at a time.
_Avoid_: go to definition, jump, navigate, drill in.

**Peek**:
A Writing drawn as a row under the Name that asked for it, without leaving the file. What a
reader wants most of the time, because the question is usually "what does this do" and not
"take me there".
_Avoid_: inline preview, popup, hover definition, quick look.

**Sure**:
A Writing reached by proof: the Name resolved inside its own scope, or through an import this
file states. Nothing else is Sure.
_Avoid_: precise, exact, semantic.

**Types**:
A Writing reached by a compiler rather than by a reading of shapes, which is the only way to
reach one through a method call. Shown in the card as its own word rather than folded into Sure,
because it is a different kind of answer and a reader deciding whether to trust a rename needs to
know which they have. The underline says it too: solid for a compiler, dotted for the shapes.
_Avoid_: exact, precise, semantic, LSP.

**Likely**:
A Writing reached by matching a name and a kind and nothing more. Offered, marked, and never
dressed as Sure. A reader who is told which of the two they have can decide whether to trust
it; a reader who is not will stop trusting either.
_Avoid_: search-based, fuzzy, heuristic, best guess.

**Ledger**:
What a repository's files say, kept a file at a time under that file's blob sha rather than under
a commit. Two branches of one repository share every file they have not changed, and a new commit
costs only the files it touched. Kept between visits, so a repository is read once rather than
once a visit.
_Avoid_: index, database, symbol table, cache.

**Beyond**:
A Name borrowed from a package rather than from a path. `@yourorg/thing` is not a path and
resolves against a folder no archive carries; where it resolves is a repository, guessed from the
specifier and checked against that repository's own `package.json` before anything is followed
into it. Answered as an address rather than as a Writing, because the file is in another
repository and this extension already draws those. Always Likely: the repository is proved and
which Writing inside it is a name match.
_Avoid_: cross-repo, external, dependency.

**Warm**:
A Ledger already built for the commit on the screen. A cold Ledger is not an error and not a
spinner: Following is drawn only once it can be answered, and until then the code reads
exactly as it does today.
_Avoid_: ready, loaded, hydrated, indexed.

## Solution

Holding Command — Control off a Mac — underlines the Name under the pointer where it has a
Writing. A click with Shift Peeks. A click on its own does one of two things, and which one is
decided by where the press landed:

| Pressed on | Answers |
| --- | --- |
| A use of a name | Goes to where it is written — a scroll in this file, the pane redrawn for another |
| The Writing itself | Opens who depends on it: its Uses in this file, then everywhere in the repository |

Which is the same rule every editor that offers both settles on, and it needs no explaining
because it is the only rule that could be meant. Pressing a call, there is somewhere to go.
Pressing the thing itself, there is nowhere — the reader is already looking at it — and the only
question left is the one they actually have.

`u` asks the second question wherever the pointer is, which is how a reader asks who depends on a
name they are looking at a *use* of, and the only way to ask it about a name written in a file
this one merely imported from.

The two sides count columns differently and `isTheWriting` in `src/ui/following.ts` is the one
place it matters: a renderer's token starts from nothing and a Writing's column is written for a
reader. Compared without the adjustment, no press is ever on a Writing and half of this table
quietly never happens.

The Name under the pointer, and not every Name on the screen, which is what this said before
either was built. Three reasons, in the order they were found: it is what an editor does, so it
is what a hand already expects; every Name on the screen is a question per identifier per file
opened, where this is one question per name a reader actually asks about; and marking a set of
them needs the renderer to draw again, where marking the one it just reported entering does not.
See `plans/010-the-tokens-the-renderer-already-knows.md`.

Hovering an underlined Name opens a card with four things and nothing else: the Writing's own
line, the comment written above it where there is one, `path:line`, and whether it is Sure or
Likely. The card is the same hover card the interface already uses for a person
(`@radix-ui/react-hover-card`, already a dependency).

Uses open on `u`, about the name the pointer is on. This file's first, with the line each one is
written on so a call can be told from a declaration without going to look — and those are exact,
because this file is parsed. Then the repository's, from the Ledger, each marked Sure or Likely:
a file that states it borrowed this name from this file is Sure, a file that merely holds the same
word is Likely, and a file that binds its own name of that spelling is not listed at all.

Three ways in from the keyboard, in every profile that has keys at all:

| Command | Standard | Vim | Does |
| --- | --- | --- | --- |
| `goToFile` | `t` | `t` | Any path in the repository, typed. Needs no Ledger. |
| `goToName` | `T` | `T` | Any Writing in the repository, typed. Reads the repository once. |
| `fileNames` | `o` | `o` | The Writings in this file, in the order they are written. |
| `uses` | `u` | `u` | The same panel a press opens, for a reader whose hand is on the keyboard. |

The `off` profile gets none of them, which is what `off` means (`src/keys/commands.ts:174-184`).
Every key is changeable under Settings, Keyboard, like the rest.

### What this does not do

- **No editing, no renaming, no refactoring.** Every write in this extension goes through a
  route GitHub documents, and there is no route for this. Reading is the whole of it.
- **No type inference.** A Name whose meaning depends on a value's type at a call site is a
  question a type checker answers, and there is no type checker here. Those Names get a Likely
  Writing or none.
- **No following into a dependency's published code.** A package whose repository cannot be
  guessed and checked is one this cannot reach — and reaching it would mean asking a registry,
  which means telling somebody else what a private repository depends on.
- **No Ledger for a repository passed through.** Opening one file on a stranger's repository
  builds nothing. The Ledger starts when a reader opens a second file, or any pull request, in
  the same repository.

## Implementation Decisions

### The parsing cannot happen where the interface is

`src/diff/shiki.ts` records the finding this rests on: GitHub serves
`script-src github.githubassets.com`, a content script's isolated world is held to the page's
policy for WebAssembly, and every compile is refused silently. `wasm-unsafe-eval` in our own
manifest does not change it, because the policy that applies is theirs. Tree-sitter is
WebAssembly. So the parser cannot live in the content script, and the same file says where it
can: a context whose origin is the extension's own.

This extension already runs one. `src/entrypoints/background.ts:41` opens an offscreen
document for Mermaid, under `reasons: ["DOM_PARSER"]`. Following does **not** open a second:
plan 009 measured that Chrome permits one offscreen document per extension and refuses the
next with "Only a single offscreen document may be created." So the one document is shared —
Mermaid's reasons and `"WORKERS"` together — and inside it a pool of dedicated workers, one per
core less one. The document is what keeps the work alive: the service worker is shut down while
idle and a Ledger build outlives that, which is the same reason `onTheWay.ts` keeps what it
fetched in the worker for only half a minute.

This requires `content_security_policy.extension_pages` in `wxt.config.ts` carrying
`'wasm-unsafe-eval'`, which the manifest did not set before plan 009 and does now. Without it
Chrome refuses WebAssembly on extension pages as well, and the whole plan fails on the first
grammar.

Measured, on a live github.com page, Chrome 153, 2026-09-13: the content script is refused
both a valid empty module and a 1.41MB grammar; the offscreen document and a worker started
from it compile both, load the grammar in 9–18ms and parse 54,400 bytes of TypeScript into
3,152 nodes in 4–6ms. Plan 009 carries the run and the reproduction.

Firefox has no offscreen API — `wxt.config.ts:134` already gates the permission to Chrome and
Edge. There the pool is started from the event page, which is an extension-origin document
with the same policy. Whether that holds is the second half of 009.

### Nothing new enters the content script

A content script is one file with every dynamic import inlined, which is what made Shiki cost
10.6MB before `src/diff/shiki.ts` cut it back to 481kB. The grammars are worse: one `.wasm`
per language. So the code-intelligence chunk is built beside the extension exactly as the
renderer is — `scripts/build-diff-engine.ts` into `public/`, published in
`web_accessible_resources` (`wxt.config.ts:146`) — and the grammars are published as files the
worker fetches by name. A reader who never holds Command downloads none of it.

### The Ledger is keyed by blob sha

A commit is the wrong key. Two branches of a repository differ in a handful of files and would
otherwise be indexed twice; a force-push would throw away everything it did not change. Git
already names a file's contents, so the Ledger stores a Writing list per blob sha and a
commit is a list of (path, blob sha) pairs pointing into it. Re-opening a pull request after a
push re-parses what the push touched.

Getting the blob shas costs nothing extra: `/tree-list/{sha}` is already read
(`GitHubGateway.ts:4224`) and `git ls-tree` semantics are what it answers with.

### The files arrive as one archive, not as a thousand reads

`rawFileAt` (`GitHubGateway.ts:4194`) is a file at a time and is right for the one file a
reader opened. A Ledger wants the repository, and `https://github.com/{owner}/{repo}/archive/{sha}.tar.gz`
is one request for all of it — the address GitHub's own download button uses, which redirects
to `codeload` with a signed token, so a private repository works on the session the extension
already has. `host_permissions` already covers `*://github.com/*`. Decompression is
`DecompressionStream("gzip")`, which is native and is not WebAssembly, so it can happen in the
service worker before the workers are even awake.

There must be a ceiling, and a repository over it gets a Ledger of the files a reader actually
opens instead of a refusal.

### Three tiers of certainty, and the reader is told which they have

1. **Inside one file**, scopes: a parameter, a local, a shadowed name. Sure, cheap, and it is
   most of what a reader asks about.
2. **Across files**, what each file states: its imports, its exports, the module specifiers it
   names. A Name that resolves through a stated import is Sure.
3. **Everything else**, name and kind. Likely.

A fourth tier — running the TypeScript compiler over the repository in a worker — is real and
is not this. It is seconds of work and a great deal of memory for an answer the three tiers
above already give for most Names, and it would be a setting a reader turns on, not a default.

### Following is a port

`src/ports/Ledger.ts` sits beside `Renderer.ts` and answers three questions: the Writing for a
Name, the Uses of a Writing, the Writings in a file. What is behind it is decided at the edge,
which is the rule the linter already enforces. The extension's implementation is the offscreen
pool. The desktop app imports `src/domain`, `src/app`, `src/ports` and `src/ui` and draws them
in its own window, and it is a process on a machine with a filesystem: it can satisfy the same
port with a language server and give Sure answers for every Name. The screens cannot tell the
difference, which is the point of the port.

### The renderer already knows where every token is

`@pierre/diffs` carries `onTokenClick`, `onTokenEnter` and `onTokenLeave` on both `FileOptions`
and `FileDiffOptions` (`managers/InteractionManager.d.ts:41-62`), handing over
`{ lineNumber, lineCharStart, lineCharEnd, tokenText, tokenElement, side }` and the mouse
event that carries `metaKey`. That is a Name, exactly, with no hit-testing of our own and no
second tokenisation. `src/ports/Renderer.ts` does not expose them today and gains them, along
with the decoration that draws the underline — `DecorationItem` and `LineDecoration` are in
the same bundle — and the annotation row Peek is drawn in, which is the mechanism a review
thread is already drawn in.

### The budget

- Nothing added to first paint. The file renders as it does today and the underline attaches
  when the Ledger can answer.
- A Follow that is already in memory: within one frame.
- A Follow that has to read storage: under a tenth of a second.
- A Ledger warmed before the reader needs it, started from `onTheWay` — the worker is told a
  tab is moving 1.2 to 3.6 seconds before the page exists (`src/app/onTheWay.ts`), and that is
  the same head start the pull request payloads already take.

These are targets, not measurements. `scripts/benchmark-ledger.ts` is what turns them into
measurements, beside the benchmark that already exists for a pull request.

## Testing Decisions

The resolver is a pure function — file text in, Writings and Uses out — so nearly all of it is
`bun test` with no browser, no GitHub, and no network, which is how the rest of `src/domain`
is tested. A small fixture repository under `fixtures/code/` holds the answers: a name shadowed
in an inner scope, a name re-exported through a barrel file, a name that exists twice in two
files, a name imported under an alias. Each is a case the tiers above must get right or must
mark Likely, and the test asserts which of the two came back, not only where it pointed.

`bun run qa` photographs the hover card and the Uses pane on the shots stage with recorded
payloads, so both can be looked at from a container with no display.

The one question no test here can answer is whether a grammar compiles on a real GitHub page.
That is a live check, it is plan 009, and it comes first.

## Open questions

- **Firefox.** No offscreen document. Whether the event page can hold a worker pool for the
  length of a build, and what happens when Firefox suspends it mid-build.
- **The ceiling.** What size of repository is worth indexing whole, measured rather than
  guessed, and what the reader is told about one over it.
- **Whether Likely is worth offering.** A Writing marked Likely and wrong is worse than no
  Writing at all if readers do not read the mark. This is a thing to watch after it ships, and
  the answer may be to withhold Likely outside the file the reader is in.
- **Generated files.** A lockfile, a minified bundle, a vendored tree. Parsing them is waste
  and Following into them is noise. Whether the skip list is ours, `.gitattributes`'
  `linguist-generated`, or both.
- **A Name in a dependency.** Following into `node_modules` is out of scope here, but the
  question a reader asks about an imported name does not respect that scope.

## Evidence

Read out of this repository at commit `4e45c74`. Every row is a file that says so.

| Fact | Where |
| --- | --- |
| Token events with line, columns, text and element | `node_modules/@pierre/diffs/dist/managers/InteractionManager.d.ts:41-62` |
| Decorations and annotation rows in the same renderer | `@pierre/diffs` exports `DecorationItem`, `LineDecoration`, `createDiffSpanDecoration` |
| WebAssembly refused in the content script by GitHub's policy | `src/diff/shiki.ts`, the `createOnigurumaEngine` note |
| An offscreen document already runs, for Mermaid | `src/entrypoints/background.ts:23-45` |
| A separately-built chunk is already fetched on demand | `scripts/build-diff-engine.ts`, `wxt.config.ts:146` |
| `/blob` and `/tree` are ours, and GitHub's code view app is what we replace | `src/ui/place.ts:510-515` |
| Every path at a commit, already read | `src/github/GitHubGateway.ts:4224` |
| One file's text, already read | `src/github/GitHubGateway.ts:4194` |
| GitHub's own symbols ride in the blob payload | `fixtures/github/blob-code.json`, `payload.codeViewBlobRoute.symbols` |
| A head start of 1.2 to 3.6 seconds before the page exists | `src/app/onTheWay.ts` |
| `unlimitedStorage` already held | `wxt.config.ts:130-135` |
| A grammar compiles and parses at our own origin, and is refused in the content script | `plans/009-can-a-grammar-compile-at-all.md`, Answer |
| One offscreen document per extension, and Mermaid has it | same, measured |
| Grammars must carry `dylink.0`, which `@vscode/tree-sitter-wasm` does and `tree-sitter-wasms` does not | same, measured |

Not measured, and to be measured before the plans that depend on them:

| Question | Plan |
| --- | --- |
| Does it compile in a worker off Firefox's event page | 009, still open — no Firefox on the machine 009 was run on |
| What GitHub's `symbols` payload answers with on a source file, and for which languages | 011 |
| Whether `/archive/{sha}.tar.gz` answers on the session cookie for a private repository | 012 |
| What a whole-repository Ledger costs, in seconds and in bytes, on a repository of each size | 012 |

## Further Notes

**This is additive, not an overhaul.** Nothing above replaces a screen, changes an address, or
moves a control. The interface a reader who never holds Command sees is unchanged, which is
also what makes it safe to ship in slices: the first slice is a keyboard command over a file
list that needs no Ledger at all.

**Following is the argument for the desktop app.** The extension can be Sure about a Name
inside a file and about an import a file states, and it cannot be Sure about much more without
a type checker it has no room for. The app has a filesystem and a process, and the port above
is the seam where it gets to be better rather than merely the same.
