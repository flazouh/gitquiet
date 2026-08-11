/**
 * Every name this product writes into somebody else's storage, in one place.
 *
 * Four modules were each holding a `const KEY` of their own, in three
 * conventions: `gitquiet.scheme` with a dot, `gitquiet:filter:` with colons,
 * and settings under the bare word `settings`. Nothing was broken by that, and
 * that is the point — the cost of scattered names is not a collision, it is that
 * nobody can answer "what does this app keep, and where" without reading four
 * files, and the answer is needed every time a reader asks to be forgotten.
 *
 * The extension writes these into `browser.storage.sync`, which is its own
 * namespace, and the window writes them into `localStorage` on the page it owns.
 * The prefix earns its keep in the second case: the browser extension shares
 * `storage.sync` with nothing, but a webview's `localStorage` is one flat space
 * that the diff engine, a dependency, or a later feature can all write into.
 */

/**
 * Nothing here reads an older spelling, on purpose.
 *
 * Settings used to sit under the bare word `settings`, and every name below was
 * spelled `githubpro.` before the product was. Both moves orphan what a reader
 * already had, and neither is being carried forward: the app is pre-release, and
 * what is lost is a filter worth one keystroke, a light-or-dark choice worth one
 * press, and a cache that is refilled by the read happening anyway. A fallback
 * would be two names alive in the code for years to save that.
 */

/** One prefix, because a key of ours should be recognisable as ours at a glance. */
const OURS = "gitquiet."

/** The reader's choices: theme, diff layout, tree width. */
export const SETTINGS = `${OURS}settings`

/**
 * Light or dark, written for the sake of the first paint rather than as the
 * durable choice — that is `SETTINGS`. `desktop/src/view/index.html` reads this
 * name synchronously in the head, so it is the one name here with a copy that
 * cannot import it.
 */
export const SCHEME = `${OURS}scheme`

/**
 * Which pack, for the sake of that same first paint.
 *
 * Light or dark alone cannot colour a frame: the reader picks a pack too, and
 * the two together are what `tokensOf` needs. Written beside `SCHEME` rather
 * than folded into it because the desktop head script reads that one name and
 * cannot import this file to learn a new shape for it.
 */
export const PACK = `${OURS}pack`

/**
 * The filter left in the box, per list: `gitquiet:filter:working-set`.
 *
 * The one name that does not follow the dots. Kept as a colon form because that
 * is how filters were first written; only the product prefix changed with the
 * rename from githubpro.
 */
export const FILTER = "gitquiet:filter:"

/** The repositories most recently read, so the switcher opens on the few that are used. */
export const LATELY = `${OURS}lately`

/** The last list drawn, so a launch has something to show while GitHub answers. */
export const KEPT_ROWS = `${OURS}kept.rows`

/** One cached card per pull request, by `owner/repo#number`. */
export const KEPT_CARD = `${OURS}kept.card.`

/**
 * Every repository the reader has, as the last read left it, for the switcher in
 * the bar.
 *
 * The extension store holds the same list. This copy earns its place by being
 * readable synchronously: each screen is its own bundle, so arriving at one
 * builds a new bar, and a bar that has to wait for a read draws no chevron until
 * it lands. See `keptRepositories.ts`.
 */
export const KEPT_REPOSITORIES = `${OURS}kept.repositories`

/** Which pull requests have been opened, for the unread dot. */
export const KEPT_SEEN = `${OURS}kept.seen`

/**
 * Words typed into a box and not yet sent, one key per subject.
 *
 * A prefix rather than one key, so a draft on an issue and a draft on a pull request cannot
 * overwrite each other and so every waiting draft can be listed. See `held.ts`.
 */
export const HELD = `${OURS}held.`

/** One durable Review Pass per pull request. See `passes.ts`. */
export const PASSES = `${OURS}passes.`

/**
 * The last verdict this reader sent, one key per pull request.
 *
 * Kept because GitHub does not hand a comment-only review back: their payload carries the
 * "opinionated" ones, an approval and a request for changes, and nothing at all about a review
 * that only said something. Without this, a reader who commented and reloaded is told they have
 * not read the pull request. See `verdicts.ts`.
 */
export const SAID = `${OURS}said.`
