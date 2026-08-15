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

Both pull requests are from a public repository.

## What is taken out before a recording is committed

A signed-in page carries values that belong to the session rather than to the
data: a CSRF token on every form, an HMAC on every analytics click, a signed
channel name for live updates, an upload token, and a signed URL for each
private image. They expire, nothing here reads them, and they do not belong in
a public repository.

`bun scripts/scrub-fixtures.ts` replaces each one and keeps the field's shape,
so a schema that reads a string still reads one. Two tokens that differed on the
page still differ afterwards, because a page carries one per form and there are
tests that tell one form from another by exactly that. A value that is already a
stand-in is left alone, so a name like `a-token-minted-for-this-page` survives.

Run it after recording, before committing. CI runs it with `--check` and fails
if a recording arrived with the real values still in.

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

Or without a credential at all, by asking from inside a page that is already signed
in. `capture-drift.mjs` runs in a browser ego-browser drives, fetches the same routes
with the same headers, and writes each answer as the bytes GitHub sent. The check then
decodes those with the same schemas and the same page mining:

```sh
mkdir -p /tmp/drift-capture && ego-browser nodejs < scripts/capture-drift.mjs
DRIFT_FROM=/tmp/drift-capture bun scripts/check-drift.ts
```

Prefer that road. The session never leaves the browser, so no environment variable,
shell history, terminal log or file on disk holds an account credential for the length
of a check.

It asks for 34 reads, which is every schema in `src/github/wire.ts` that decodes
a read: the pull request routes, a commit and the batch of diffs it holds back, a
branch's commits and their deferred marks, branches, authors, the front page, the
sidebar, the whole tree, one file, all six shelves, the dashboard's search and
its deferred rows, the repository filter, the issue search, an issue, the two
suggesters, and the public events feed. Each names how much it read, because a
shelf nobody has put anything on decodes whatever shape it is and an `ok` on no
rows is worth less than an `ok` on twenty.

Five schemas are not asked for, and the script names them with the reason on
every run: `CreatedComment`, `AddedComment`, `CreatedIssueRoute`, `UploadPolicy`
and `UploadedAsset` each decode the answer to a write, so asking would mean
commenting on somebody's pull request, opening an issue, or putting a file in
GitHub's asset store once per run.

A route that answers with something other than 200 is reported apart from one
that drifted, and exits 2 rather than 1: a 404 means a target in the list above
has been deleted, which is the check needing repair rather than news about
GitHub. Every target has an environment variable of its own: `DRIFT_PULL_REQUEST`,
`DRIFT_REPOSITORY`, `DRIFT_COMMIT` and the rest are listed at the top of the
script, so a dead default can be worked around in one run.

Until 2026-08-14 this covered five routes out of thirty-four schemas, all five on
one pull request. That is why the widening exists: on the morning
`/search?type=issues` moved its whole answer into `payload.blackbirdSearchRoute`
and blanked both issue screens, `bun run drift` printed five `ok` lines. The next day
the same move reached the commit list, as `payload.commitsRefRoute`, and blanked a
branch's commits: two routes catching up in two days with the shape their repository
home and their file view already answered with. On the evening of the second day, the
capture road above found a third: a commit's own page, as `payload.commitRoute`. Both
commit routes moved on the same day, and the check found the page while the reader had
only noticed the list.

## Not caring about the wrapper

Four moves in two days, and all four were the same move: the answer went under a new
key and nothing inside it changed. So the schemas stopped describing the envelope. A
route's schema says what its answer is, `whereverItIs` in `src/github/wherever.ts`
searches the payload for it three levels deep, shallowest first, and a rename costs one
extra decode attempt. Two shapes matching at the same depth is a refusal rather than a
guess, for the same reason the gateway refuses a payload it cannot read: a screen drawn
from the wrong subtree can show the wrong facts.

That claim is checked rather than asserted. `reParented` in `tests/reParented.ts` applies
the move nobody has applied yet, renaming an existing wrapper or adding one, and the
contract tests read all twelve recordings through it. The same transformation runs against
the live routes:

```sh
DRIFT_FROM=/tmp/drift-capture DRIFT_RENAMED=1 bun scripts/check-drift.ts
```

All thirty-four survive that.

The two pages read out of a document took the most work, and are the reason `wherever.ts`
has four functions rather than one. A repository page carries the file list, the About
panel and `currentUserCanPush` as three of GitHub's payloads side by side, and a file page
carries the lines and the rendering as two. So each fact is searched for on its own: the
file list and the lines are required, and the other three are looked for and done without,
which is `maybeAmong`. A repository whose About panel changes shape draws its files.

Two of those searches need an anchor, because everything drawn from them is optional and a
shape that matches an empty object matches the first object in the document. The About
panel is anchored on `stargazersPath`, which is not drawn at all and is the one field their
panel always carries, so a repository that stops sending counts still draws its
description. The footing is anchored on `repo.currentUserCanPush` being present, because
their About payload holds a `repo` of its own and a search for any `repo` finds two.

Mining is by shape as well now. `embeddedPayloads` hands over every payload in the
document and the schema picks, so nobody spells `codeViewBlobLayoutRoute.StyledBlob`,
which was a key with a dot in its name rather than two levels of nesting.

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
