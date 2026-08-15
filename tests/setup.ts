import { GlobalRegistrator } from "@happy-dom/global-registrator"

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
 */
configure({ asyncUtilTimeout: 3_000 })
