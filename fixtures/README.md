# Recorded GitHub payloads

These are real responses from GitHub's internal pull request endpoints, recorded
from a logged-in browser session. They are the test corpus for the gateway, and
the reason the behaviour tests exercise real decoding rather than hand-written
stand-ins.

| File | Pull request | Why it is here |
| --- | --- | --- |
| `changes.json` | `microsoft/vscode#327442` | Draft, two Copilot threads, mixed check states, three merge blockers |
| `status-checks.json` | `microsoft/vscode#327442` | 29 checks, `SUCCESS` and `IN_PROGRESS` |
| `merge-box.json` | `microsoft/vscode#327442` | Unmergeable, no reviews |
| `header.json` | `microsoft/vscode#327442` | Opened, never closed: `closedTime` and `mergedTime` both null |
| `approved-changes.json` | `microsoft/vscode#327417` | Merged, 28 files, added and modified |
| `approved-status-checks.json` | `microsoft/vscode#327417` | 70 checks, all passing |
| `merge-box-approved.json` | `microsoft/vscode#327417` | Carries an `APPROVED` review |
| `approved-header.json` | `microsoft/vscode#327417` | All three moments: opened, closed and merged |
| `commit.json` | `octo-org/octo-repo@c48f531` | A commit page: 22 files, content for 8, the other 14 held back |
| `commit-extra-diffs.json` | the same commit | The batch that answers for those 14 |

Both pull requests are from a public repository. The payloads contain Alive
websocket channel tokens, which are signed, short-lived and scoped to public
topics.

The two commit payloads are from a private repository and are cut down to the
fields the schemas read, with each file's diff lines truncated to six — enough to
hold the shape, and nothing that identifies the code. They are here because they
are the only recording of a payload GitHub deliberately sends incomplete: a
commit page embeds diffs until it has spent a byte budget and sends every file
after that as a path, a digest and a status. Insisting on the rest is what used
to throw away the whole commit.

## Drift

`src/github/contract.test.ts` decodes every file here on each CI run. That
catches us breaking our own schemas; it cannot catch GitHub changing theirs,
because the files are frozen.

Catching GitHub is `bun run drift`, which re-fetches the live routes and decodes
them with the same schemas:

```sh
GITHUB_SESSION_COOKIE='user_session=…; __Host-user_session_same_site=…' bun run drift
```

This is not wired into scheduled CI. These routes authenticate with a browser
session cookie, which is a full account credential, and storing one in Actions
secrets to run a weekly check is a poor trade. Drift is instead caught two ways:
by running the command above when something looks wrong, and in production,
where every decode failure is a typed error reported to Sentry naming the field
that changed.

## Re-recording

Fixtures were captured through a logged-in browser session against the routes
listed above, with `Accept: application/json` and `X-Requested-With:
XMLHttpRequest` — GitHub answers 406 without the second header.

When re-recording, keep the two pull requests distinct in what they exercise:
one unmergeable draft carrying bot findings, one merged and approved. The tests
assert exact counts, so they will need updating alongside.
