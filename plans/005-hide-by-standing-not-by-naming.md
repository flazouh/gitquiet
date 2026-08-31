# 005 — Hide by standing, not by naming

- **Status**: SUPERSEDED by 006
- **Commit**: dbde9d0
- **Severity**: HIGH
- **Category**: Architecture & failure modes
- **Estimated scope**: `place.ts` home entry first, then one place at a time; `bands` deleted per migrated place

## The asymmetry

Every selector in this extension makes a claim about GitHub's markup, and GitHub rewords
its markup without telling anyone. But the two kinds of selector fail in opposite
directions, and everything worth fearing lives in one of them.

A selector that **finds** — a region, a proof, a stage — fails safe. It stops matching,
the takeover never starts, and the reader gets GitHub whole. Degraded, obvious, usable.

A selector that **hides** fails dangerous. It stops matching, hides nothing, and their
page stands beside ours: a hybrid nobody designed, on the screen until a person notices.
The `aria-label="Account"` rename was this exactly — the band went quiet for weeks and
the only monitor was an eye.

`hideTheirs` already has no such claim in it: it hides *the siblings of where we stand*,
naming nothing of GitHub's. It cannot rot. Every silent failure this extension has ever
had came from `bands` — nominal hides reaching outside the region.

## The rule

**Selectors may only find. Steady-state hiding must be positional.**

One refinement, forced by cold loads: the pre-reveal gate fires while the document is
still parsing, before ours exists to have siblings, so it has to name what it hides. That
is allowed, because its rot degrades to a flash of GitHub content — loud, cosmetic,
self-healing when the takeover lands. Nominal hiding is permitted where failure is a
flash, banned where failure is a silent hybrid. In `Place` terms: `stages` stays,
`bands` dies.

## Home, the proof

All four of home's bands are descendants of one box. Measured live on 2026-08-31:

```
div.feed-background:has(#dashboard.dashboard)
  matches 1 element on /, 0 on /feed
  children: [aside.feed-left-sidebar, div.flex-auto]
  contains: sidebar ✓  spinner ✓  Explore ✓  copilotPreview ✓  #dashboard ✓
```

Stand there instead of in `#dashboard.dashboard`, and the sidebar, the spinner and the
Explore panel become siblings of ours — hidden by position, unhideable by rename. The
`:has()` carries the page proof the sidebar band carried before, and it is a *finding*
claim now: if GitHub renames the column, the takeover declines and the reader gets
plain GitHub, never a hybrid.

Steps:

1. `HOME.regions` → `['div.feed-background:has(#dashboard.dashboard)']`; keep the
   current selectors as `stages` (load-time flash cover); delete all four `bands`.
2. `bun scripts/build-gates.ts` and `bun scripts/build-canary-manifest.ts`.
3. Re-verify the interface's own layout at full width — taking Explore was already
   what gave the Courts their width, so ours now owns the whole row by right.
4. Update `place.test.ts` home/feed fixtures; the feed test keeps proving the region
   is false there.
5. Live pass with `scripts/verify-home.js` and `bun run canary`.

## The rest of the ledger

Bands elsewhere, each awaiting the same question — is there an ancestor that contains
both the region and the band, unique to the page:

- conversation: `PullRequestHeader`, the tab strip, the stack banner
- commit: `PageLayout-Header`
- repo-home: the `RecentlyTouchedBranches` flash
- profile / person-repos / person-stars: the sticky profile bar

Migrate one place at a time, live-verified each. Any band that has no such ancestor
stays, and stays acknowledged in `selectorHygiene.test.ts` — a named reach we chose,
not one we forgot.

## What this does to the guard system

The audit, the canary, the hygiene test and the ledger were built as a safety net for
silent hybrids. Under this rule the silent hybrid is unrepresentable for migrated
places, and the net shrinks to what it should have been: drift telemetry. The canary
still runs — it now answers "did the extension go dormant on home" rather than "is a
reader looking at a broken page". `gateAudit` keeps watching the unmigrated places
until their bands are gone, then watches nothing and can be deleted with the field.

And a system whose worst failure is "the extension politely absent" does not need a
crash reporter it never ships a DSN for. Removing `@sentry/browser` stops being a
cleanup and becomes a consequence.
