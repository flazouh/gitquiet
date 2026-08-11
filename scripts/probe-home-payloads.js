/**
 * The shape of the two payloads the Rail's remaining lists have to be built from.
 *
 *     ego-browser nodejs < scripts/probe-home-payloads.js
 *
 * Established by the two probes before this one: there is no JSON route for the
 * repositories — GitHub ships them embedded in the page beside their sidebar partial — and
 * the feed is loaded from `/conduit/for_you_feed`, which is a route this extension can ask
 * for the same way it asks for a shelf.
 *
 * "For you" is the ranked feed their own readers have been asking them to undo, so the
 * question this has to settle is whether that route can be asked for the chronological
 * one, or whether ranking is baked in and Activity has to be assembled some other way.
 */

const HEADERS = {
  Accept: "application/json",
  "X-Requested-With": "XMLHttpRequest",
};

await useOrCreateTaskSpace("probe home payloads");
await gotoUrl("https://github.com/feed");
await new Promise((wake) => setTimeout(wake, 5000));

cliLog("=== the repositories, as GitHub ships them ===");
cliLog(
  await js(String.raw`(() => {
    const partial = [...document.querySelectorAll('react-partial')]
      .find((one) => one.getAttribute('partial-name') === 'dashboard-repositories')
    if (partial === undefined) return 'no dashboard-repositories partial on this page'
    const script = partial.querySelector('script[type="application/json"]')
    if (script === null) return 'the partial ships no embedded payload'
    const parsed = JSON.parse(script.textContent)
    const props = parsed.props ?? parsed
    const repositories = props.repositories ?? props.topRepositories ?? props.repos ?? null
    return JSON.stringify({
      bytes: script.textContent.length,
      props: Object.keys(props),
      howMany: Array.isArray(repositories) ? repositories.length : null,
      first: Array.isArray(repositories) ? repositories[0] : null,
      names: Array.isArray(repositories) ? repositories.map((one) => one.name ?? one.nameWithOwner ?? one.full_name) : null,
      rest: JSON.stringify(props).slice(0, 500)
    }, null, 2)
  })()`)
);

cliLog("=== and what 'Show more' does ===");
cliLog(
  await js(String.raw`(() => {
    const more = [...document.querySelectorAll('a, button')]
      .find((one) => (one.textContent ?? '').trim().toLowerCase().startsWith('show more'))
    return more === undefined ? 'no show more control' : JSON.stringify({
      tag: more.tagName.toLowerCase(),
      href: more.getAttribute('href'),
      attributes: [...more.attributes].map((a) => a.name + '=' + a.value).join(' ').slice(0, 300)
    }, null, 2)
  })()`)
);

/** Asks for a route the way the gateway does, and says what came back. */
const tryRoute = async (route) =>
  cliLog(
    await js(
      String.raw`(async () => {
      const response = await fetch(${JSON.stringify(route)}, {
        credentials: 'include',
        headers: ${JSON.stringify(HEADERS)}
      }).catch(() => null)
      if (response === null) return JSON.stringify({ route: ${JSON.stringify(route)}, error: 'unreachable' })
      const text = await response.text()
      let shape = { json: false }
      try {
        const parsed = JSON.parse(text)
        shape = { json: true, keys: Object.keys(parsed).slice(0, 14) }
      } catch (whatever) {
        // Their fragments answer with HTML, which is a shape too: what matters is what is
        // in it, so this counts the things that look like feed items.
        shape = {
          json: false,
          items: (text.match(/data-test-selector="feed-item"|class="[^"]*feed-item/g) ?? []).length,
          pushes: (text.match(/pushed to|PushEvent/g) ?? []).length,
          commits: (text.match(/octicon-git-commit/g) ?? []).length
        }
      }
      return JSON.stringify({
        route: ${JSON.stringify(route)},
        status: response.status,
        type: response.headers.get('content-type'),
        bytes: text.length,
        shape,
        head: text.slice(0, 300).replace(/\s+/g, ' ')
      })
    })()`
    ).catch((whatever) => JSON.stringify({ route, error: String(whatever).slice(0, 140) }))
  );

cliLog("=== the feed route, and whether it can be asked for time order ===");
for (const route of [
  "/conduit/for_you_feed",
  "/conduit/for_you_feed?ordering=chronological",
  "/conduit/following_feed",
  "/conduit/filter",
  "/dashboard/index/watching",
]) {
  await tryRoute(route);
}
