/**
 * What GitHub itself asks for when it draws the repositories and the feed.
 *
 *     ego-browser nodejs < scripts/probe-home-network.js
 *
 * `scripts/probe-home-reads.js` established that neither list has a route this extension
 * can simply ask for: `/dashboard-repositories` is a 404 and every HTML route answers 406
 * to the JSON headers the gateway sends. So the question becomes what their own page asks
 * for, which is answerable by watching it.
 *
 * Watched on `/feed` rather than on home, deliberately. Home is a page this extension
 * takes over, and their partials sit inside a region it hides — so their loaders never run
 * and the requests worth seeing are never made. `/feed` is left alone, is rendered by the
 * same layout, and carries the same repositories partial in its sidebar.
 */

await useOrCreateTaskSpace("probe home network");

/**
 * Their own `fetch` and `XMLHttpRequest`, wrapped before their code runs.
 *
 * The performance timeline would give the addresses, but not the method or the body — and
 * a GraphQL POST is exactly the kind of request this is looking for, where the address
 * says nothing at all about what was asked.
 */
const WATCHER = String.raw`
(() => {
  window.__asked = []
  const realFetch = window.fetch
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : input?.url
    window.__asked.push({
      url,
      method: init?.method ?? input?.method ?? 'GET',
      body: typeof init?.body === 'string' ? init.body.slice(0, 400) : null
    })
    return realFetch.apply(this, arguments)
  }
  const open = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function (method, url) {
    window.__asked.push({ url: String(url), method, body: null })
    return open.apply(this, arguments)
  }
  return 'watching'
})()
`;

await cdp("Page.addScriptToEvaluateOnNewDocument", { source: WATCHER });
await gotoUrl("https://github.com/feed");
await new Promise((wake) => setTimeout(wake, 8000));

const seen = await js(String.raw`(() => window.__asked ?? [])()`);

const interesting = seen.filter(
  (one) =>
    !/\.(js|css|woff2|png|svg|jpg|gif|ico)(\?|$)/.test(one.url) &&
    !one.url.includes("/assets-cdn/") &&
    !one.url.includes("collector.github")
);

cliLog(`${seen.length} requests, ${interesting.length} worth reading:`);
for (const one of interesting) {
  cliLog(
    `${one.method} ${one.url.replace("https://github.com", "")}${one.body === null ? "" : "\n    " + one.body}`
  );
}
