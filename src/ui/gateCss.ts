import { BAR_ID } from "./barSlot"
import { OUTSIDE, ROOT_ID } from "./mount"
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
 * Never this one: it is the interface the rules exist to show. Nor anything carrying
 * the outside mark — the bar, the hover-card hosts, the toaster live in `body` beside
 * the root rather than in it, and a screen whose stage is `body` itself would
 * otherwise hide its own furniture along with GitHub's page.
 */
const OURS = `:not(#${ROOT_ID}):not(:has(#${ROOT_ID})):not([${OUTSIDE}])`

/**
 * Whether a stage is the document's own surface rather than a region of GitHub's.
 *
 * It changes which rules a stage may have. A region of theirs is only ever theirs, so
 * a rule may hide its children for as long as ours is in charge. `body` is everybody's
 * — our hover hosts are made there mid-session, and other extensions stand there too —
 * so the only rule allowed on it is the pre-reveal flash cover, and the steady state
 * belongs to `hideTheirs`, which marks what stood there at the takeover and is re-run
 * by the takeover's own observer.
 */
const isTheSurface = (stage: string): boolean => stage === "body" || stage.startsWith("body:")

/**
 * Their children, rather than the region itself.
 *
 * The region is where ours stands, so hiding it hides ours the moment it is
 * appended — and on a soft navigation our root is a grandchild rather than a
 * child, which is what the second half of {@link OURS} is for: a box holding our
 * interface is never a box to hide.
 */
const emptied = (stage: string): string => `${stage} > *${OURS}`

/**
 * One rule, once. Two of a place's stages can say the same thing after scoping —
 * the region named with their app element and the same region named without it are
 * one selector under that app — and a rule repeated is a rule read twice.
 */
const block = (selectors: ReadonlyArray<string>): string => {
  const once = [...new Set(selectors)]
  return once.length === 0 ? "" : `${once.join(",\n")} {\n  display: none;\n}\n`
}

const stagesOf = (place: Place): ReadonlyArray<string> => place.stages ?? place.regions

/** The app element a selector names, where it names one. */
const appIn = (selector: string): string | undefined =>
  /app-name="([^"]+)"/.exec(selector)?.[1]

/**
 * Puts a selector under the ancestor that proves their page is rendered, unless it
 * already says so itself.
 *
 * Two of these selectors carry their own `react-app` — `place.ts` scopes them that
 * way because a class name alone would match the wrong page — and prefixing one
 * with the same element again asks for an app inside an app, which is a rule that
 * matches nothing. A selector naming a *different* app is not this page's business
 * at all: the band GitHub puts above a commit's diff belongs to a page nothing
 * soft-navigates to, and scoping it under their pull request app was a rule that
 * could never fire.
 */
const beneath = (within: string | undefined, selector: string): string | undefined => {
  if (within === undefined) return selector
  if (selector === within || selector.startsWith(`${within} `)) return selector

  const theirs = appIn(within)
  const its = appIn(selector)
  if (theirs !== undefined && its !== undefined && its !== theirs) return undefined

  return `${within} ${selector}`
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
export const loadSheet = (places: ReadonlyArray<Place>): string =>
  places
    .map((place) => {
      const theirs = [...stagesOf(place).map(emptied), ...place.bands]
      const standing = [
        ...stagesOf(place)
          .filter((stage) => !isTheSurface(stage))
          .map(emptied),
        ...place.bands
      ]
      const here = `html[data-gitquiet-page="${place.name}"]`
      return [
        `/* ${place.name}: before ours is up. */`,
        block(theirs.map((one) => `${here}:not([data-gitquiet-revealed]) ${one}`)),
        `/* ${place.name}: for as long as ours is in charge. */`,
        block(standing.map((one) => `html[data-gitquiet-taken] ${one}`))
      ].join("\n")
    })
    .join("\n")

/**
 * What hides their page on a navigation that loaded no document.
 *
 * GitHub swaps the page in place, so no content script match is tested and the
 * interface for the page arrived at is not there to hide anything. This ships with
 * the one script that runs on every GitHub page, and is keyed on an attribute that
 * is *set* on the press rather than one that is missing — the opposite of the sheet
 * above, and for the plainest reason: hiding by default here would hide the site.
 *
 * Every rule waits for proof that their version of the destination is rendered.
 * The press happens while the page being left is still on the screen, and a rule
 * that acted immediately would blank the page a reader is still reading for as
 * long as GitHub took to fetch the next one.
 */
export const softSheet = (places: ReadonlyArray<Place>): string =>
  places
    .filter((place) => place.soft !== undefined)
    .map((place) => {
      const soft = place.soft!
      const holding = soft.holding ?? ""
      const under = (selectors: ReadonlyArray<string>): ReadonlyArray<string> =>
        selectors
          .map((one) => beneath(soft.within, one))
          .filter((one): one is string => one !== undefined)

      const theirs = [
        ...under(stagesOf(place).map((stage) => `${stage}${holding}`)).map(emptied),
        ...under(place.bands)
      ]

      return [
        `/* ${place.name}: swapped in without a load. */`,
        block(theirs.map((one) => `html[data-gitquiet-gating] ${one}`))
      ].join("\n")
    })
    .join("\n")

/**
 * What hides GitHub's own bar, on every page one of ours stands on.
 *
 * Not a band on a place, and it took a measurement to see why: their bar is `header.GlobalNav`,
 * outside every region in the table, and `beneath` scopes a band under the ancestor that proves
 * their page is rendered — which for a pull request is their own `react-app`. Their bar is not
 * inside it, so the scoped rule would have matched nothing at all and a reader soft-navigating
 * to a pull request would have had two bars.
 *
 * Keyed on our bar being on the page rather than on the takeover having started. The page can
 * then never be left with no bar at all, which is what an attribute set at the press would do
 * for as long as the takeover took. `nav[aria-label="Repository"]` goes with it: their nav row
 * is inside that same header — measured by `scripts/probe-repo-nav-dom.js` — so one rule takes
 * both of their rows, and `theirNav.ts` reads the row out of the hidden element before our own
 * is drawn from it.
 */
export const barSheet = (): string =>
  [
    "/* Their bar, wherever ours is standing. */",
    block([`html:has(#${BAR_ID}) header.GlobalNav`])
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
