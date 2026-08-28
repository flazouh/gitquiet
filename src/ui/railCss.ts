/**
 * The rail's own CSS, written into the tree's shadow root.
 *
 * The lanes first. Theirs for the counts takes whatever room is left over and
 * clips what does not fit, which in a rail this narrow was most of the numbers.
 * The numbers are short and fixed; the names are long and truncate themselves,
 * so the names are what should give way. The git lane goes entirely: it spells
 * out A, M, D beside a name that the same status has already coloured, and
 * every folder in a rail of changed files contains a change, so its dot marks
 * nothing out. Its width goes back to the names.
 *
 * Then the folders a flattened row is made of. Each one is a span of its own in
 * one flex row, and every span gave way by the same share, so
 * `server/cfw-worker/src/lib/rules/normalize/catalog` came out as
 * `se…/cfw-…/…/…/r…/n…/catalo…`. Seven pieces, and not one whole word in them.
 * The row is there to say which folder the file sits in. That row said nothing.
 *
 * The last two folders are the row now. The ones above them go, and a single
 * `…/` at the front says that they went. A reader knows the row by its deepest
 * folder, so that one keeps the row's colour and gives way last. The folder
 * above it is drawn back and gives way first. A folder wider than the rail on
 * its own still truncates itself, which leaves the tree's own marker on it
 * rather than a hard edge against the counts.
 *
 * The row carries every folder in its label, so a screen reader still hears the
 * whole path. What goes is two things a reader could not read anyway: the text
 * of the folders above, and the click on each of them that opened it.
 *
 * The tree writes ` / ` between the spans as text of its own, and text is not
 * something CSS can hide, so a hidden folder would leave its slash behind. The
 * row drops to `font-size: 0` and each folder carries its own separator, which
 * goes when the folder goes.
 *
 * Both greys are mixed from the row's own colour rather than named, so a
 * selected or a hovered row draws its folders back from whatever it is wearing.
 */
export const RAIL_CSS =
  '[data-item-section="decoration"] { flex: 0 0 auto; }' +
  '[data-item-section="git"] { display: none; }' +
  '[data-item-flattened-subitems] { min-width: 0; gap: 0; font-size: 0; }' +
  '[data-item-flattened-subitems]:has([data-item-flattened-subitem]:nth-last-of-type(3))' +
  '::before { content: "\\2026/"; font-size: var(--trees-font-size); ' +
  'padding-inline-end: 2px; opacity: 0.6; }' +
  '[data-item-flattened-subitem] { display: inline-flex; align-items: center; ' +
  'min-width: 0; font-size: var(--trees-font-size); ' +
  'color: color-mix(in srgb, currentColor 60%, transparent); }' +
  '[data-item-flattened-subitem]:nth-last-of-type(n+3) { display: none; }' +
  '[data-item-flattened-subitem]:not(:last-of-type)::after ' +
  '{ content: "/"; padding-inline: 2px; flex: 0 0 auto; }' +
  '[data-item-flattened-subitem]:nth-last-of-type(2) { flex-shrink: 30; }' +
  '[data-item-flattened-subitem]:last-of-type { color: inherit; }'
