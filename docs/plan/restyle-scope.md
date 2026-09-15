# The cost of standing in their document

`WITHIN` in `src/ui/mount.ts` promises this file. Here it is, with the numbers.

## What was measured

A live pull request — `fluentai-pro/fluentai#2705`, signed in, the built extension
loaded — with the real interface on the page. One mutation is an element appended
into our own tree, its `offsetHeight` read to force style and layout, then removed
and read again. Four hundred of those, timed through `Performance.getMetrics`, so
the figure is style recalculation attributable to the mutation and nothing else.

Two variables, crossed: whether our interface stands in the document or inside a
shadow root of its own, and whether GitHub's stylesheets are enabled.

|                      | their CSS on | their CSS off |
| -------------------- | -----------: | ------------: |
| in the document (today) |    9.485 ms |      0.036 ms |
| in a shadow root        |    5.105 ms |      0.022 ms |

Wall clock for the four hundred: 3901 ms, 64 ms, 2098 ms, 24 ms.

## What that says

**Their stylesheets are the cost, not ours.** Seventy-one of them. Turning them
off, changing nothing else, takes a mutation from 9.485 ms to 0.036 ms — two
hundred and sixty times. Our own sheet is ninety kilobytes and seven hundred and
sixty-nine rules, and it is not what makes a keystroke expensive.

**A shadow root is worth less than it looks.** It stops their selectors matching
our elements, which is half the story, and it does not stop the work their sheets
do when the document changes underneath them — sixty-odd `:has()` rules whose
subjects are `body` and `main`. So it buys 46%, not the 99% the isolation
suggests. Measured against a detached clone it looked like a total win; against
the real tree, laying out real content, it is 9.485 → 5.105.

**Together they are 0.022 ms**, four hundred and thirty times better than today.
Most of that is the sheets. The shadow root is the last 40% and the reason their
CSS cannot bleed into ours.

## What it suggests the shape should be

One host element, a child of `body`, owning a shadow root; the whole interface
inside it. Hiding becomes one rule that names nothing of theirs:

    body > *:not(#gq-host) { display: none }

and their stylesheets are disabled for as long as we own the route, put back when
we hand it over. What that deletes is the point: `bands` and `regions` from
`place.ts`, `gateAudit.ts` entirely, `coarsen`, `isOurs`, the generated region
rules in `gates.*.css`, and the `WITHIN` chain that exists only because our root
stands inside their layout. None of it can rot, because none of it reads their
markup. The only things left pointing at GitHub are the URL and the JSON.

## Proved, and the part that is not

A prototype moved the live React tree into a shadow root on the real page, adopted
our sheet into it (`:root` rewritten to `:host` for the variables), disabled their
sheets and hid the rest of the document with the rule above. It drew correctly —
the file tree, the diff, the merge card, the checks, the fonts — at 0.022 ms a
mutation. The screenshot is the whole page and it is ours.

One thing broke, and it is the honest warning: **the bar disappeared.** It mounts
into GitHub's own header slot rather than into our root, so a rule that hides
everything that is not our host hides it too. The bar has to move inside the host
before any of this can ship.

The rest of the hazards, none of them measured yet:

- React portals that go to `document.body` land outside the shadow root and lose
  every style. They have to portal to the shadow root instead.
- GitHub adds stylesheets on a soft navigation, so disabling once is not enough —
  the sheets have to be caught as they arrive, and put back on the way out.
- Tailwind's preflight is written against `html` and `body`, which a shadow root
  does not have. It needs `:host` equivalents.
- `<diffs-container>` already attaches its own shadow root inside ours. Nested is
  fine in principle; it has not been tried under this arrangement.
- Whatever of theirs we deliberately keep — anything marked `OUTSIDE` — needs a
  home that the one rule does not sweep away.

## The cheap half

If the shape above is too much at once, the ordering is obvious from the table:
disabling their stylesheets is 97% of the win and is reversible with one property.
It can be done where the interface stands today, before anything moves.
