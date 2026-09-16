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

## What shipped, and what the prototype got wrong

All of it shipped. The screens stand on a stage in a shadow root of our own, one
rule hides their page, their stylesheets go off while we hold it, and `bands`,
`regions`, `stages`, `fallback`, `gateAudit.ts`, `coarsen` and the canary are
gone. Measured on the same live pull request afterwards: **0.018 ms** a mutation
against 9.485 ms before, with sixty-nine of their stylesheets disabled and no
faults reported.

The prototype was right about the shape and wrong about the bar, and the wrong
half cost more than the right half saved.

**The bar never had to move.** The prototype hid it and read that as proof it
belonged inside the host. The rule it was tested against was written by hand and
said `body > *:not(#gq-host)`; the real generated rule has always said
`:not([data-gitquiet-outside])` as well, and the bar has always carried that
mark. Moving it in — with the overlay hosts — broke a hundred tests and bought
nothing. Both are back in `body`.

**Three faults only running it could find:**

- `document.body` does not exist at `document_start`. Reaching for it threw out
  of the first render and left a page the gate had already emptied with nothing
  in it. The host waits on `documentElement` and moves when there is a body.
- The host was rebuilt every time anything replaced `body`'s children, which
  their Turbo does on every soft navigation — a new shadow root, a new stage, a
  new bar slot, and every React portal still pointing into the old one. Eight
  hosts in one test file. It is remembered per document and put back.
- `rootIn` looked only inside the shadow root, so a container appended straight
  into `body` by a caller that never asked for a stage became invisible: the
  screen was on the page with nothing able to see it, and the bar it drew never
  came down. It asks our tree first and the document after.

**The hazards that did not bite:** Tailwind's preflight needed nothing beyond
rewriting `:root` to `:host` on the sheet text; `<diffs-container>`'s own shadow
roots nest inside ours without complaint; and the portals never had to move,
because the elements they portal into never left `body`.

## The cheap half, for the record

Disabling their stylesheets was 97% of the win and is reversible with one
property. It could have been done where the interface stood before anything
moved — worth remembering the next time a change this size is weighed.
