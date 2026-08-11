/**
 * The addresses on GitHub that this extension draws a page of its own for, named
 * once so that the shell, the screens and the interface cannot disagree.
 *
 * A pull request is recognised by {@link fromPathname} on its own reference. This
 * is the other one: the list of everything waiting on the reader, which GitHub
 * calls the pull request dashboard and serves under several addresses.
 */

/**
 * The dashboard, at any of the addresses GitHub shows it under.
 *
 * `/pulls` is the one they link to and the one they serve; the moment their own
 * app is running it replaces that with `/pulls/inbox`, and their other views —
 * reviews requested, assigned, mentioned — are addresses under it too. All of
 * them draw the same list here, because the Courts are read from GitHub rather
 * than from the path.
 *
 * Not a repository's own list at `/owner/repo/pulls`, which is a different page
 * with its own screen, and not `/pullsomething` either.
 */
export const isDashboard = (path: string): boolean =>
  /^\/pulls(\/|$)/.test(path);

/**
 * Where to send a reader who asks for that list.
 *
 * Their canonical address rather than the one their app rewrites it to: this is
 * the only one they document, it is what their own nav links to, and a reload of
 * it lands exactly where a reader would expect.
 */
export const THE_DASHBOARD = "/pulls";

/**
 * The home dashboard: the root of the site, and the alias GitHub serves it under.
 *
 * Both, because they are the same page. `scripts/probe-home-dom.js` read the two
 * live and they differ only in `route-pattern` — `/` against `/dashboard(.:format)`
 * — with the same controller, the same action and the same DOM to the element. A
 * reader who typed the alias would otherwise land on the page this replaces.
 *
 * Tighter than it looks on purpose. This is the address every soft navigation on
 * GitHub passes through, so one character of slack claims pages that are nobody's
 * business here: `/dashboards`, a repository owned by somebody called `dashboard`,
 * and the feed at `/feed`, which is its own page with its own screen to come.
 */
export const isHome = (path: string): boolean =>
  /^\/(dashboard\/?)?$/.test(path);

/**
 * Where to send a reader who asks for home.
 *
 * The root rather than the alias: it is one character, it is what their own logo
 * links to, and it is the address a reader would type.
 */
export const THE_HOME = "/";

/**
 * Every address the Working Set is the page at.
 *
 * Both of them, and one screen for the two. The list is read from GitHub rather than
 * from the path, so what changes between `/pulls` and `/` is which of GitHub's regions
 * it is drawn into — a place, which the shell and the screen both look up — and nothing
 * about the list itself. Home showing this list first is the whole of what
 * `docs/spec/home.md` asks for on arrival.
 *
 * Asked as one question so the two cannot drift. The shell reads it to decide what to
 * gate, the screen reads it to decide whether it is still the page on the screen, and a
 * third address added to either pattern is a third address both of them agree about.
 */
export const showsWorkingSet = (path: string): boolean =>
  isDashboard(path) || isHome(path);
