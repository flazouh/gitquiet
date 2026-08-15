# Security

GitQuiet runs inside github.com with the session you are already signed in
with, and it reads and writes your repositories through GitHub's own routes and
API. A flaw here reaches whatever your GitHub account reaches, so reports are
taken seriously.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting:

**[Report a vulnerability](https://github.com/flazouh/gitquiet/security/advisories/new)**

That form is private between you and the maintainer until a fix is published.
Please do not open a public issue for a security problem.

Include what you have: the version, the browser, the page it happens on, and
the smallest sequence that shows it. A proof of concept helps and is not
required.

You should get a first reply within seven days. If a report is confirmed, you
will be credited in the advisory unless you would rather not be.

## Supported versions

The version published on the Chrome Web Store, and `main`. There are no
maintained older branches.

## What is in scope

| In scope | Out of scope |
| --- | --- |
| Code injected into a github.com page | Bugs in github.com itself, which belong to [GitHub](https://bounty.github.com) |
| The content script, the worker and their messaging | Findings from a modified or unofficial build |
| Anything reachable from `storage.local` | Reports produced only by a scanner, with no working case |
| The permissions in `wxt.config.ts` | Anything that needs an already compromised machine |
| Data leaving the browser when it should not | Social engineering of the maintainer or of users |

## What GitQuiet does with your data

There is no account and no server of ours. Your code, reviews and tokens stay
in the browser. Every write goes back through GitHub.

Error reporting is compiled in only when `VITE_SENTRY_DSN` is set at build
time, and nothing in this repository sets it. See
[`src/observability/sentry.ts`](./src/observability/sentry.ts) for what it would
send if it were.
