# 002 — Make every fold open rather than teleport

- **Status**: TODO
- **Commit**: 0f6ad71
- **Severity**: MEDIUM
- **Category**: Missed opportunities (§8) and Interruptibility (§4)
- **Estimated scope**: 1 CSS file, 1 test file, 7 call sites adding one class

## Problem

Six folds in this extension are a native `<details>`. The chevron rotates over 150ms and
the content it uncovers appears in a single frame, so the one thing the reader is watching
is the one thing that does not move:

- `src/ui/Releases.tsx:234` — the other files of a release
- `src/ui/Commits.tsx:72` — the wall of commits
- `src/ui/Checks.tsx:163` — a check's detail
- `src/ui/Conversation.tsx:59` and `:111` — a thread and its replies
- `src/ui/PersonReposScreen.tsx:372` — a group of somebody's repositories

A check's steps at `src/ui/CheckSteps.tsx:105` and a log section at
`src/ui/LogPanel.tsx:250` are not on this list. They are a button and React state, so
`::details-content` reaches neither of them. Leave both alone.

```tsx
/* src/ui/Releases.tsx:234 — current */
<details className="group border-line-muted border-t">
  <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-1.5 …">
```

The person page makes it worst: four groups, and shutting Forked jumps the page by
several hundred pixels with nothing to say where the rows went. AUDIT §8 names exactly
this — a state change that teleports where a brief transition would prevent a jarring
change.

## Target

One class, `t-fold`, added to each `<details>`. Height is animated with
`interpolate-size: allow-keywords`, which lets `height: auto` be a transition endpoint,
and `transition-behavior: allow-discrete` carries `content-visibility` across the change
so the closing rows stay painted while they shrink. Transitions rather than keyframes,
because a fold is reversible mid-motion: AUDIT §4.

```css
/* target — append to src/ui/motion.css, after the `.t-turn` block */

/**
 * A fold, which opens rather than appearing.
 */
:is(#gitquiet-root, [data-gitquiet-outside]) .t-fold {
  --fold-dur: var(--duration-quick);
  --fold-ease: var(--ease-in-out);
  interpolate-size: allow-keywords;
}

:is(#gitquiet-root, [data-gitquiet-outside]) .t-fold::details-content {
  height: 0;
  overflow: hidden;
  opacity: 0;
  transition:
    height var(--fold-dur) var(--fold-ease),
    opacity var(--fold-dur) var(--fold-ease),
    content-visibility var(--fold-dur) allow-discrete;
}

:is(#gitquiet-root, [data-gitquiet-outside]) .t-fold[open]::details-content {
  height: auto;
  opacity: 1;
}
```

Reduced motion keeps the opacity and drops the movement, which is what AUDIT §6 asks for
and what every other rule in that block does:

```css
/* target — inside the existing @media (prefers-reduced-motion: reduce) block */
:is(#gitquiet-root, [data-gitquiet-outside]) .t-fold::details-content {
  transition: opacity var(--fold-dur) var(--fold-ease);
  height: auto;
}
```

Durations: 150ms, from `--duration-quick`. AUDIT §2 budgets dropdowns at 150–250ms and a
fold inside a card is smaller than a dropdown, so the quick lane is the right one. Do not
invent a new duration token.

## Repo conventions to follow

- Every animating class lives in `src/ui/motion.css` and is named `t-…`. The rule that
  animates is scoped with `:is(#gitquiet-root, [data-gitquiet-outside])`. Exemplar: the
  `.t-turn` block at `src/ui/motion.css:741`.
- The token declarations are the exception, and they sit on the class itself with no
  scope, the way `.t-card` does at `src/ui/motion.css:762`, so a copy portalled outside
  the root carries its own values.
- `src/ui/motion.test.ts` asserts the contract of this sheet — no raw milliseconds in a
  rule, no `will-change`, and a reduced-motion rule for each animating class. Read it
  before writing, and add the `t-fold` case to it.

## Steps

1. `src/ui/motion.css` — add the `.t-fold` block exactly as written above, immediately
   after the `.t-turn` block that ends at line 747.
2. `src/ui/motion.css` — inside the existing `@media (prefers-reduced-motion: reduce)`
   block that starts at line 984, add the reduced-motion rule above, beside the `.t-turn`
   neighbours.
3. `src/ui/motion.test.ts` — add a case proving `.t-fold::details-content` is declared and
   that the reduced-motion block names it. Follow the shape of the cases already there.
4. Add `t-fold` to the `className` of the `<details>` element in each of these files, and
   change nothing else on the element: `src/ui/Releases.tsx`, `src/ui/Commits.tsx`,
   `src/ui/Checks.tsx`, `src/ui/Conversation.tsx` (both) and
   `src/ui/PersonReposScreen.tsx`. Find every one with `rg -n '<details' src/ui`, which
   answers with those six and nothing in `CheckSteps.tsx` or `LogPanel.tsx`.

## Boundaries

- Do NOT replace `<details>` with state and a `div`. The native element is deliberate:
  the browser's own find-on-page opens it.
- Do NOT animate `margin`, `padding` or `max-height` (AUDIT §5). `height` with
  `interpolate-size` is the whole point of this plan.
- Do NOT add a dependency and do NOT touch `stack.css` or `quiet.css`.
- If `::details-content` turns out to be unsupported in the browser under test, STOP and
  report rather than falling back to a JS height measurement.

## Verification

- **Mechanical**: `bun run compile`, `bun run lint`, `bun test src/ui/motion.test.ts`,
  `bun test src/ui/personReposScreen.test.tsx` — all pass. The screen tests read
  `details.open` and must be unaffected.
- **Feel check**: `bun run build`, load `.output/chrome-mv3`, open
  `https://github.com/flazouh?tab=repositories`, then
  - shut Quiet and confirm the rows collapse rather than vanish, and that the page below
    does not jump;
  - press the same heading four times quickly and confirm the fold reverses from wherever
    it had got to, never restarting from zero — that is the transition-versus-keyframes
    check;
  - Animations panel at 10% playback: the chevron and the height move together and end
    together;
  - Rendering panel, `prefers-reduced-motion: reduce`: the rows fade but the height snaps.
- **Done when**: every `<details>` under `src/ui` carries `t-fold`, and shutting a group
  on the person page is a movement rather than a jump.
