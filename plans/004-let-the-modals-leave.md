# 004 — Let the modals leave the way the menus do

- **Status**: TODO
- **Commit**: 0f6ad71
- **Severity**: LOW
- **Category**: Interruptibility (§4) and Cohesion (§7)
- **Estimated scope**: 1 CSS file, 2 components

## Problem

Menus and dropdowns here are deliberately asymmetric: 250ms in, 150ms out, which is the
right shape — the reader's own dismissal should feel quicker than the arrival. Modals were
given the arrival and not the departure. `.t-modal` animates in over 250ms and both dialogs
close by calling the platform's `close()`, so the sheet is on the screen in one frame and
gone in the next.

```tsx
/* src/ui/SettingsDialog.tsx:321 — current: the entrance class, and close() for the exit */
className="t-modal m-auto h-[34rem] … rounded-lg border border-line bg-canvas p-0 text-ink backdrop:bg-black/50"
```

```css
/* src/ui/motion.css:845 — current: in only */
:is(#gitquiet-root, [data-gitquiet-outside]) .t-modal {
  animation: t-modal-in var(--modal-dur) var(--modal-ease) both;
}
```

The same is true of `src/ui/CheckDialog.tsx:217`.

## Target

A leaving phase, mirroring `useMenuPhase`: the dialog takes a `data-leaving` attribute, the
sheet and the backdrop fade over 150ms, and `close()` runs when that time is up. 150ms comes
from `--duration-quick` and is the number `--menu-close-dur` already resolves to, so a sheet
and a menu leave at the same speed.

```css
/* target — append to the `.t-modal` block in src/ui/motion.css */
:is(#gitquiet-root, [data-gitquiet-outside]) .t-modal[data-leaving] {
  animation: none;
  opacity: 0;
  transform: scale(var(--scale-medium));
  transition:
    opacity var(--menu-close-dur) var(--menu-ease),
    transform var(--menu-close-dur) var(--menu-ease);
}

:is(#gitquiet-root, [data-gitquiet-outside]) .t-modal[data-leaving]::backdrop {
  opacity: 0;
  transition: opacity var(--menu-close-dur) var(--menu-ease);
}
```

`--scale-medium` is 0.97 and already declared (`src/ui/motion.css:74`); AUDIT §3 forbids
`scale(0)` and asks for 0.9–0.97, so reuse the token rather than typing a number. Centre is
the correct origin for a modal and must not change: AUDIT §3 exempts modals explicitly.

In both components:

```tsx
/* target — the shape to write, in each dialog component */
const leave = () => {
  const sheet = frame.current
  if (sheet === null) return
  sheet.setAttribute("data-leaving", "")
  window.setTimeout(() => {
    sheet.removeAttribute("data-leaving")
    sheet.close()
  }, millisOf("--menu-close-dur", 150))
}
```

Every path that closed the sheet calls `leave()` instead of `close()`, except Escape:
a keyboard dismissal snaps, which is the rule `data-snap` states at
`src/ui/motion.css:1074` and `useMenuPhase`'s `atOnce` implements.

## Repo conventions to follow

- Timers read their value from CSS rather than repeating it: `millisOf` in `src/ui/motion.ts:10`.
  Never type 150 as a literal except as its fallback argument.
- The leaving-attribute pattern already exists twice: `data-leaving` on `.t-waiting`
  (`src/ui/motion.css:446`, driven by `src/ui/useWaiting.ts`) and the phase machine in
  `src/ui/useMenuPhase.ts:45`. Read `useMenuPhase` first and imitate its shape, including its
  `atOnce` escape for keyboard dismissal.
- `src/ui/motion.test.ts` guards the sheet: add a case for the leaving rules.

## Steps

1. `src/ui/motion.css` — add the two `[data-leaving]` rules to the `.t-modal` block that
   begins at line 845.
2. `src/ui/motion.css` — inside the reduced-motion block at line 984, add
   `.t-modal[data-leaving] { transition: opacity var(--menu-close-dur) var(--menu-ease); transform: none; }`
   so the sheet fades without moving.
3. `src/ui/SettingsDialog.tsx` — add `leave()` as written above, and call it from every path
   that currently calls `frame.current?.close()` other than the platform's own `cancel`
   (Escape), which must stay instant.
4. `src/ui/CheckDialog.tsx` — the same change.
5. `src/ui/motion.test.ts` — add the case from step 1's rules.

## Boundaries

- Do NOT change `transform-origin` on a modal. Centre is correct there (AUDIT §3).
- Do NOT make Escape animate.
- Do NOT change the entrance duration, the sheet's size, or anything about the dialogs'
  content.
- Do NOT introduce a state variable where an attribute will do: the sheet is a DOM element
  the component already holds a ref to.

## Verification

- **Mechanical**: `bun run compile`, `bun run lint`, `bun test src/ui` — pass. Any test that
  asserts a dialog is gone immediately after a press will now need the timer to run; if one
  fails, make it wait for the sheet to be closed rather than shortening the animation.
- **Feel check**: `bun run build`, load `.output/chrome-mv3`, open Settings from the bar, then
  - press the close control and confirm the sheet shrinks slightly and fades over about a
    sixth of a second, with the backdrop going at the same time;
  - press Escape and confirm it is instant;
  - open and close five times quickly and confirm no sheet is ever left behind with the
    attribute still on it;
  - Rendering panel, `prefers-reduced-motion: reduce`: the sheet fades and does not scale.
- **Done when**: a modal leaves in `--menu-close-dur`, Escape stays instant, and nothing is
  left in the DOM carrying `data-leaving`.
