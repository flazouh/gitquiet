# githubpro

A Chrome extension that replaces GitHub's pull request pages with an interface organised by attention rather than by object type, served from a local cache kept current by GitHub's own push notifications.

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
| Extension | WXT, Chrome MV3 |
| UI | React, shadcn, Tailwind |
| Domain and data | Effect (typed errors, Layers, Schema, Schedule) |
| Local store | Dexie over IndexedDB |
| Observability | `@effect/opentelemetry` into Sentry |
| Tests | Vitest, `@effect/vitest`, Testing Library, Playwright |

## Setup

Not yet scaffolded. `npm run prepare` will clone the Effect source to `.repos/effect` for local research; it is gitignored.
