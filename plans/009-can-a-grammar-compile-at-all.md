# 009 — Whether a grammar can compile at all

- **Status**: DONE for Chrome, and the answer is **yes**. Firefox is unanswered — see below.
- **Severity**: HIGH — it is a gate, not a feature. A no here changes what 011 and 012 are.
- **Category**: Feasibility
- **Spec**: `docs/spec/following.md`, "The parsing cannot happen where the interface is"

## The question

`src/diff/shiki.ts` records that WebAssembly is refused inside a content script on github.com,
because the policy that applies there is GitHub's and not ours, and that declaring
`wasm-unsafe-eval` in our own manifest does not change it. The same note guesses the way out:
"A worker started from an extension URL is a different origin with a different policy." Every
plan after this one is built on that guess. Nobody has run it.

Two answers are needed, and they are not the same answer:

1. **Chrome.** Does a `.wasm` module compile inside an offscreen document — and inside a
   dedicated worker started from one — while a github.com tab is open and is what asked for it?
2. **Firefox.** There is no offscreen API; `wxt.config.ts:134` already gates the permission to
   Chrome and Edge. Does a worker started from the event page compile one, and does it survive
   long enough to be worth using?

## What to build

Nothing that ships. This is a branch that answers a question and is then thrown away or kept
behind a flag — say which in the pull request.

1. **`content_security_policy.extension_pages` in `wxt.config.ts`.** The manifest sets none
   today, so the default applies and the default has no `'wasm-unsafe-eval'`. Add:

       content_security_policy: {
         extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
       }

   Write the comment that says why, in the register the rest of that file is written in: this
   is the line that lets an extension page compile WebAssembly at all, and Chrome refuses it
   without it even though the page is ours.

2. **A second offscreen document.** `src/entrypoints/wasm-probe.html` and
   `src/entrypoints/wasm-probe/main.ts`, copied from the Mermaid pair
   (`src/entrypoints/background.ts:23-45` opens that one). Reason `["WORKERS"]`, justification
   in one sentence. It answers one message and returns what happened.

3. **The smallest real grammar.** `web-tree-sitter` and one language's `.wasm`, published in
   `web_accessible_resources` for `*://github.com/*` alongside `diff-engine.js`
   (`wxt.config.ts:146`). Not a hand-written `.wasm` — the question is whether a grammar of
   the size and shape this project will actually ship compiles, not whether any module does.

4. **Three places to try it, in this order.** The content script (expected to fail, and the
   failure is the control that proves the test is real), the offscreen document, and a worker
   started from the offscreen document. Record which of the three succeed.

5. **Parse one file.** Compiling is not the question on its own. Load the grammar, parse a real
   source file of a few hundred lines, and read one node out of the tree. A compile that
   succeeds and a parse that throws is a no.

## How to run it

`bun run build`, load `.output/chrome-mv3` unpacked, open a pull request on github.com, and
trigger the probe from the page. Not the shots stage and not happy-dom: the whole question is
GitHub's own policy, and neither of those has one. `bun run verify:live` and the canary
manifest already exist for checks that must happen on a real page — use whichever fits rather
than inventing a third way in.

Then the same on Firefox with the event page in place of the offscreen document.

## What done looks like

A section appended to this file, under `## Answer`, carrying:

- Chrome and Firefox versions, and the date.
- Which of the three contexts compiled, which parsed, and the exact error text from the ones
  that did not.
- What the grammar's `.wasm` weighs and how long the compile took, measured twice: cold, and
  with the module cached.
- Whether `content_security_policy.extension_pages` was needed, which is worth knowing on its
  own, because it is a manifest change a store reviewer will read.

And a line at the top of the file: the Status turns to DONE, and says yes or no.

## If the answer is no

It is not the end of Following, and the plans after this one should not be written as though it
were. Three fallbacks, in the order they are worth trying:

- **A parser that is not WebAssembly.** A hand-written incremental parser for TypeScript alone,
  in JavaScript, is a large but finite thing, and 011 needs exactly one language.
- **Shiki's tokens, which are already computed.** Every file drawn is already tokenised for
  colour. TextMate scopes name a function declaration and a variable, coarsely and per line.
  That is Likely and never Sure, and the spec already has a word for it.
- **The desktop app first.** It has a filesystem and a process and no CSP at all. Following
  would ship there and reach the extension later, which reverses the order but not the design:
  the port in the spec is the same port either way.

## What this plan must not do

Build any of Following. No port, no Ledger, no resolver, no interface. The temptation is to
answer the question by building the thing, and then the answer arrives three weeks late and
mixed in with a feature that cannot land without it.

## Answer

**Chrome: yes.** A Tree-sitter grammar compiles and parses in an offscreen document, and in a
dedicated worker started from one, on a live github.com page — and is refused in the content
script on the same page at the same moment, which is what makes the yes worth anything.

Run on 2026-09-13, Chrome 153.0.8010.36 on Linux, headless, a throwaway profile, signed out,
against `https://github.com/microsoft/vscode/pull/327442`. Reproduce with:

    bun run build && bun scripts/build-wasm-probe.ts && bun scripts/probe-wasm.ts

Two runs, minutes apart, agreeing:

| Context | 8 bytes of WebAssembly | The grammar | A parse |
| --- | --- | --- | --- |
| Content script | `CompileError: WebAssembly.compile():` | `CompileError: WebAssembly.compile():` | — |
| Offscreen document | ok | ok, 18ms then 9ms | ok, 6ms then 4ms |
| Worker from an extension URL | ok | ok, 10ms then 9ms | ok, 5ms then 5ms |

The parse is `src/ui/place.ts` — 54,400 bytes of real TypeScript — into 3,152 nodes, both
times, in both contexts. The runtime (`web-tree-sitter.wasm`, 209,613 bytes) initialised in
0–8ms. The grammar is 1,413,849 bytes.

**Single-digit milliseconds per file, off the main thread.** That is the number the rest of
`docs/spec/following.md` was written without.

### What refuses it, in GitHub's own words

The page's header, read in the same run:

    script-src github.githubassets.com 'sha256-tSjmyPUky1KbRZ0fw9VUil3wFEbeM82rtbJDygGJAXw='

No `'wasm-unsafe-eval'`, so no WebAssembly, and a content script is held to it — exactly as
`src/diff/shiki.ts` says. The control failing is the finding: a run where all three contexts
had succeeded would have proved only that the probe was not measuring a policy.

### `content_security_policy.extension_pages` was needed

The manifest set none, so Chrome's default applied, and the default has no
`'wasm-unsafe-eval'` — which refuses WebAssembly on a page of ours as firmly as github.com
refuses it on one of theirs. `wxt.config.ts` now carries:

    script-src 'self' 'wasm-unsafe-eval'; object-src 'self'

It does not loosen anything github.com serves. A content script stays held to their policy
whatever this says, which the table above is the proof of.

### Four things learnt that change the plans after this one

1. **Only one offscreen document may exist per extension.** Measured: a second
   `createDocument` is refused with "Only a single offscreen document may be created." Mermaid
   already has ours (`src/entrypoints/background.ts:23`). So 011 does not open a second one —
   it shares the one, or moves Mermaid's work into a shared document. This is a design change
   to `docs/spec/following.md`'s "The parsing cannot happen where the interface is", which
   assumed two.

2. **The grammar's provenance matters more than its size.** `tree-sitter-wasms@0.1.13` ships
   grammars carrying Emscripten's *legacy* `dylink` custom section; the loader in
   web-tree-sitter 0.27 reads only `dylink.0` and fails them with `need dylink section` — a
   message that reads like a refusal and is a version mismatch. `@vscode/tree-sitter-wasm@0.3.1`
   ships `dylink.0`, loads, and is 40% smaller: 1.41MB against 2.34MB for TypeScript.
   011 takes its grammars from there, and pins them.

3. **`web-tree-sitter` calls `eval` twice** (`web-tree-sitter.js:2400` and `:2423`, Emscripten's
   `ASM_CONSTS` and `EM_JS` paths), which the bundler warns about. Neither was reached by
   anything above — the grammar loaded and parsed under `script-src 'self' 'wasm-unsafe-eval'`,
   which forbids `eval`. Worth knowing before a grammar that does reach them arrives: the
   symptom would be a refusal on one language and not the others, and the answer is not to add
   `'unsafe-eval'` to the manifest.

4. **A worker is as good as the document.** It compiled, loaded and parsed the same, which is
   what 012's pool needs and what makes the offscreen document a place to keep work alive
   rather than the only place work can happen.

### Firefox is unanswered

No Firefox on the machine this was run on, so the second half of the question — whether a
worker off the event page compiles one, and whether it survives a suspend mid-build — is
still open. It is the same probe with a different runner. Until it is answered, treat Following
as a Chrome and Edge feature in planning, and note that `wxt.config.ts:134` already gates the
`offscreen` permission to exactly those two.

### Two faults in the live-check harness, found by running into them

Both were in `scripts/chrome.ts`, both are fixed there, and both had been silently breaking
every live probe in this repository on a current Chrome:

- **`--disable-extensions-except` excepts the extension it was given.** Chrome 137 and later
  ignore `--load-extension`, so `chrome.ts` loads over the protocol instead — and on Chrome 153,
  measured across three trials, an extension loaded that way with that flag present installs,
  reports an id, and runs none of its content scripts. The isolated world never appears and
  `withExtension` reports "The content script's world never appeared", which reads as a broken
  extension. Removing the flag fixes it; `--load-extension` alone is harmless.
- **`findChrome` knew two Mac paths and a Puppeteer cache.** On Linux with Chrome installed at
  `/usr/bin/google-chrome` it threw, naming two folders that machine was never going to have.
  The Linux paths are in the list now.

And one about probes generally, which cost three runs: a probe that throws before `stop` leaves
Chrome holding the debugging port, and the next run talks to the *previous* run's browser —
the hazard `chrome.ts` documents at `PORT`. `scripts/probe-wasm.ts` stops its Chrome in a
`finally`, and any probe written next should too.

### What is left behind

Kept, not thrown away, because 011 is the same machinery with a resolver on top:

| File | What it is |
| --- | --- |
| `src/wasm-probe/attempt.ts` | The question, asked once, runnable in a window or a worker |
| `src/wasm-probe/protocol.ts` | The two words the three parties use |
| `src/wasm-probe/worker.ts` | The worker half |
| `src/entrypoints/wasm-probe.html`, `wasm-probe/main.ts` | The offscreen document |
| `scripts/build-wasm-probe.ts` | Builds the worker, copies the runtime, the grammar and the sample |
| `scripts/probe-wasm.ts` | The live run above |
| `src/entrypoints/background.ts` | A relay, in one marked block |

The manifest's CSP line stays, because 011 needs it and because it is the answer's most useful
artifact.

What a release carries today, said exactly, because "it is only a probe" is how 1.6MB ends up
in a store build. The runtime, the grammar and the sample are gitignored and are written only
by `scripts/build-wasm-probe.ts`, which `bun run build` does not run — so a clean checkout
builds without them. The offscreen page is an entrypoint, and WXT builds every entrypoint, so
`wasm-probe.html` and an 82kB chunk *are* in the output, as is the relay block in
`background.ts`. Neither does anything: the document loads, finds no grammar where it expects
one, and answers a message nobody sends.

So whoever takes 011 decides one of two things, and should decide it before the first release
after this lands: fold the probe into the code-intelligence chunk it was the skeleton for, or
move the page out of `src/entrypoints/` into something `scripts/build-wasm-probe.ts` writes,
which takes it out of every build that does not ask for it.
