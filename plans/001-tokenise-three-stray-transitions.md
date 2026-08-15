# 001 — Put the three untokened transitions back in the vocabulary

- **Status**: TODO
- **Commit**: 0f6ad71
- **Severity**: MEDIUM
- **Category**: Cohesion & tokens
- **Estimated scope**: 3 files, one class string each

## Problem

`src/ui/motion.css` declares one duration and easing vocabulary and `src/ui/motion.test.ts`
guards it. Three components animate outside that vocabulary: they write a bare Tailwind
`transition-*` utility, which resolves to Tailwind's own defaults — 150ms with
`cubic-bezier(0.4, 0, 0.2, 1)` — rather than to this repo's tokens. Two of the three are
high-frequency: the file tree chevron and the row kebab are touched dozens of times in a
session.

```tsx
/* src/ui/RepoTree.tsx:506 — current */
className={`shrink-0 text-ink-muted transition-transform ${row.open ? "rotate-90" : ""}`}
```

```tsx
/* src/ui/Doings.tsx:266 — current */
className={`flex shrink-0 items-center rounded-md px-1 py-1 text-ink-muted transition-opacity hover:bg-hover hover:text-ink focus-visible:opacity-100 data-[state=open]:opacity-100 ${
  chosen ? "opacity-100" : "opacity-60 group-hover:opacity-100"
}`}
```

```tsx
/* src/ui/History.tsx:329 — current */
className={`flex items-center p-1 text-ink-muted opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 hover:text-ink ${PRESSABLE}`}
```

## Target

The chevron takes the same pair every other fold chevron in this repo takes. The two
opacity fades take the hover lane, which is 80ms — they are reveals under a pointer, and
`--duration-micro` is what every other hover in `motion.css:124` uses.

```tsx
/* src/ui/RepoTree.tsx:506 — target */
className={`shrink-0 text-ink-muted transition-transform duration-[var(--duration-quick)] ease-[var(--ease-in-out)] ${row.open ? "rotate-90" : ""}`}
```

```tsx
/* src/ui/Doings.tsx:266 and src/ui/History.tsx:329 — target: add to the existing class string */
transition-opacity duration-[var(--hover-dur)] ease-[var(--hover-ease)]
```

The tokens already exist and must not be redeclared:

```css
/* src/ui/motion.css:40 */
--duration-quick: 150ms;
/* src/ui/motion.css:51 */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
/* src/ui/motion.css:113-114 */
--hover-dur: var(--duration-micro); /* 80ms */
--hover-ease: var(--ease-out);
```

## Repo conventions to follow

- Motion values are never typed as numbers in a component. They are read from a token with
  Tailwind's arbitrary-value syntax.
- Exemplar to imitate exactly: `src/ui/Releases.tsx:238`

```tsx
className="shrink-0 transition-transform duration-[var(--duration-quick)] ease-[var(--ease-in-out)] group-open:rotate-90"
```

## Steps

1. `src/ui/RepoTree.tsx:506` — add `duration-[var(--duration-quick)] ease-[var(--ease-in-out)]`
   directly after `transition-transform`. Change nothing else on the element.
2. `src/ui/Doings.tsx:266` — add `duration-[var(--hover-dur)] ease-[var(--hover-ease)]`
   directly after `transition-opacity`.
3. `src/ui/History.tsx:329` — the same addition after `transition-opacity`.

## Boundaries

- Do NOT touch any other file, and do not add or rename a token.
- Do NOT change markup, props, or the opacity values themselves — only the transition
  duration and easing.
- If a line does not read as quoted above, STOP and report: the file has drifted since
  commit 0f6ad71.

## Verification

- **Mechanical**: `bun run compile`, `bun run lint`, then `bun test src/ui/motion.test.ts`
  — all three pass with no output.
- **Feel check**: `bun run build`, load `.output/chrome-mv3`, then
  - open a repository's front page, press a directory in the file tree, and confirm the
    chevron turns with the same weight as the fold chevron on the releases page;
  - hover a pull request row on `/pulls` and confirm the kebab fades in at hover speed
    rather than lagging behind the row's own tint;
  - in DevTools, Animations panel at 10% playback, confirm the chevron eases in and out
    rather than sliding linearly.
  - Rendering panel, `prefers-reduced-motion: reduce`: all three snap with no movement,
    which the catch-all at `src/ui/motion.css:1117` already does.
- **Done when**: no `transition-transform` or `transition-opacity` in `src/ui/*.tsx` is
  without a `duration-[var(--…)]` beside it. Check with
  `rg -n 'transition-(transform|opacity)(?![^"]*duration-\[)' src/ui --pcre2`.
