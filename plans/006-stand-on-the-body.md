# 006 — Stand on the body, where the page is ours to take

- **Status**: DONE for the pages it fits; the rest keep the net, by design
- **Commit**: 8419849
- **Severity**: HIGH
- **Category**: Architecture & failure modes
- **Estimated scope**: `place.ts` home entry (done); `gateCss.ts`, `mount.ts` outside-mark (done)

## What this started as, and where the ground moved

The plan set out to read nothing of GitHub's human presentation anywhere: stand every
screen on `document.body`, hide by position, delete the bands and the guard system with
them. Home crossed over and proved the shape (`e8ea371`). Then the second page was read
live, and the premise turned out to be half true.

GitQuiet is two kinds of screen, and only one of them replaces the whole page.

## The two kinds

**Full-replacement.** Home, the pull request dashboard (`/pulls`), notifications, the
issue dashboard (`/issues`). Cross-repository views with no chrome of GitHub's the reader
still needs. These own the viewport — their own bar, their own everything — so the mount
point can be `body`, hidden by position, no band naming anything. Home is here and is
migrated. The other three already carry **no bands at all**: their region is a finding
claim that fails safe, and there is nothing left to fail dangerous. Migrating them to
`body` would be idiom, not safety, so they are left as they are.

**Nested.** A pull request, a commit, an issue, a repository's own pages, a profile.
These sit *inside* GitHub's repository or profile chrome on purpose — [place.ts](../src/ui/place.ts)
says it plainly on the issue: "The repository's header and its tab row are GitHub's to
keep: somebody reading an issue still needs the rest of the repository." A screen here
cannot stand on `body`: hiding the body's children would take the repository nav the
reader navigates by.

## Why the nested bands cannot be hoisted away, proved live

The hope was to stand a nested screen on its own machine-named container — `react-app
[app-name="pull-requests"]`, a semantic attribute GitHub publishes, deterministic like a
route meta — so the header and tabs it hides become siblings taken by position. Read off
a live pull request on 2026-09-01:

```
react-app[app-name="pull-requests"]        child of div.repository-content (4 children)
  [class*="PullRequestHeader"]   inside the app  ✓
  [aria-label="Pull request navigation tabs"]  OUTSIDE the app, a sibling in repository-content
```

The header is inside the app; the tab strip is outside it. The two things a conversation
hides live at two different depths, so no single stand takes both. The bands are
irreducible: they are the price of coexisting with GitHub's chrome instead of replacing
it, and GitQuiet chose that coexistence deliberately.

## The settled architecture

- **Full-replacement pages** stand on a finding region (`body:has(...)` for home) and
  carry no bands. The silent hybrid — a hide that rots into GitHub's page beside ours —
  is unrepresentable here.
- **Nested pages** keep a finding region (fail-safe) and a small set of named bands
  (fail-dangerous). Those bands are watched, not trusted:
  - `gateAudit` checks every takeover in the field and reports a leak the moment a band
    goes stale — the runtime net, firing whenever the reader opens the page.
  - `selectorHygiene.test.ts` fails the build on a new band that leans on a reworded
    label with no structural anchor.
  - the canary reloads the pages on a schedule and goes red on drift, before a reader
    hits it. Extended in this branch to the nested pages that carry bands and have a
    durable address — the profile and a pull request — so their bands get the same
    proactive cover home's did.

The guard system built on 2026-08-31 is therefore **not scaffolding to delete**. It is
the permanent net for the one class of page that cannot be made deterministic, because
GitQuiet lives inside GitHub's chrome there rather than over it. `bun run drift` guards
the wire contract; these guard the presentation contract that remains.

## Done

- Home stands on `body:has(#dashboard.dashboard)`, bands deleted (`e8ea371`).
- `hideTheirs` and the sheets exempt `data-gitquiet-outside`, so a body-standing screen
  never hides its own bar or hover hosts.
- Canary extended to the nested band pages with durable URLs.

## Not done, and why

- `/pulls`, `/notifications`, `/issues` stay on their regions. Already band-free, already
  fail-safe; a move to `body` is uniformity with regression risk and no safety gain.
- `mount.ts`'s `findSlot` and region machinery stay. Standing on `body` is a region
  value, not a code path — nothing to delete, and the nested pages need the machinery.
