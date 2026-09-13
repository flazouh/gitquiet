# 012 — The Ledger, and Following into a file that is not on the screen

- **Status**: PART DONE. Following crosses a file; the Ledger itself is not built. See Outcome.
- **Severity**: MEDIUM
- **Category**: Coverage
- **Spec**: `docs/spec/following.md`
- **Depends on**: 011, whole. This plan widens what a Writing may be; it does not change what
  one is.

011 answers a Name from the file it is written in. This one answers a Name whose Writing is in
a file the reader has never opened, at the commit under review — which is the thing GitHub
cannot be asked for, because their navigation is about their default branch and a reviewer is
looking at a branch.

## The key is the blob sha

A commit is the wrong key for a Ledger and this is the decision the rest of the plan rests on.
Two branches of a repository differ in a handful of files; keyed by commit, both are indexed
whole. A force-push changes one file; keyed by commit, everything is thrown away.

So: a Writing list per blob sha, and a commit is a list of `(path, blob sha)` pairs pointing
into it. Re-opening a pull request after a push costs the files the push touched and nothing
else. Getting the shas is free — `/tree-list/{sha}` is already read
(`src/github/GitHubGateway.ts:4224`) and answers in `git ls-tree` terms.

## The files arrive as one archive

`rawFileAt` is a file at a time (`GitHubGateway.ts:4194`) and stays right for the one file a
reader opened. A Ledger wants the repository:

    https://github.com/{owner}/{repo}/archive/{sha}.tar.gz

one request for all of it, the address GitHub's own download button uses. It redirects to
`codeload` with a signed token, so the session the extension already holds should reach a
private repository — **should**, and the spec lists this as unmeasured. Measure it before
building on it; if it does not hold, the fallback is `rawFileAt` over the paths the reader's
own files import, which is slower and is not nothing.

`host_permissions` already covers `*://github.com/*`. Decompression is
`DecompressionStream("gzip")`, which is native and is not WebAssembly, so the service worker
can do it before a worker is awake. Untarring is fifty lines.

There must be a ceiling, measured rather than guessed, and a repository over it does not get a
refusal — it gets a Ledger of the files the reader opens, which is 011 plus whatever those
files import.

## Where it is kept

Not `storage.local`. `KeyValue` (`src/ports/KeyValue.ts`) is the right port for settings and
for what `cache.ts` keeps, and the wrong one for tens of megabytes of postings.

IndexedDB, holding packed typed arrays rather than objects — a Writing list read back as
objects is a structured clone on every open, and the answer has to arrive inside a frame.
`unlimitedStorage` is already held (`wxt.config.ts:130-135`). Evict by repository, least
recently read first.

## The pool

011's single worker becomes one per core less one, in the same offscreen document. A whole
repository is the only thing in this feature that is ever big, and it is embarrassingly
parallel: a file per message, a packed result back. Transfer the buffers rather than cloning
them.

Do not start it on a drive-by. The spec is explicit: opening one file on a stranger's
repository builds nothing. The Ledger starts when a reader opens a second file, or any pull
request, in the same repository — and when it starts, it starts from `onTheWay.ts`, which is
told a tab is moving 1.2 to 3.6 seconds before the page exists. That head start is already
taken for the pull request's own payloads; this rides it.

## The third tier, and the first honest guess

011 resolves inside a file. This adds what a file *states* about other files:

- its imports, and the specifier each names;
- its exports, including what it re-exports from somewhere else;
- the resolution of a specifier to a path — relative first, then `tsconfig.json` paths, then
  `package.json`. A specifier that leaves the repository leaves this feature.

A Name that resolves through a stated import is **Sure**. A Name that matches a Writing's name
and kind in a file nothing here connects to the reader's file is **Likely**, and is marked, and
is offered anyway — a reviewer looking at an unfamiliar repository would rather have the
probable answer with a mark on it than nothing.

Where two Writings are equally Likely, there is no Writing. A list to choose from is a question
asked of a reader who came here to avoid one.

## What opens

- **Follow across files.** The Writing's file opens at its line, address replaced, Back intact.
  On a pull request this may be a file the branch never touched, which is the case worth
  testing first because it is the one that was impossible before.
- **Uses**, in the aside, grouped by file and counted per file, in the reading order the file
  tree already computes rather than alphabetically.
- **`goToName`**, `T` in both key profiles: any Writing in the repository, typed. The ranking
  is `findingFile.ts` from 010 over names instead of paths — the same function if it can be
  made to take both, and two functions if forcing it into one makes either worse.

## Gates and evidence

`bun run gates`, plus `scripts/benchmark-ledger.ts` beside the pull request benchmark, which
must report, per repository size:

| | |
| --- | --- |
| The archive | bytes, and seconds to fetch |
| The build | seconds, wall clock, and the number of workers |
| The Ledger | bytes on disk |
| A warm Follow | milliseconds, in memory |
| A cold Follow | milliseconds, off IndexedDB |
| A push of one file | seconds to bring the Ledger back up to date |

Run it on three real repositories of three sizes and put the table in the pull request. The
spec's budgets are targets; this is where they become measurements, and a target missed is a
number to write down rather than a reason to hold the plan.

Correctness gets `fixtures/code/` grown into a small repository with known answers: a name
re-exported through a barrel, a name imported under an alias, a name that exists in two files
with one import connecting only one of them, a name in a file the tarball skipped. Each asserts
the mark as well as the answer — a Likely returned where Sure was possible is a defect even
though it points at the right line.

## Then the vocabulary moves

Following is built at the end of this plan, so the Language section of `docs/spec/following.md`
moves into `CONTEXT.md` and the spec's Status line says built. Words in `CONTEXT.md` are words
something answers to; until here, nothing did.

## What comes after, and is not this

- **More languages.** Python, Go, Rust, and the rest of the list in `src/diff/shiki.ts`, which
  is already a judgement about what people open a pull request about. One grammar and two
  queries each, and the resolver above is the part that does not change.
- **Exact answers for TypeScript**, by running the compiler in a worker. Seconds of work and a
  great deal of memory for Names the three tiers already reach; a setting a reader turns on,
  never a default.
- **The desktop app**, which has a filesystem and a process and can satisfy `src/ports/Ledger.ts`
  with a language server. Same screens, Sure everywhere. The port was drawn in 011 for this.

## Outcome

A name borrowed from another file follows to it, on a live page. The Ledger — the kept,
blob-sha-keyed index this plan is named for — is not built, and the difference between those two
sentences is the whole of what is left.

### What was built: the capability, without the index

Measured with `bun scripts/probe-ledger.ts`, on a live github.com page:

| Asked | Answered |
| --- | --- |
| `elsewhere`, used in a function, imported at the top | borrowed as `elsewhere` from `./elsewhere` |
| `whole.ts`, asked what it writes down under `two` | line 2, a function, with its signature and the comment above it |

Both halves, which is the shape of every cross-file Follow: one file says what it borrowed and
where from, and the file it names says what it writes down under that name. Neither half guesses.

- **`writingAt` answers two kinds of thing now.** A `Writing`, or a `Borrowed` — the specifier as
  written and the name the other file uses, which is not the name this file reads when an alias
  was used. `import { two as three }` borrows `two`, and a resolver that returned `three` would
  send a reader looking for a name that file never mentions.
- **`writingNamed`** is the other half, and it is what a file is asked by a file that borrowed
  from it. `default` and `*` answer with the file's first Writing, which is the honest best
  available without reading what the export is, and is nearly always right.
- **`src/ledger/reaching.ts`** turns a specifier into a path, against the paths the repository
  really has — `/tree-list/{sha}`, which the tree already reads. Nine tests: a sibling, a folder
  up, a folder meaning its index, `.js` meaning the TypeScript beside it, the JavaScript where
  there is no TypeScript, a dependency answering nothing, a file the repository does not have,
  and a specifier that climbs out of the repository answering nothing rather than a path that
  merely looks like one inside it.
- **`Across`** is what a screen hands the pane: the paths, how to read one, and what opening one
  means. The repository's front page has all three and supplies them; a pane without it does not
  follow across files, and a borrowed name there has no underline.

### What was not built, and what it would be for

Everything this plan is actually named for. What is above reads a file per Follow, through the
route the pane already uses, and that is why it works without any of it:

- **The blob-sha-keyed Ledger**, kept in IndexedDB. What it buys is not the first Follow — that is
  already a few milliseconds of parsing — it is the second and the thousandth, and Uses across a
  repository, which cannot be done a file at a time.
- **The archive.** One request for the repository instead of one per file followed. Unmeasured,
  and `/archive/{sha}.tar.gz` on a private repository is still the assumption this plan flagged.
- **The worker pool.** One worker parses one file quickly. A repository at once is what wants a
  pool.
- **Uses across files**, and **`goToName`**. Both need an index; neither can be done by reading
  the file in front of the reader.
- **Likely.** Nothing built so far ever guesses: a name is resolved by scope, or through an import
  the file states, or it has no Writing. Every answer to date is Sure, and the mark in the card is
  drawn from the answer rather than assumed — so the day a Likely arrives, it already says so.

### What this changes about the plan above

The order was wrong. This plan put the archive and the index first and the crossing last, on the
assumption that crossing a file needed an index to cross into. It does not: a file states where it
borrowed a name from, and one read answers it. So the capability that was meant to arrive at the
end of 012 arrived at the start of it, and what is left is the part that makes it fast and the
part that makes it answer questions a single file cannot — which is a better thing to have left.

## Outcome, second pass: the Ledger is built

A repository is read whole, out of its archive, and every name it writes is a name a reader can
type at. Measured with `bun scripts/benchmark-ledger.ts` — which plan asked for and which found
the defect below before any reader could:

| Repository | Files read | Passed over | Read whole | Asked again | A keystroke |
| --- | --- | --- | --- | --- | --- |
| `sindresorhus/p-limit` | 5 | 11 | 674ms | 4ms | 4ms |
| `sindresorhus/ky` | 44 | 26 | 1,482ms | 4ms | 4ms |
| `honojs/hono` | 261 | 227 | 3,319ms | 5ms | 7ms |

One request each, fetch and gunzip and parse included. Asked again, it is the answer already in
hand. A keystroke over the whole of `hono` is seven milliseconds, which is the budget the spec
set for a Follow and this is a harder question.

### What the benchmark caught, which is why it exists

**The Ledger was keyed by the commit alone.** All three repositories reported the same five files,
because all three were warmed at `main` — a branch name standing in for a sha, which the archive
route takes and which two repositories therefore share. The second and third never read anything;
they matched the first's key and answered with its names. It is keyed by
`{owner}/{repo}@{sha}` now, and `keyOf` has a test that says why in as many words.

**Fifteen files of sixteen were passed over for being JavaScript.** The first reading shipped one
grammar, which was right for 011 — one language, written twice before it is written well — and
wrong for a repository. Three now: TypeScript, TSX and JavaScript. They are separate grammars and
not one with a flag, because `<T>x` is a type assertion in one and an unclosed element in another.

**`codeload.github.com` was not in `host_permissions`.** The archive address is on `github.com`
and answers with a redirect carrying a signed token; without the second host the redirect is
refused, and it arrives as `TypeError: Failed to fetch`, which says nothing about a redirect. One
line of manifest, found only by running it.

### What is built

| | |
| --- | --- |
| `src/ledger/archive.ts` | A repository out of `tar.gz`. No dependency: `DecompressionStream` is the browser's, and tar is a header every 512 bytes |
| `src/ledger/ledger.ts` | Every Writing by name, and the judgement about which files are worth reading |
| `src/ui/GoToName.tsx` | `T`, over a repository read once |
| `src/ui/UsesPanel.tsx` | `u`, about the name the pointer is on |
| `scripts/benchmark-ledger.ts` | The table above |

The archive is read in the offscreen document, on the session the browser already has —
credentials first for a private repository, then without, because `codeload` refuses a request
that carries one and a public repository is reached either way.

### Still not built, and now the whole list

- **The index is in memory, not on disk.** It lives in the offscreen document, which outlives
  every page a reader opens, so a review spent moving between files pays once. A browser restart
  pays again. IndexedDB is what would fix that, and it is the one piece of this plan's original
  design that is untouched.
- **One repository at a time.** A reader with two repositories open warms whichever they asked
  last. Two kept is a cache policy, and a cache policy wants the disk above first.
- **Uses is this file's, not the repository's.** The Ledger holds every Writing and not every
  Use — finding Uses across a repository means resolving every name in every file rather than
  listing what each file writes, which is a different sweep and a much longer one.
- **Blob shas.** The Ledger is keyed by commit, and a commit that changes one file is read whole
  again. Keying each file's Writings by its blob sha is what makes a push cost the files it
  touched; it needs the disk too, since there is nothing to share between commits in memory.
- **Likely.** Nothing here has ever guessed. Every answer is by scope or by a stated import, and
  the mark in the card is read from the answer rather than assumed — so the day a guess arrives,
  it already says so.

## Outcome, third pass: the Ledger is kept

Everything the list above called "still not built" is built. A repository is read once and then
not again: the second visit is a list off disk, and the visit after a push is the files the push
touched.

Measured with `bun scripts/benchmark-ledger.ts`, which now stops the browser and opens a second
one on the same profile — because nothing else can tell a Ledger that was kept from a Ledger that
merely happened to still be in hand:

| | Files | Parsed | Read whole |
| --- | --- | --- | --- |
| `honojs/hono`, first time | 386 | 383 | 3,665ms |
| `honojs/hono`, a new browser, same profile | 386 | **0** | **190ms** |

Nothing is fetched the second time. Three of the 386 were never parsed even the first time: two
paths holding identical contents are one blob sha and one question, which is git's own idea and
came for free with using its name.

Uses across a repository, live: `retry` in `sindresorhus/ky` — five places in 3ms. `req` in
`honojs/hono` — two, in 10ms, and the smallness of that number is the rule working rather than
failing: nearly every file in hono binds its own `req`, and a file that binds its own name of that
spelling holds a different thing with the same name.

### How it is keyed, which is the whole of it

**By what git calls a file's contents.** `sha1("blob " + length + "\0" + contents)`, checked
against `git hash-object` — including a file with an accent and an emoji in it, because the header
counts bytes and not characters, and a header written from the character count hashes to something
git has never heard of.

Two stores. **told**, keyed by blob sha: what one file says. **commits**, keyed by
`{owner}/{repo}@{sha}`: which blob sha each path had. A commit is then a list of forty-character
names, and answering it is looking those names up. A push changes four files, and the other four
hundred already have sayings under the names they still have.

What is let go of is decided on the manifests and never on the files: two repositories that hold
the same file — a fork, a vendored copy, the same dependency — share its reading, and a sweep that
deleted one repository's files would take the other's with it.

### Uses across a repository, and what it costs to be honest about

A Ledger keeps, per file, what it says: its Writings, every word in it that could be a name, every
name it binds, and what it borrowed. Not which word means which Writing — that needs the scopes,
which needs the file, and a Ledger that resolved every name in every file at reading time would be
doing the work of every question nobody asked.

So a Use is one of three things, and the reader is told which:

- the file the Writing is in answers exactly, by `usesIn`, because that file is the one in front
  of the reader and is parsed;
- a file that states it borrowed this name from this file is **Sure**;
- a file that merely holds the same word is **Likely**, and says so;
- a file that binds its own name of that spelling is left out entirely.

### What the benchmark caught this time

**A measurement of a typo.** The first version asked every repository about `default` in
`index.js` and was answered nothing three times over. It asks about a name the repository really
writes now — the first one its own index offers — which is the only way a number in that column
means anything.

### What is left

Nothing from this plan. Two things it never claimed, written down so they are not mistaken for
oversights:

- **Uses is per repository, not per dependency.** A name exported to `node_modules` and used by
  another repository is outside what any of this reads.
- **Likely is still never produced by Following itself.** Every Writing it points at is reached by
  scope or by a stated import. Only Uses across a repository produces one, and only where a file
  holds a word it never says it borrowed — which is exactly what "likely" means and is marked.
