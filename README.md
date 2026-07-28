# githubpro

A Chrome extension that replaces a pull request's conversation with an interface organised by attention rather than by object type, served from a local cache kept current by GitHub's own push notifications. It sits inside GitHub's page, wearing GitHub's design system: their header, nav and tabs are untouched, and the part that is ours is drawn in Primer tokens and Octicons, so it follows whichever theme you already use.

## Why

GitHub's pull request pages are slow to load and slow to comprehend. Measured on `microsoft/vscode#327442`: 1,537 ms to first byte, 3,323 ms to load, 230 requests. The same data is available as a single 111 KB JSON payload. Meanwhile the page is organised into Conversation / Commits / Checks / Files tabs — by record type, never by whether something needs you.

This extension inverts that. One screen shows every item that needs attention, grouped by who owes the next move. Drilling into any row gives a keyboard-driven queue you traverse one item at a time.

## Documents

- [`CONTEXT.md`](./CONTEXT.md) — the domain glossary. Read this first; the code uses these terms exactly.
- [`docs/spec/pull-request-review.md`](./docs/spec/pull-request-review.md) — the spec.

Work is tracked as issues in this repository.

## Stack

| Concern | Choice |
| --- | --- |
| Toolchain | Bun for install, scripts and tests |
| Extension | WXT, Chrome MV3 |
| UI | React and Tailwind over GitHub's own Primer tokens, classes and Octicons |
| Domain and data | Effect v4 (typed errors, Layers, Schema, Schedule) |
| Local store | `storage.local`, reachable from both the content script and the worker |
| Observability | Sentry |
| Tests | `bun test`, `effect/testing`, Testing Library, happy-dom |

Effect v4 differs from v3 in ways worth knowing before writing code: `Either` is
`Result`, `Effect.catchAll` and `Effect.orElse` are gone in favour of
`Effect.catch`, and `@effect/vitest` is v3-only. Test clocks and property
testing come from `effect/testing` instead.

## Setup

```sh
bun install          # also clones the Effect source and generates WXT types
bun run compile      # typecheck
bun test             # unit and behaviour tests
bun run dev          # load the extension in a dev browser
bun run build        # production build into .output/chrome-mv3
bun run drift        # re-check GitHub's live payloads against our schemas
```

`bun run drift` needs a session cookie and is not part of CI; see
[`fixtures/README.md`](./fixtures/README.md) for why.

`bun install` clones the Effect source to `.repos/effect` for local research. It
is gitignored and exists only so the Effect API can be checked against source
rather than guessed.

To load the extension by hand: `bun run build`, then in Chrome open
`chrome://extensions`, enable Developer mode, choose Load unpacked and select
`.output/chrome-mv3`. Open any pull request to see it take over the page.
