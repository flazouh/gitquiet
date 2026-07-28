# Spec: Pull Request Review

Status: ready-for-agent

## Problem Statement

Reviewing a pull request on GitHub is slow to load and slow to comprehend, and the two problems compound.

It is slow to load because the server takes over a second to produce the first byte. Measured on `microsoft/vscode#327442`: the conversation page returns its first byte after 1,537 ms and finishes loading at 3,323 ms across 230 requests and 941 KB. The files page returns its first byte after 2,014 ms and builds 4,770 DOM nodes. Every visit pays this again, including a return visit thirty seconds later.

It is slow to comprehend because the page is organised by object type — Conversation, Commits, Checks, Files are four tabs because they are four kinds of record. Nothing on the page is organised by whether it needs the Participant. The consequences a Participant feels:

- A pull request with 127 commits shows dozens of "pushed N commits" events interleaved with the actual discussion, so the discussion becomes islands in a sea of noise.
- Threads carry one bit of state, resolved or unresolved, which conflates "nobody needs to do anything" with "someone is waiting on you". The Participant rebuilds their todo list by scrolling and inferring, on every visit.
- A failing check is announced as a red mark, and reading the actual failure takes four or five more interactions: open the Checks tab, find the job, open it, wait for a log viewer, scroll to the error.
- Automated reviewers post volumes of Bot Findings into the same stream as human comments. Many are Stale Findings whose target lines have since changed, and many are Duplicate Findings from a second tool, but the Participant triages all of them by hand every time.
- Tracking progress through a large diff relies on the Participant manually ticking a "viewed" checkbox per file — the software delegates its own bookkeeping to the person.

The result is that a Participant returning to a large pull request cannot answer "what am I supposed to do here" without several seconds of loading followed by minutes of reconstruction.

## Solution

A Chrome extension that replaces GitHub's pull request pages with an interface organised by attention rather than by object type, served from a local cache that is kept current by GitHub's own push notifications.

Two views.

The **Control Center** is the bird's-eye view of one pull request. It presents every Attention Item — review threads, failing checks, Bot Findings, files changed since the Participant last read them, an out-of-date branch — grouped into three Courts: Your Move, Waiting On Others, Settled. It fits on one screen. The Courts are role-aware, so the same pull request shows an Author their unaddressed change requests and shows a Reviewer the files that changed since their Last Review Point. A failing check displays its extracted failure message inline, not a link to a log.

**Focus** is the view of a single Attention Item. Every Control Center row is the mouth of a Queue scoped to that row, traversed one item at a time with `n` and `prev`, showing position and progress. `esc` returns to the Control Center. When a Queue empties, the Participant returns to the Control Center with that row marked done and the next Queue primed, so continuing is one keystroke.

The design constraint governing what may appear in the Control Center: **zero interactions to know whether something needs you, one interaction to reach the thing itself.**

Commits are not a list the Participant scrolls. They collapse to a single summary line, and the question they actually answer — what changed since I last looked — is promoted to the primary diff control, driven by the Last Review Point that GitHub already computes and exposes as `user.lastReviewOid`. An area-grouped commit browser sits behind the collapsed line for archaeology.

Bot Findings never enter the discussion. They are filtered mechanically first — Stale Findings hidden, Duplicate Findings merged, prior Dismissals honoured — and the survivors appear inside the file the Participant is currently reading, at the moment they are actionable.

Speed comes from already having the data. The extension holds the Participant's Working Set in a local store, and subscribes to the Alive websocket channels that GitHub already publishes for every pull request. Opening a pull request reads from the local store and renders immediately; a channel firing invalidates only the slice it refers to. There is no polling loop.

## User Stories

1. As a Reviewer, I want a pull request to open instantly, so that I do not lose my train of thought waiting for a page.
2. As a Reviewer, I want to see everything that needs me on one screen without scrolling, so that I can decide whether to engage before investing attention.
3. As a Reviewer, I want Attention Items grouped by Court, so that I never have to work out which ones are mine.
4. As a Reviewer, I want each Attention Item to appear in exactly one Court, so that I never process the same thing twice.
5. As a Reviewer, I want the Your Move Court to be countable and to drain to zero, so that reviewing has a felt end rather than trailing off.
6. As an Author, I want the Control Center to show me my unaddressed change requests, so that I know what is blocking my merge.
7. As an Author, I want to see which reviewers have not started, and how long they have been waiting, so that I know when to nudge.
8. As a Reviewer, I want to see the actual failure message of a failing check on the Control Center, so that I do not open a log viewer to read one line.
9. As a Reviewer, I want to jump from a check failure to the line of code it implicates, so that diagnosis and review are the same activity.
10. As an Author, I want to rerun a failed job without leaving the Control Center, so that a flaky test costs me one interaction.
11. As a Reviewer, I want a pull request with 127 commits to show me one summary line rather than 127 rows, so that the commit history stops competing for my attention.
12. As a Reviewer, I want the discussion to contain only discussion, so that I can read the conversation as a conversation.
13. As a Reviewer, I want "since my last review" to be the default diff range when I have reviewed before, so that returning to a pull request shows me only what is new.
14. As a Reviewer, I want to see how many files changed since my Last Review Point before I commit to a Review Pass, so that I can size the work.
15. As a Reviewer, I want to choose an arbitrary commit as the diff base, so that I can reconstruct what happened between any two points.
16. As a Reviewer, I want an area-grouped commit browser available behind the summary line, so that archaeology is possible without commits being ambient.
17. As a Reviewer, I want to review one file at a time in Focus, so that my working memory holds one thing.
18. As a Reviewer, I want to advance with a single keystroke, so that a fourteen-file review has a rhythm.
19. As a Reviewer, I want my position and total shown at all times, so that I know how much is left.
20. As a Reviewer, I want my Reviewed State to be recorded as a byproduct of advancing, so that I never maintain a checkbox.
21. As a Reviewer, I want a file I already read to re-enter my Queue when it changes, so that a later push cannot silently escape review.
22. As a Reviewer, I want to leave a comment from inside Focus without changing view, so that commenting does not interrupt reading.
23. As a Reviewer, I want to draft several comments and submit them as one review, so that the Author receives one notification rather than eight.
24. As a Reviewer, I want to close the tab mid-review and resume where I stopped, so that a Review Pass can span days.
25. As a Reviewer, I want files that changed since my Last Review Point ordered first in my Queue, so that the most relevant work comes first.
26. As a Reviewer, I want unresolved threads to be Queue items I step through, so that responding to discussion works the same way as reviewing files.
27. As a Reviewer, I want an emptied Queue to return me to the Control Center with the next Queue primed, so that continuing costs one keystroke and I still get to re-orient.
28. As a Reviewer, I want Bot Findings kept out of the discussion entirely, so that human comments are never buried.
29. As a Reviewer, I want Stale Findings hidden automatically, so that I do not evaluate comments about code that no longer exists.
30. As a Reviewer, I want Duplicate Findings from different tools merged into one item, so that I judge each defect once.
31. As a Reviewer, I want to see how many raw findings were reduced to how many shown, so that I trust the filter rather than fear it.
32. As a Reviewer, I want a Dismissal to persist across pushes, so that dismissing a finding is permanent.
33. As a Reviewer, I want to suppress a whole category of Bot Finding, so that a tool's least useful check stops costing me attention forever.
34. As a Reviewer, I want surviving Bot Findings to appear inside the file I am reading, so that each one arrives when it is actionable.
35. As a Reviewer, I want to turn a Bot Finding into my own comment in one interaction, so that agreeing with a tool is cheap.
36. As a Participant, I want every pull request in my Working Set kept current in the background, so that any of them opens instantly.
37. As a Participant, I want the Control Center to update while I am looking at it, so that a check going red reaches me without a refresh.
38. As a Participant, I want the Control Center to be current when I press `esc` out of Focus, so that returning never shows stale status.
39. As a Participant, I want the extension to say when it last synced and whether it is offline, so that I know whether to trust what I am reading.
40. As a Participant, I want the interface to work from cache when GitHub is unreachable, so that a network blip does not stop a review.
41. As a Participant, I want a manual refresh available, so that I can force the issue when I suspect staleness.
42. As a Participant, I want the extension to correct a wrong Court assignment when I tell it to, so that a heuristic mistake is not permanent.
43. As a Participant, I want a manual Court override to persist, so that I only correct it once.
44. As a Participant, I want every state to have its own URL, so that browser back works and I can share a link to a specific file or thread.
45. As a Participant, I want to reach GitHub's original page in one interaction, so that anything the extension does not cover is not a dead end.
46. As a Participant, I want the extension to keep working on private and enterprise repositories, so that my actual work is covered and not just open source.
47. As a Participant, I want the whole interface reachable from the keyboard, so that a review never requires the mouse.
48. As a Participant, I want the extension to tell me plainly when GitHub has changed something it depends on, rather than showing a broken page, so that I know to update rather than doubting the data.
49. As a Participant, I want errors reported automatically, so that breakage caused by a GitHub change is fixed before I have to report it.
50. As a Participant, I want no login step, so that installing the extension is the whole setup.

## Implementation Decisions

### Delivery

A Chrome MV3 extension built with WXT, replacing the conversation on a pull request's own page. It replaces that region rather than augmenting it, because GitHub's server latency cannot be improved by client-side work and the information architecture being replaced is the region's structure itself. Everything around it — the site header, the repository nav, the pull request title and its Files, Commits and Checks tabs — is GitHub's and stays GitHub's, both because those parts already work and because a page that is half theirs must navigate like theirs.

Rendering is React and Tailwind against GitHub's own design system. Primer Primitives are already declared on the page — about twelve hundred custom properties — so the interface's tokens are aliases onto theirs, its icons are Octicons, its typeface is whatever the page is set in, and its cards and buttons reuse Primer's own classes. This is not thrift: it means every GitHub theme, including the high-contrast and colourblind ones, is supported without a line of code, and it means the interface is recognisable as part of the page it sits in. Tailwind's preflight is not imported, and its utilities are imported unlayered — a layered rule loses to GitHub's unlayered element rules regardless of specificity.

Domain and data layers are written in Effect. Errors are typed rather than thrown, services are provided as Layers, and retry and resubscription policies are expressed as Schedules. No `any`, no `as`, no unsafe assertions — data arriving from GitHub is decoded with `Schema` at the boundary, which is also what turns an unannounced GitHub change into a precise, reportable decode failure instead of a crash deep in a component.

Observability is `@effect/opentelemetry` exporting to Sentry. Because gateway calls and sync operations are written with `Effect.fn`, each carries a span without additional instrumentation.

Pull requests already read are kept in `storage.local` rather than IndexedDB. It belongs to the extension rather than to `github.com`, so GitHub's own code cannot read or clear it; it is reachable from the service worker as well as from a content script on any GitHub page, which is what lets a pull request be warmed from the list someone is about to click through; and a pure cache of forty pages does not justify a schema or a migration story. What is kept is GitHub's payloads rather than the snapshot decoded from them, so a page written before a schema changed fails the decoder and counts as a miss instead of becoming a lie in the right shape.

### Data access

GitHub's own pull request pages are already JSON-driven internally, and those endpoints authenticate with the Participant's existing session cookie. Requests require both `Accept: application/json` and `X-Requested-With: XMLHttpRequest`; omitting the latter returns HTTP 406. This has been verified against a live pull request.

The endpoints the extension consumes:

- The changes route returns a single payload containing `diffSummaries` (path, change type, lines added and deleted, `markedAsViewed`), `diffContents` with the actual diff lines, `markers.threads` carrying review threads, the commit list, the comparison range, and `user.lastReviewOid`. Measured at 111 KB in 1,363 ms, replacing 205 separate requests.
- Page-data routes return status checks, the merge box, the diffstat, tab counts and codeowners, each between 0 and 3 KB.
- The conversation route returns Alive channel tokens only. The timeline itself is served from GitHub's internal GraphQL, addressed by the Relay global ID present in the payload. **This is not yet verified and is the first spike.** Court derivation depends on thread data, so the spike gates the work that consumes it.

`user.lastReviewOid` means Last Review Point is a field GitHub already computes, not something to reconstruct. `diffSummaries[].markedAsViewed` means existing viewed state can seed Reviewed State on first run rather than starting empty.

### Sync

Every payload carries Alive websocket channel tokens, one per topic: timeline, review state, workflow run, merge queue, git merge state, head ref, base ref, issue state and deployment. The sync engine warms the Working Set once, then holds subscriptions and refetches only the slice a firing channel invalidates. There is no interval poll, which both minimises traffic and avoids the unusual request pattern that triggers GitHub's secondary rate limiting. Reconnection and backoff are Schedules.

The local store is Dexie over IndexedDB. It is internal to the sync layer and not a seam: nothing above the gateway knows the store exists.

### Modules

The design goal is deep modules — narrow interfaces over substantial implementations — so that the interface is the test surface.

**Gateway** is the only adapter to GitHub and the system's single seam. Its interface speaks the domain vocabulary in `CONTEXT.md`, not GitHub's field names, so that everything above it is insulated from both GitHub's schema and the choice of transport. The shape, with the exact Effect service idiom to be pinned against the vendored source during implementation:

```ts
interface GitHubGateway {
  readonly workingSet: Effect<ReadonlyArray<PullRequestRef>, GatewayError>
  readonly snapshot: (ref: PullRequestRef) => Effect<PullRequestSnapshot, GatewayError>
  readonly events: (ref: PullRequestRef) => Stream<PullRequestEvent, GatewayError>
  readonly submitReview: (ref: PullRequestRef, draft: ReviewDraft) => Effect<void, GatewayError>
  readonly rerunCheck: (ref: PullRequestRef, check: CheckRef) => Effect<void, GatewayError>
}
```

Push updates are a `Stream` on the gateway rather than a separate subscription service, so tests drive real-time behaviour by pushing events into a queue.

**Attention** is a pure module. Given a `PullRequestSnapshot` and the viewing Participant's role, it produces the Attention Items and assigns each a Court. It contains the Court heuristics — who spoke last, whether a question was asked, whether a review is in changes-requested, whether a Bot Finding is untriaged — and applies stored manual overrides. It has no dependencies, so it is tested directly.

**Findings** is a pure module that reduces raw bot comments to the set worth showing: hiding Stale Findings by comparing anchors against the current diff, merging Duplicate Findings by defect location and content similarity, and honouring stored Dismissals and category suppressions. It reports its own reduction counts so the interface can show them.

**Queue** is a pure module turning a Control Center row plus the Attention Items into an ordered traversal, including the ordering rule that puts files changed since the Last Review Point first, and the re-entry rule that returns a file to the Queue when its content hash changes.

**Reviewed State** persists `(Participant, file path, blob SHA)` records, seeded from `markedAsViewed` on first sync. Keying on the blob SHA is what makes expiry automatic rather than a manual invalidation step.

Routing gives every state a URL so browser history and shareable links work, with a visible escape to GitHub's own page on every view.

## Testing Decisions

A good test here asserts what a Participant can observe — what the Control Center shows, what pressing `n` does, which findings survive filtering — and never asserts how it was computed. Tests that assert internal call sequences or component structure are not acceptable, because the whole point of the exercise is that the implementation behind the seam will change when GitHub changes.

**One seam: `GitHubGateway`.** This is the highest available seam and the only one. Everything above it — decoding, Court derivation, finding reduction, queue construction, React rendering, keyboard handling — is exercised as real code against a fake gateway Layer. Effect's `Layer` is the substitution mechanism, so no test needs module mocking or network interception.

Three kinds of test.

**Pure module tests** cover Attention, Findings and Queue directly, since they are pure functions over domain types. These carry the edge cases: a thread whose last comment is the Participant's own, a bot comment anchored to a deleted line, two tools reporting the same defect with different wording, a file reviewed at one SHA and then changed.

**Behaviour tests** render the real application with a fake gateway Layer and drive it as a Participant would, using Testing Library. These cover the user stories above: opening a pull request shows the three Courts; pressing `n` through a Queue advances and records Reviewed State; a channel event pushed into the gateway's event stream updates the Control Center while Focus is open; emptying a Queue returns to the Control Center with the next one primed. Time-dependent behaviour uses Effect's `TestClock`; the store is stood in for at the browser API rather than injected, since it is internal rather than a seam.

**Contract tests** are the early-warning system for the undocumented endpoints. Fixtures are recorded from live GitHub responses and checked into the repository; the same `Schema` definitions that decode production traffic validate them. A scheduled job re-fetches the same routes from live GitHub and decodes them against those Schemas, so an endpoint drifting produces a failing build rather than a broken interface for the Participant. This is the mechanism that makes depending on internal endpoints tenable.

End-to-end coverage uses Playwright with the extension loaded against recorded fixtures, kept to a thin layer proving the extension mounts, takes over the route and renders — the behaviour tests carry the real weight.

There is no prior art in the repository; it is greenfield. These decisions establish the pattern.

## Out of Scope

- Any GitHub surface other than pull request pages: repository home, code browsing, issues, search, the notifications inbox, Actions.
- Firefox and Safari builds. WXT keeps them cheap later; v1 targets Chromium.
- Any backend service. The extension is entirely local, with no server component and no hosted state.
- Token or OAuth authentication. The gateway seam exists so this can be added if the cookie route breaks, but v1 ships without it.
- Cross-device synchronisation of Reviewed State, Dismissals and Court overrides. All local to the browser profile.
- Writing anything other than review comments, review submissions and check reruns. Merging, closing, branch management and label editing stay on GitHub's own page.
- Any modification of GitHub data that has no equivalent in GitHub's own interface.
- Support for GitHub Enterprise Server on a custom domain. Enterprise Cloud on github.com is in scope.

## Further Notes

The measurements in the Problem Statement were taken from a live session against `microsoft/vscode#327442` and should be re-taken on a pull request with a large commit count and heavy bot activity, since that is the case the product exists for. Establishing that baseline is worth doing before the first slice, so that improvement is provable rather than asserted.

The dependency on undocumented endpoints is the project's central risk and is addressed three ways: the gateway confines all knowledge of them to one module, `Schema` decoding turns drift into a precise typed failure rather than a crash, and the scheduled contract test detects drift before a Participant does. The interface should degrade honestly — telling the Participant that something GitHub changed is unsupported, and offering the original page — rather than rendering partial data silently.

Because the tickets live as issues and pull requests in this repository, the project's own review traffic becomes its test corpus. Adding an automated reviewer to the repository early is worth doing deliberately, since it generates the Bot Finding cases the Findings module needs.
