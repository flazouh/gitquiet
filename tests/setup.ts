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
