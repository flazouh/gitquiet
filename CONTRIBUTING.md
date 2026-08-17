# Contributing

Thank you for reading this far. This file says what the gates are, what the
words mean, and what a change is expected to look like when it arrives.

## Setting up

```sh
bun install          # dependencies, git hooks, WXT types, the Effect source
bun run dev          # load the extension in a dev browser
```

`bun install` does three things beyond the dependencies. It clones the Effect
source to `.repos/effect` so its API can be read rather than guessed, it writes
the WXT types, and it installs the git hooks described below. All three come
from the `prepare` script in `package.json`.

To load the extension by hand instead: `bun run build`, then open
`chrome://extensions`, enable Developer mode, choose Load unpacked, and select
`.output/chrome-mv3`.

## The gates

One command decides whether a change can land, and it holds the gates:

```sh
bun run gates   # oxlint over src, then tsc --noEmit, then the whole suite,
                # then the compiler again over the desktop app
```

The list lives in `package.json`, so the git hooks and
`.github/workflows/ci.yml` run that script rather than their own copy of it.

The desktop app needs a fourth gate because it is a workspace with a
`tsconfig.json` of its own, and the root one compiles `src`, `tests`, `scripts`
and `shots`. Its tests were always run — `bun test` from here finds
`desktop/src` like anything else — but a test does not typecheck the code it
never calls. So the day the shared domain changed shape, the one place still
holding the old shape said nothing until somebody pressed a row in the window
and the whole app went blank. `bun run gates:desktop` is that compiler on its
own.

A test is given twenty seconds rather than bun's five. `--parallel` runs a worker
per core and a dozen of these tests parse a real GitHub page of a third of a
megabyte, so under a full run they take three or four seconds on this machine and
more than that on a runner with two slow ones. Five seconds was close enough to
fail a different handful each time, which reads as a fault in the code under it.
Waiting longer costs nothing where the test passes, because that is when it ends.

`bun install` writes a `pre-commit` hook that lints the staged files, and a
`pre-push` hook that runs the gates. Both come from `lefthook.yml`. A push that
would turn the branch red is refused before it leaves your machine.

`LEFTHOOK=0 git push` goes past them, for a branch pushed to be read rather than
to be merged.

## What the linter enforces

`.oxlintrc.json` holds the rules and says why each one exists. Three of them
surprise people:

| Rule | Means |
| --- | --- |
| No `try`/`catch` | `Effect.try` and `Effect.tryPromise` turn a throw into a failure the type shows. |
| No promises in `src` outside tests | The domain returns Effects. A promise hides both the failure and the requirement. |
| No gateway layer or extension API in the interface | A screen reads ports. What is behind a port is decided at the edge. |

If a rule is wrong for your change, say so in the pull request rather than
adding an ignore comment. The rules exist to be argued with.

## The words

[`CONTEXT.md`](./CONTEXT.md) is the glossary, and the code uses those terms
exactly. Your Move, Waiting, Running and Settled are the product's own
vocabulary and not a description of it, so a new screen groups by those four
rather than inventing a fifth.

[`docs/spec/`](./docs/spec) says what each screen is for. Read the one you are
changing before you change it.

## Effect v4

This repository is on Effect v4 beta, which differs from v3 in ways worth
knowing before writing code. `Either` is `Result`. `Effect.catchAll` and
`Effect.orElse` are gone in favour of `Effect.catch`. `@effect/vitest` is v3
only, so test clocks and property testing come from `effect/testing`.

## Tests

Tests go next to the code they cover, as `name.test.ts`. Behaviour tests use
Testing Library over happy-dom, and they read the screen the way a person does
rather than reaching for an implementation detail. `tests/setup.ts` is preloaded
for every run.

`fixtures/` holds real GitHub payloads. `bun run drift` re-checks them against
the live site and needs a session cookie, so it is not part of CI. See
[`fixtures/README.md`](./fixtures/README.md).

If you record a new one, run `bun scripts/scrub-fixtures.ts` before committing
it. A signed-in page carries a CSRF token per form, an analytics HMAC, a signed
channel name and a signed URL per private image, and none of those belong in a
public repository. CI runs the same script with `--check` and fails if they are
still there.

## Commits

Read `git log` before your first one. A message here says what the change does
to the product, in a sentence, in the product's own words:

```
Read a commit where GitHub moved it, and find such moves without a credential
Give the extension its own mark, at the four sizes Chrome asks for.
Write the WXT types before the release build, which had none.
```

Not `fix: commit page` and not `refactor tests`. The subject line carries the
intent, and the body carries the reason if the subject cannot.

## Pull requests

Open an issue first for anything that changes a screen or adds a page, so the
shape can be agreed before it is built. Small fixes can go straight to a pull
request.

Keep the diff to one thing. A change that fixes a bug and tidies three files
around it is two pull requests.

## Licence

This project is [AGPL v3 or later](./LICENSE). By opening a pull request you
agree that your contribution is licensed under it. The licence covers the code
and not the name or the logo; see [NOTICE](./NOTICE).
