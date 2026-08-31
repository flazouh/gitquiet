/**
 * When each of GitHub's pages was last read off the live document, and how to read it
 * again.
 *
 * Every selector in `place.ts` was copied from a real page by a `probe-*-dom.js` script,
 * and a fixture in a test was copied from the same print. Both rot the same silent way:
 * GitHub moves the markup, the copy stays as it was, and nothing in the tests knows,
 * because a test proves a fixture against itself. A green suite is not proof the page
 * still looks like the fixture — only the live canary is.
 *
 * This is the ledger that keeps that honest. One row per probe, carrying the day its
 * output was last refreshed from live and, where the page has a plain address, the URL
 * the canary reloads to check it. `probedPages.test.ts` fails if a probe has no row, so a
 * page cannot be probed and then forgotten; the canary reads the URLs; and the dates say
 * out loud how old the youngest guarantee really is.
 */

export type ProbedPage = {
  /**
   * The probe that reprints this page's DOM, refreshing the selectors and the fixture.
   * Absent on a canary-only row: a page reached by a stable URL and checked live, whose
   * selectors were read ad hoc rather than by a dedicated `probe-*-dom.js`.
   */
  readonly probe?: string
  /** The day its output was last taken from live GitHub, `YYYY-MM-DD`. */
  readonly capturedOn: string
  /** A plain-English name for the page, for a report to read. */
  readonly page: string
  /**
   * The place in `place.ts` this page's takeover is, where the canary can look its
   * selectors up. Absent for a probe that reads furniture rather than a whole screen.
   */
  readonly place?: string
  /**
   * A live address the canary can reload and check, for a page named by a plain URL.
   * Absent where the page needs a repository, a pull request or an issue to exist.
   */
  readonly url?: string
}

export const PROBED_PAGES: ReadonlyArray<ProbedPage> = [
  {
    probe: "scripts/probe-home-dom.js",
    capturedOn: "2026-08-31",
    page: "home dashboard",
    place: "home",
    url: "https://github.com/"
  },
  {
    probe: "scripts/probe-pulls-dom.js",
    capturedOn: "2026-08-12",
    page: "pull request dashboard",
    place: "dashboard",
    url: "https://github.com/pulls"
  },
  {
    probe: "scripts/probe-notifications-dom.js",
    capturedOn: "2026-08-13",
    page: "notifications",
    place: "notifications",
    url: "https://github.com/notifications"
  },
  {
    probe: "scripts/probe-header-dom.js",
    capturedOn: "2026-08-12",
    // Their bar is `barSheet()`, not a place, so the canary has no place to assert it
    // against; home reloads the same address and covers the freshness of this page.
    page: "global header and bar"
  },
  {
    probe: "scripts/probe-repo-list-dom.js",
    capturedOn: "2026-08-12",
    page: "a repository's pull request and issue lists"
  },
  {
    probe: "scripts/probe-repo-nav-dom.js",
    capturedOn: "2026-08-12",
    page: "a repository's navigation row"
  },
  {
    probe: "scripts/probe-commits-dom.js",
    capturedOn: "2026-08-12",
    page: "a pull request's commits"
  },
  {
    probe: "scripts/probe-run-dom.js",
    capturedOn: "2026-08-12",
    page: "an Actions run"
  },
  {
    probe: "scripts/probe-stack-dom.js",
    capturedOn: "2026-08-12",
    page: "a pull request stack"
  },
  {
    probe: "scripts/probe-flicker-dom.js",
    capturedOn: "2026-08-12",
    page: "takeover timing, no single page"
  },
  {
    // Canary-only: a nested page that carries bands, checked at a permanent address so
    // a rename of its header or tab strip goes red on a schedule and not only in the
    // field. PR #1 of a large public repository never disappears and renders in the
    // current layout. Added the day GitHub reworded this page's tab strip.
    capturedOn: "2026-09-01",
    page: "a pull request",
    place: "conversation",
    url: "https://github.com/facebook/react/pull/1"
  }
]

/** Past this many days a captured page is old enough to be worth reprobing. */
export const STALE_DAYS = 90
