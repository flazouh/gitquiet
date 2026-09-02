import { GlobalRegistrator } from "@happy-dom/global-registrator"
import { afterEach, setDefaultTimeout } from "bun:test"
import { forgetFlights } from "../src/github/flight"
import { forgetDrawn } from "../src/ui/lastDrawn"
import { forgetLanded } from "../src/ui/landing"
import { forgetEverything } from "./storage"

/**
 * On GitHub, because that is where every one of these documents lives.
 *
 * The default is `about:blank`, where a relative address cannot be resolved: a
 * `history.pushState` to `/owner/repo/actions` leaves the location exactly where it
 * was, so anything a test says about the address is a test of nothing. Everything
 * here reads `github.com` anyway — the address parsers reject other hosts outright.
 */
/*
 * And without their stylesheets. The fixtures are real saved pages, so every one
 * carries `<link>`s into `github.githubassets.com`, and happy-dom fetches each
 * one the moment a document holds it. Nothing here reads a fetched sheet — the
 * one test that asks about styling reads its own — so the fetches bought nothing
 * and coupled the suite to that host: on a machine that cannot reach it, a saved
 * page failed a test about the address bar.
 */
GlobalRegistrator.register({
  url: "https://github.com/",
  settings: { disableCSSFileLoading: true }
})

/*
 * Reached for after the registration above, rather than imported beside it, because an
 * import is evaluated before the body that follows it. `@testing-library/dom` builds its
 * `screen` when it is first evaluated and binds every query to `document.body` then, so
 * imported at the top of this file it decides there is no document a moment before there
 * is one, and every query in the suite throws instead of reading the page.
 */
const { configure } = await import("@testing-library/react")

/**
 * How long `findBy` and `waitFor` keep asking, which is a budget and not a deadline.
 *
 * The default is one second, and one second is a measurement of this machine rather than
 * of the work: `bun test --parallel` runs a worker per core, and a GitHub runner has two
 * slow ones. Every dependency pull request came back red on a different handful of tests,
 * all of them a shade over a second — 1222ms, 1249ms, 1387ms, 1480ms — which is the
 * timeout being reported as a fault in the code under it. Waiting longer costs nothing
 * where the value arrives, because that is when the wait ends. It only spends the extra
 * time on a test that was going to fail anyway.
 *
 * This budget is spent inside `bun test`'s own per-test limit, so the two are raised
 * together: a wait long enough to outlast that limit turns a slow test into a killed one,
 * which reads as a different fault in a different place. Eight seconds against the forty
 * below leaves the wait reporting its own failure, which names the value it never saw.
 *
 * Eight rather than four since 2026-09-01, on the same evidence one machine further
 * along: twelve cores under fourteen busy neighbours popped a handful of these waits a
 * shade over four seconds — a pull request screen's first draw, a verdict panel's answer
 * — every one of them green run alone. The budget was measuring the neighbours.
 */
configure({ asyncUtilTimeout: 8_000 })

/**
 * How long one test may take before it is killed, which is the limit the budget above is
 * spent inside.
 *
 * Five seconds is the default and it is not a statement about any test here; it is what
 * is left over. Highlighting a fence takes a shikitheme and a grammar, and on a loaded
 * runner that alone ran to 6130ms and was killed a second after the work was done. Forty
 * seconds is still far below the job's own ten minutes, so a genuine hang is caught by
 * one of the two rather than by neither.
 *
 * Forty rather than twenty since 2026-09-01: a repository walk and two shell screens
 * were killed at twenty on a loaded twelve-core machine and finished a few seconds
 * later run alone. The limit exists to catch a hang, and a hang does not finish at
 * twenty-five.
 */
setDefaultTimeout(40_000)

/**
 * Nothing a test starts is allowed to be joined by the test after it.
 *
 * A read folds requests for the same address together and forks the work that fills
 * in sizes and stacks, so the promise a test waits on can settle with requests it
 * started still in the air. A test file replaces the `fetch` intercept between tests;
 * an address left in flight is joined rather than asked again, and the next test is
 * answered by the last test's intercept.
 *
 * Here rather than in the fourteen files that intercept `fetch`, because it is not a
 * fact about any of them and the fifteenth would not know to do it. It went unnoticed
 * for as long as every intercepted answer was immediate, and appeared the moment a
 * route that failed was asked again after a wait: a test asserting that a size could
 * not be read was handed the size the test before it had been served.
 */
afterEach(forgetFlights)

/**
 * And nothing a test kept is allowed to answer the test after it.
 *
 * `installStorage` writes `browser` onto the global and never takes it off, so the
 * four files that call it hand a working store to every file that runs afterwards.
 * Those four clear it before each of their own tests; the files that never asked for
 * a store do not know there is one to clear, and a read that keeps what it finds
 * keeps it into them.
 *
 * The same wait made this one visible too. A size is written from a forked fiber, so
 * with every intercepted answer immediate the write had not landed before the next
 * test began, and with a route asked again after a wait it had.
 */
afterEach(forgetEverything)

/*
 * And the mark saying this document has watched the interface arrive.
 *
 * Kept on `documentElement`, which is one element for the whole run: a test that
 * lands a screen would otherwise hand every test after it a document where the
 * entrance is already over, and the test that asserts a first arrival still
 * animates would pass for the wrong reason. See `hasLandedBefore`.
 */
afterEach(() => forgetLanded(document))

/**
 * And nothing a test drew is allowed to be drawn again for the test after it.
 *
 * The same rule once more, for the memory that makes Back instant. A screen given a
 * name keeps what GitHub said under it for the rest of the document, which is what
 * one reader walking in and out of a pull request wants and is not what a suite
 * wants: two tests standing the same screen up are one document, and the second
 * would paint the first one's answer before its own intercept was ever asked.
 */
afterEach(forgetDrawn)
