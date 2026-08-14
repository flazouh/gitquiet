# Request audit, August 2026

An audit of what this extension asks GitHub for, when it asks, and where a reader waits.
It answers two questions: does hover read ahead, and is every request worth its wait.

Everything below is measured or cited. Measurements come from the extension as built on
`695d02c`, read in `ego-browser` against `github.com/vitejs/vite`.

## The short answer

Hover reads ahead on almost everything, issues included. The issue screen is still slow,
and prefetch is not the reason. The issue read waits three seconds for something that
never arrives, then downloads a page the browser already has.

## 1. Hover does read ahead

One global listener, in the shell that runs on every GitHub page.

```252:265:src/entrypoints/shell.content.ts
    document.addEventListener(
      "pointerover",
```

- The pointer has to rest for 150ms (`DWELL`), so a pointer crossing a list reads nothing.
- One read at a time, and at most 12 per visit (`AT_MOST`), so a sweep cannot flood.
- The page already open is never warmed (`src/app/warming.ts:57`).

The table in `src/app/warming.ts` covers pull requests, the Working Set, repository lists,
repository home, actions, runs, commits, notifications, issue lists and single issues.
An issue link warms the whole issue:

```167:167:src/app/warming.ts
  if (Option.isSome(issue)) return { key: link.pathname, read: warmIssue(issue.value) }
```

There is a second, finer layer. `src/ui/near.ts` warms a row when the pointer comes within
about 80px of it, used by commits, checks, and the repository tree.

So a warm read misses only when the reader does not hover: a keyboard press, a pasted
address, a middle click, or a hover shorter than 150ms.

## 2. Why one issue takes seconds

Measured, cold document load, screen drawn when our root holds a heading:

| Issue | Drawn after |
| --- | --- |
| `vitejs/vite#23261` | 2263ms |
| `vitejs/vite#23238` | 2059ms |

Both of those took the fast path, with a hash kept from an earlier visit. The slow path is
worse, and it is the one a reader meets after every GitHub deploy.

The issue read needs a persisted query hash before it can ask anything
(`src/github/GitHubGateway.ts:604`). It looks in the store under this deploy's release, and
when that misses it waits for GitHub's own page to ask the query:

```612:612:src/github/GitHubGateway.ts
  const asked = yield* whenAsked(performance, watchingResources, ISSUE_QUERY, ASKING)
```

`ASKING` is three seconds. The comment above it says their app asks the route a few hundred
milliseconds in. On today's issue page it does not ask it at all. The only query names in
the page's resource timeline are:

```
IssueViewerSecondaryViewQuery  at 410ms
useRecentAgentActivitySubscription  at 838ms
```

`IssueViewerViewQuery` is not there, because GitHub serves it inside the HTML instead. The
served document carries it exactly once:

```
$ curl -sL --compressed https://github.com/vitejs/vite/issues/23261 -o /tmp/issue.html
$ wc -c /tmp/issue.html      # 248805
$ rg -o 'IssueViewer[A-Za-z]*Query' /tmp/issue.html | sort | uniq -c
   1 IssueViewerViewQuery
```

So the cold path is: wait 250ms for the view choice, wait three seconds for a request that
never comes, then fetch the whole 249kB issue page a second time to read the hash out of it
(`issueInItsPage`, `src/github/GitHubGateway.ts:633`), then decode and draw.

The answer to the whole read is in that document, next to the hash. The parser for it
already exists and is only ever pointed at fetched HTML:

```657:657:src/github/GitHubGateway.ts
  const preloaded = preloadedIn(html, ISSUE_QUERY)
```

Nothing reads `preloadedQueries` out of the page the reader is standing on. On a document
navigation an issue needs no request at all.

Three things to change, in order of what they return:

1. Read the current document's `preloadedQueries` first. A document load then costs zero
   requests and no wait. Capture it at `document_start`, before their hydration removes it.
2. When the document has no preloaded query, go straight to the page fetch. Waiting three
   seconds for a name GitHub does not ask is three seconds of nothing.
3. Keep the hash path for soft navigations, where there is no fresh document to read.

## 3. Requests that are made twice

`saidAt` folds identical GET addresses into one request in flight:

```390:391:src/github/GitHubGateway.ts
const saidAt = (url: string): Effect.Effect<Said> =>
  askingOnce(
```

Only JSON routes go through it. These do not:

- `askedGraphql` (`src/github/GitHubGateway.ts:711`), which is how a single issue is read.
- `issueInItsPage` (`:633`) and every HTML document fetch: repository home, notifications,
  actions, runs, commits.

So a 150ms hover on an issue followed by the press sends the same persisted GET twice, and
on the cold path it downloads the same 249kB page twice. Putting both through `askingOnce`
makes the pair one request.

## 4. Other costs, ranked

1. **Every tab focus re-reads.** `useLive` sets `revalidateOnFocus: "always"` and ignores
   its own ten second freshness window on focus (`src/ui/useLive.ts:176`). Coming back to
   the tab is a full re-read of whatever the screen holds.
2. **Nothing is cancelled.** No `fetch` in `src/` carries an `AbortSignal`. Effect
   interruption stops the waiter, not the download (`src/github/flight.ts:56`). For a warm
   that is the point. For a screen the reader has left it is waste.
3. **No conditional reads.** No ETag or `If-None-Match` anywhere, and the store has no age,
   only an LRU cap (`src/github/cache.ts`). A revisit pays the full body every time.
4. **Ten issues per page.** The list route serves ten rows (`src/github/wire.ts:1428`), so
   reading a repository's issues is many pages of ten.
5. **No retry.** A failed read is a failed screen. Only the alive socket backs off
   (`src/github/alive.ts:48`).

## What is already right

- One gateway, one fetch layer, cookies rather than a token (`src/github/GitHubGateway.ts:308`).
- Screens fork their read before waiting on the takeover, so the wait for GitHub's own page
  costs nothing (`src/screens/issue.tsx:51`).
- The store answers first and the live read replaces it, so a second visit paints at once.
- A websocket rather than a poll for pull request state (`src/github/alive.ts:9`).
- Concurrency caps everywhere reads fan out: 4 branches, 4 commit stats, 2 diff batches,
  9 standings per batch.

## How to measure this again

```
ego-browser nodejs
  gotoAndWait("https://github.com/vitejs/vite/issues/23261")
  performance.getEntriesByType("resource")   # their requests, not ours
```

Requests made by the content script do not appear in the page's resource timeline. Time our
own reads by when the screen draws, or add a mark inside the gateway.
