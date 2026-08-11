/**
 * Where the Rail's two remaining lists can actually be read from.
 *
 *     ego-browser nodejs < scripts/probe-home-reads.js
 *
 * `docs/spec/home.md` proposed `GET /users/{login}/received_events/public` for Activity
 * and "a `repositories` method" for the other list. Both were written before anyone
 * checked how this extension is allowed to ask GitHub anything: every read it makes is a
 * route on `github.com` with the reader's own session cookie and
 * `X-Requested-With: XMLHttpRequest`, and there is no token anywhere in the extension. So
 * `api.github.com` is not available to it at all, whatever the spec says.
 *
 * Which leaves GitHub's own internal routes. This asks two questions of the live site,
 * signed in as the reader:
 *
 * 1. What does the home page's `dashboard-repositories` partial actually carry, and is
 *    there a route that returns it on its own?
 * 2. What does the feed load its own contents from, and does that route answer to a
 *    fetch made outside the page?
 */

const HEADERS = {
  Accept: "application/json",
  "X-Requested-With": "XMLHttpRequest",
};

await useOrCreateTaskSpace("probe home reads");

/** The embedded payloads GitHub ships beside each partial, read off the page itself. */
const EMBEDDED = String.raw`(() => {
  const found = []
  for (const partial of document.querySelectorAll('react-partial')) {
    const name = partial.getAttribute('partial-name')
    const script = partial.querySelector('script[type="application/json"]')
    if (script === null) { found.push({ name, embedded: null }); continue }
    let parsed = null
    try { parsed = JSON.parse(script.textContent) } catch (whatever) { parsed = 'unparseable' }
    found.push({
      name,
      bytes: script.textContent.length,
      keys: parsed === null || parsed === 'unparseable' ? parsed : Object.keys(parsed),
      props: parsed?.props === undefined ? null : Object.keys(parsed.props),
      sample: JSON.stringify(parsed?.props ?? parsed).slice(0, 600)
    })
  }
  return found
})()`;

await gotoUrl("https://github.com/");
for (let attempt = 0; attempt < 20; attempt += 1) {
  const ready = await js(
    String.raw`document.querySelectorAll('react-partial').length > 2`
  ).catch(() => false);
  if (ready === true) break;
  await new Promise((wake) => setTimeout(wake, 1000));
}

cliLog("=== what home ships beside its partials ===");
cliLog(JSON.stringify(await js(EMBEDDED), null, 2).slice(0, 4000));

cliLog("=== who the reader is ===");
const login = await js(
  String.raw`document.querySelector('meta[name="user-login"]')?.content ?? null`
);
cliLog(String(login));

/** Asks for a route the way the gateway does, and says what came back. */
const tryRoute = async (route) => {
  const answer = await js(
    String.raw`(async () => {
      const response = await fetch(${JSON.stringify(route)}, {
        credentials: 'include',
        headers: ${JSON.stringify(HEADERS)}
      }).catch((whatever) => null)
      if (response === null) return JSON.stringify({ route: ${JSON.stringify(route)}, error: 'unreachable' })
      const text = await response.text()
      let shape = null
      try {
        const parsed = JSON.parse(text)
        shape = { json: true, keys: Object.keys(parsed).slice(0, 12) }
      } catch (whatever) {
        shape = { json: false }
      }
      return JSON.stringify({
        route: ${JSON.stringify(route)},
        status: response.status,
        type: response.headers.get('content-type'),
        bytes: text.length,
        shape,
        head: text.slice(0, 240).replace(/\s+/g, ' ')
      })
    })()`
  ).catch((whatever) => JSON.stringify({ route, error: String(whatever).slice(0, 120) }));
  cliLog(answer);
};

cliLog("=== routes that might carry the repositories ===");
for (const route of [
  "/dashboard-repositories",
  "/dashboard/repositories",
  `/${login}?tab=repositories`,
  "/settings/organizations",
  "/repositories",
]) {
  await tryRoute(route);
}

cliLog("=== and what the feed loads itself from ===");
await gotoUrl("https://github.com/feed");
await new Promise((wake) => setTimeout(wake, 4000));

cliLog(
  await js(String.raw`(() => {
    const fragments = [...document.querySelectorAll('include-fragment')].map((f) => f.getAttribute('src'))
    const forms = [...document.querySelectorAll('[data-url]')].map((f) => f.getAttribute('data-url')).slice(0, 6)
    return JSON.stringify({ fragments, forms }, null, 2)
  })()`)
);

for (const route of ["/dashboard-feed", `/${login}?tab=overview`]) {
  await tryRoute(route);
}
