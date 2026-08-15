import { GlobalRegistrator } from "@happy-dom/global-registrator"
import { setDefaultTimeout } from "bun:test"

/**
 * On GitHub, because that is where every one of these documents lives.
 *
 * The default is `about:blank`, where a relative address cannot be resolved: a
 * `history.pushState` to `/owner/repo/actions` leaves the location exactly where it
 * was, so anything a test says about the address is a test of nothing. Everything
 * here reads `github.com` anyway — the address parsers reject other hosts outright.
 */
GlobalRegistrator.register({ url: "https://github.com/" })

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
 * which reads as a different fault in a different place. Four seconds against the twenty
 * below leaves the wait reporting its own failure, which names the value it never saw.
 */
configure({ asyncUtilTimeout: 4_000 })

/**
 * How long one test may take before it is killed, which is the limit the budget above is
 * spent inside.
 *
 * Five seconds is the default and it is not a statement about any test here; it is what
 * is left over. Highlighting a fence takes a shikitheme and a grammar, and on a loaded
 * runner that alone ran to 6130ms and was killed a second after the work was done. Twenty
 * seconds is still far below the job's own ten minutes, so a genuine hang is caught by
 * one of the two rather than by neither.
 */
setDefaultTimeout(20_000)
