# 011 — A file that knows itself

- **Status**: DONE.
- **Severity**: MEDIUM
- **Category**: Coverage
- **Spec**: `docs/spec/following.md`
- **Depends on**: 009, which answered yes for Chrome, and 010's half one. Both, and there is no way around
  either: without 009 there is no parser, and without the Name seam there is nothing to hang
  one on.

The first Follow. One language, one file at a time, no Ledger and no network: everything in
this plan is answerable from the text already on the screen. A reader holds Command, a Name
underlines, they click, and the file scrolls to where it is written. That is the whole of it,
and it is most of what Following ever gets asked.

TypeScript first, and the reason is not that it is easiest. It is what this repository is
written in, which means every person carrying out this plan can tell a right answer from a
wrong one without leaving the project, and `fixtures/code/` can be written by hand in an
afternoon.

## The shape

    content script                 offscreen document
      Name from the renderer  ───►   worker: parse, resolve
      underline, card, Peek   ◄───   Writing, Uses, outline

Four pieces, and they are built in this order.

### 1. The port, `src/ports/Ledger.ts`

Beside `Renderer.ts`, and it names no package, touches no DOM and mentions no worker. Three
questions, each an Effect, each with a typed failure:

- the Writing for a Name in a file, or nothing;
- the Uses of a Writing in that same file;
- the Writings a file holds, in the order they are written, which is the outline.

Plus the two failures worth telling apart, because the interface says different things about
them: a language nothing here parses, and a parser that could not be reached at all. A cold
answer is neither — it is an answer that has not arrived, and the interface draws nothing
until it does. There is no spinner in this feature.

The lint rules apply and are the point: no promises in `src`, no extension API above the port,
tagged errors rather than throws.

### 2. The parser, built beside the extension

`scripts/build-code-intel.ts`, copied in shape from `scripts/build-diff-engine.ts`, writing
`public/code-intel.js`. `web-tree-sitter` and one grammar's `.wasm`, both published in
`web_accessible_resources` for `*://github.com/*` alongside `diff-engine.js`
(`wxt.config.ts:146`). `scripts/build-wasm-probe.ts` already does exactly this for one grammar
and is the file to grow rather than the file to copy.

The grammar comes from `@vscode/tree-sitter-wasm` and is pinned. Plan 009 measured why:
`tree-sitter-wasms` ships Emscripten's legacy `dylink` section, web-tree-sitter 0.27 reads only
`dylink.0`, and the mismatch fails as `need dylink section` — which reads like a policy refusing
a module and is not one.

Nothing of it may enter the content script. A content script is one file with every dynamic
import inlined, which is the finding that cost 10.6MB once already (`src/diff/shiki.ts`), and a
grammar is a megabyte a reader who never holds Command must not download.

### 3. The offscreen pool

**One** offscreen document, shared with Mermaid's (`src/entrypoints/background.ts:23-45`),
because plan 009 measured that Chrome allows no second one — `createDocument` is refused with
"Only a single offscreen document may be created." So this plan's first job in that area is to
make the existing document take both jobs and both reasons, rather than to open one of its own.
It holds a single worker: a single file is a single parse, and a pool is 012's problem, where a
repository arrives at once.

The document is what keeps the work alive — the service worker is shut down while idle, which
`src/app/onTheWay.ts` already works around by keeping what it fetched for half a minute.

Parses are cached by the file's blob sha, in memory, in the worker. That is the same key the
Ledger will use in 012 and it costs nothing to use it now; what it buys immediately is a reader
moving between two files in a review and back.

### 4. The resolver, which is where the care goes

Two tree-sitter queries per language — the definitions and the scopes. Then, in plain
TypeScript over the tree:

- a Name inside a scope that declares it resolves there, and shadowing wins;
- a Name declared at the top of the file resolves to that declaration;
- a Name that is a property, a label, a string or a comment resolves to nothing, and the
  interface must not underline it, because an underline that leads nowhere is worse than no
  underline;
- everything else in this plan resolves to nothing. Not to a guess. A Name imported from
  another file has no Writing until 012, and the honest answer is no underline.

All of this is pure — text in, Writings out — so it is `bun test` with no browser and no
network, which is how the rest of `src/domain` is tested. `fixtures/code/` holds the cases and
each is one file: a shadowed parameter, a name declared after it is used, a class method with
the same name as a free function, a name that is only ever a property, a name inside a template
string. The test asserts what came back *and* whether it was Sure, not only where it pointed.

## The interface

- **Command held** — Control where the reader is not on a Mac — underlines every Name on the
  screen that has a Writing, and releasing it puts the file back. The key is read from the
  event the renderer hands over; it is not a global listener.
- **A click while underlined Follows.** The address is replaced, not pushed, exactly as opening
  a file in a review is, so Back is still the way out of the page (`README.md`, "Addresses").
  Within one file the destination is a line, which the address format already carries.
- **Shift and a click Peeks**: the Writing is drawn as a row under the Name, in the annotation
  row a review thread is already drawn in. Escape closes it, and Escape is already the word for
  dismissal in all three key profiles.
- **Hovering an underlined Name** opens a card with four things and nothing else: the Writing's
  line, the comment above it where there is one, `path:line`, and the Sure or Likely mark.
  `@radix-ui/react-hover-card` is already a dependency and already draws the person card.
- **`fileNames`**, `o` in both profiles that have keys, lists the Writings in this file in the
  order they are written. It is the outline, and it is the cheapest proof the resolver works.

Everything above is drawn only once an answer is in hand. A reader who never holds Command is
on the screen that exists today, which is what makes this safe to ship.

## Gates and evidence

`bun run gates`. Two new photograph rows in `bun run qa`: the hover card over a Name, and a
Peek row open under one.

Record in the pull request, measured rather than estimated: the weight of `code-intel.js` and
the grammar, the time from a Name arriving to a Writing coming back on a file of a few hundred
lines, and the same on the largest file in `fixtures/`. The spec's budget is one frame for an
answer already in memory, and a tenth of a second for one that is not. A number that misses it
is a finding, not a failure — write it down.

## What this plan must not do

- **No network.** Not one fetch. Every answer here is in the text already drawn.
- **No second language.** The resolver will be written twice before it is written well, and
  doing that across two languages at once means finding out which half is wrong twice over.
- **No Likely.** Nothing in this plan guesses. Likely arrives with 012, where there is
  something to guess between.

## Outcome

A name in a file follows to where it is written, on a live github.com page, by scope.

Measured with `bun scripts/probe-ledger.ts`, which asks the Ledger from the page about
`fixtures/code/shadowing.ts` — through the content script, the worker, and the offscreen
document that does the parsing:

| Asked | Answered |
| --- | --- |
| `shape` where it is called, at the end of the file | line 9, a function — the outer one |
| `shape` inside `said`, which declares its own | line 16 — the inner one |
| The outline | the same twelve names `bun test` gets |
| A file nothing here parses | "no grammar for this file", and the file reads as it always did |

The second row is the plan. Two names spelled the same, in one file, answered apart.

### Tree-sitter compiles under `bun test`, which changes where the care goes

Plan 009 only needed it to compile at our own origin in a browser. It also compiles under Bun —
so `src/ledger/writings.test.ts` runs the resolver against the real TypeScript grammar with no
worker, no document and no browser anywhere near it. Eighteen cases: a parameter, a local, a name
shadowed by an inner one, a name used before it is written, a declaration answering with itself,
a const holding an arrow called a function, every name a destructuring pattern binds, a for-of
binding, types and classes, a property answering nothing, an imported name answering nothing, a
doc comment, a signature, Uses counted from both sides of a shadowing, and the outline.

The live probe is then about the three hops and nothing else, which is all it can honestly be
about.

### Two things the plan had wrong

- **One offscreen document, not two.** The plan said "a second offscreen document beside the
  Mermaid one"; 009 had already measured that Chrome refuses one. So `mermaid-offscreen.html` is
  now `offscreen.html`, named for the place rather than for whichever job asked first, and holds
  three listeners: Mermaid's, the Ledger's and 009's probe. The background opens it once with
  every reason any of them needs. This also fixed a live defect 009 left behind — the probe's own
  document would have broken diagram rendering for anyone who used both.
- **A `Map` keyed by node is a map that is never hit.** The first resolver walked the file once,
  built a table from node to scope, and looked the node up — and answered `undefined` for every
  name in the file. Tree-sitter hands out a fresh JavaScript object each time a child is asked
  for, so two objects for one node are never equal. It asks a node what it declares now, walking
  the path from the root to the Name, which is the scope chain read from the inside out. Shadowing
  then needs no rule of its own: the inner scope is simply the one asked first.

### What is there

| | |
| --- | --- |
| `src/ledger/writings.ts` | The resolver. Pure, structural over `Syntax`, no parser in sight |
| `src/ledger/syntax.ts` | What a syntax tree has to be for the resolver — five questions |
| `src/ledger/parse.ts` | The grammar, loaded and given back. Every tree and parser is deleted |
| `src/ledger/protocol.ts` | The two words, so a relay cannot answer itself |
| `src/ledger/client.ts` | The port, over a message |
| `src/ports/Ledger.ts` | The three questions, said without a parser |
| `src/entrypoints/offscreen/` | The one document, and its three jobs |
| `src/ui/following.ts` | Holding a key over a name, and pressing it |
| `src/ui/ledger.tsx` | How a screen gets one, or finds it has none |

`WholeFile` asks, which is a repository's file pane and a file's blame. Nothing is asked until
the key is held: a pointer crossing a file passes a hundred identifiers, and a Ledger asked
about each would be a hundred parses of a file nobody is asking about.

### The drawing, added after the first pass

- **The card.** Four things beside the Name and no more: the line it is written on, the comment
  above it, where that is, and Sure or Likely. Not interactive and said so — a card that answered
  the pointer would take the hover off the word that opened it, which closes the card, which gives
  it back, which is a flicker a reader cannot get out of. It needed one thing from the renderer:
  `boundsOf`, which is four numbers rather than the element, because a pane holding the element
  could reach into the renderer's document and change what it drew.
- **The Peek**, on Shift with the press. Hung under the line through the same rows a review thread
  is drawn in, and through `showNotes`, which changes the rows without redrawing — a Peek that
  redrew the file would take the reader's scroll with it. Escape puts it away.
- **`fileNames`**, on `o`, in both profiles that have keys. It ranks by `domain/findingFile.ts`,
  the same function Go to File ranks paths with: one is the repository by path and the other is
  this file by name, and a reader who has learnt to type in one should not have to learn the other.

**The underline now answers the key going down**, not only the key being held on arrival. That was
wrong and would have read as broken: a reader reads a line, wonders what a name is, and reaches
for the key with the pointer already sitting on the word.

### Not done

**Uses in the aside.** `usesIn` is built and tested from both sides of a shadowing, and there is
no panel. It is also the one of the three that wants 012's answer first — Uses across a repository
is a different question from Uses in a file, and building the panel for the second would be
building it twice.
