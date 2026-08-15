# 003 — Bring the toasts into the motion system

- **Status**: TODO
- **Commit**: 0f6ad71
- **Severity**: MEDIUM
- **Category**: Accessibility (§6) and Cohesion (§7)
- **Estimated scope**: 1 file, plus one rule in `motion.css`

## Problem

Toasts are the one surface in this extension whose motion nobody here chose. `src/ui/Toasts.tsx`
dresses Sonner's markup thoroughly — fill, shadow, ink, every class carrying `!` to outweigh
their attribute selectors — and says nothing at all about how a toast arrives or leaves. So
they slide and fade on Sonner's own defaults, at Sonner's duration and curve, and they are
outside the `prefers-reduced-motion` block at `src/ui/motion.css:984` that every other
animating surface here obeys. A reader who has asked the operating system for less motion
still gets a panel sliding in from the corner.

```tsx
/* src/ui/Toasts.tsx:37 — current: the whole visual contract, and no motion in it */
const LOOK = {
  toast:
    "!w-auto !gap-2 !rounded-md !border-0 !bg-raised !px-3 !py-2 !font-sans !text-xs !text-ink !shadow-pop",
  …
} as const
```

## Target

Sonner reads its own timing from CSS custom properties on the toaster element, so the fix is
a declaration rather than a rewrite: point them at this repo's tokens, and add the
reduced-motion rule. A toast is an occasional surface (AUDIT §1), so it keeps its motion —
what changes is that the motion is this product's motion.

```css
/* target — append to src/ui/motion.css, after the `.t-modal` block */

/**
 * The toasts, whose motion is Sonner's and whose vocabulary is ours.
 */
[data-sonner-toaster] {
  --toast-dur: var(--duration-fast);
  --toast-ease: var(--ease-out);
}

[data-sonner-toast] {
  transition:
    transform var(--toast-dur) var(--toast-ease),
    opacity var(--toast-dur) var(--toast-ease);
}

@media (prefers-reduced-motion: reduce) {
  [data-sonner-toast] {
    /* The sentence is the point. What goes is the sliding. */
    transform: none !important;
    transition: opacity var(--toast-dur) var(--toast-ease);
  }
}
```

`--duration-fast` is 250ms (`src/ui/motion.css:41`), which is the lane every other arriving
surface here uses and sits inside AUDIT §2's 200–500ms budget for a floating panel.

Sonner's own props are the second half: pass `duration` for how long a toast stays, and do
not confuse it with how long it takes to arrive. Leave the stay as it is unless it is
already wrong.

## Repo conventions to follow

- Rules for surfaces that render outside `#gitquiet-root` are declared on the surface's own
  hook rather than under the root scope, because a portal is not inside it. Exemplar:
  `.t-dropdown` at `src/ui/motion.css:777`, which redeclares its tokens on the class for
  exactly this reason.
- `src/ui/motion.test.ts` guards this sheet. Add the toast case to it: a reduced-motion rule
  must name `[data-sonner-toast]`.
- Toast dressing belongs in `src/ui/Toasts.tsx`; motion belongs in `src/ui/motion.css`. Keep
  the split.

## Steps

1. Read `src/ui/Toasts.tsx` in full and confirm no motion class or `duration` prop is already
   set on `<Toaster>`. If one is, STOP and report.
2. `src/ui/motion.css` — add the three blocks above after the `.t-modal` block, which ends at
   line 861.
3. `src/ui/motion.test.ts` — add a case asserting the reduced-motion block names
   `[data-sonner-toast]`.
4. Confirm in the browser that Sonner is not overriding the transition with an inline style.
   If it is, add `!important` to the two declarations in the reduced-motion block only, and
   record why in a comment.

## Boundaries

- Do NOT replace Sonner or add an animation dependency.
- Do NOT change where toasts appear, how long they stay, or any class in `LOOK`.
- Do NOT touch `src/ui/settled.tsx`, whose `t-drawn` tick is already in the system and
  already has a reduced-motion rule at `src/ui/motion.css:1095`.

## Verification

- **Mechanical**: `bun run compile`, `bun run lint`, `bun test src/ui/motion.test.ts` — pass.
- **Feel check**: `bun run build`, load `.output/chrome-mv3`, open a pull request, and cause a
  refusal — the quickest is to settle a thread while signed out, which fails and toasts. Then
  - confirm the toast arrives with the same weight as a dropdown rather than faster or slower;
  - raise three toasts in a row and confirm the stack re-flows without any of them restarting;
  - Rendering panel, `prefers-reduced-motion: reduce`: the toast fades in place and does not
    slide.
- **Done when**: a toast's arrival and a menu's arrival are the same duration and the same
  curve, and reduced motion leaves the toast still readable and still announced.
