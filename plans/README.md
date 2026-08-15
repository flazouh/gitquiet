# Animation plans

Written by the `improve-animations` audit against commit `0f6ad71`. Each plan is
self-contained: an executor with no other context can carry one out.

The audit's short version: this repo's motion is already unusually disciplined. One
vocabulary in `src/ui/motion.css`, no `transition: all`, no `ease-in`, no `scale(0)`, no
`will-change`, and a `prefers-reduced-motion` block that names nearly every animating class.
Nothing here is a rescue. The four plans are the four places where something sits outside
that system.

| # | Title | Severity | Category | Status |
| --- | --- | --- | --- | --- |
| [001](001-tokenise-three-stray-transitions.md) | Put the three untokened transitions back in the vocabulary | MEDIUM | Cohesion & tokens | TODO |
| [002](002-fold-open-instead-of-teleport.md) | Make every fold open rather than teleport | MEDIUM | Missed opportunities | TODO |
| [003](003-bring-the-toasts-into-the-system.md) | Bring the toasts into the motion system | MEDIUM | Accessibility, cohesion | TODO |
| [004](004-let-the-modals-leave.md) | Let the modals leave the way the menus do | LOW | Interruptibility, cohesion | TODO |

## Order

1. **001** first. It is three class strings, it touches no shared CSS, and it cannot
   conflict with anything below.
2. **002** next, and it is the one a reader will notice: it is the only plan that changes how
   the person page behaves, which is the page the folds were added to.
3. **003** and **004** in either order. Both add rules to `src/ui/motion.css` and a case to
   `src/ui/motion.test.ts`, so run them one after the other rather than in parallel.

## Dependencies

- 002, 003 and 004 all append to `src/ui/motion.css` and all add a case to
  `src/ui/motion.test.ts`. Two executors working at once will conflict in both files.
- Nothing here depends on another plan's outcome.

## What the audit deliberately did not report

- `transform-origin: center` on the modals. Correct there, and the playbook exempts it.
- The star's bounce in `src/ui/Star.tsx`. It is the one place in the extension that spends
  `--ease-bounce`, on a rare and deliberate act, which is what a delight budget is for.
- The 1.4s shimmer and the 1s spinner. Both are constant motion on a wait, both are
  `linear`, and both are stopped under reduced motion.
- `data-snap`, which takes the animation off a keyboard dismissal. That is the playbook's own
  first rule about frequency, already implemented.
