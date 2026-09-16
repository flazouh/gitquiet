import { BAR_ON_PAGE } from "./barSlot"
import { OUTSIDE, PAGE } from "./mount"
import { HOST_ID } from "./theHost"
import type { Place } from "./place"

/**
 * The rules that keep GitHub's version of a page off the screen, written from the
 * same table the interface uses to find where to stand.
 *
 * They were three hand-written stylesheets, and every one of them named a region
 * `place.ts` also named. That is one fact in two places, and in July it cost a
 * measured 587 milliseconds of GitHub's own list on the screen: their list moved
 * from `#repo-content-pjax-container` into its Turbo frame, `findSlot` coped
 * because the frame was in its table, and both CSS rules — which knew only the
 * first id — quietly matched nothing at all.
 *
 * So the selectors live in one table and the sheets are generated from it by
 * `scripts/build-gates.ts`. A region added, moved or renamed reaches the rules and
 * the search together or not at all.
 */


/**
 * One rule, once. Kept as a helper because three sheets still emit one apiece and
 * a selector written twice is a rule read twice.
 */
const block = (selectors: ReadonlyArray<string>): string => {
  const once = [...new Set(selectors)]
  return once.length === 0 ? "" : `${once.join(",\n")} {\n  display: none;\n}\n`
}

/**
 * What hides their page on a load of it, in two states.
 *
 * Before anything of ours is up, because a stylesheet a content script declares
 * is applied before the document is displayed — the one hook early enough to beat
 * a server-rendered page onto the screen. And for as long as ours is in charge,
 * because their React goes on inserting children into that region for the life of
 * the page and an observer only ever notices after they have been painted.
 *
 * The first set names the page it is for, which is what makes one sheet safe to put
 * on all of them: they hide by default, and the hooks are not as particular as they
 * look — an issue, a discussion and a release all have a `PageLayoutContent`, and a
 * rule that hid it by default would blank three pages of GitHub this extension has
 * no business with. The attribute is set from the address by `markPage`, at
 * `document_start`, before anything is displayed.
 *
 * The second set is not keyed, deliberately. It only applies while one of these
 * screens is in charge of the document, which never happens on a page that is not
 * one of them — so the page name adds nothing, and keying it would take the rules
 * away in the one moment they are load-bearing: a reader leaving a pull request for
 * a list, where the name changes to the destination while the card is still standing
 * on the screen. Their conversation would come back underneath it.
 */
export const loadSheet = (_places: ReadonlyArray<Place>): string =>
  [
    "/* Their page, for as long as one of ours is drawn over it. */",
    block([`html[${PAGE}] body > *:not(#${HOST_ID}):not([${OUTSIDE}])`])
  ].join("\n")

export const softSheet = (_places: ReadonlyArray<Place>): string =>
  "/* Nothing. A soft navigation changes which screen stands on the stage, and the\n   stage is ours either way — there is no region of theirs to gate in between. */"

export const barSheet = (): string =>
  [
    "/* Their bar. Ours is inside the host now, so this is the only one left to hide. */",
    block([`html[${BAR_ON_PAGE}] header.GlobalNav`])
  ].join("\n")

/** What the generated files say at the top, so nobody edits one by hand. */
export const PREAMBLE = `/*
 * Generated from src/ui/place.ts by scripts/build-gates.ts. Do not edit.
 *
 * Every selector here is one an interface also uses to find where to stand, and
 * the two must never drift: a rule naming a region the interface no longer looks
 * in hides nothing, which a reader sees as GitHub's own page for as long as the
 * takeover takes.
 *
 * Run \`bun scripts/build-gates.ts\` after changing that table. \`bun test\` fails
 * if this file is out of date.
 */
`
