/**
 * Home, on the live site, with all three Destinations working.
 *
 *     bun run build && ego-browser nodejs < scripts/verify-home-destinations.js
 *
 * `Emulation.setFocusEmulationEnabled` first, and it is not optional: without it the tab
 * reports `visibilityState: hidden`, nothing is painted, every element measures zero, and
 * GitHub's own partials never hydrate — which cost this work an hour of believing the Rail
 * had no width. With it the page behaves as it does in front of a reader.
 */

const shot = async (name) => {
  const said = await captureScreenshot();
  const where = said?.path ?? said?.file ?? said;
  cliLog(`${name}: ${typeof where === "string" ? where : JSON.stringify(said).slice(0, 200)}`);
};

await useOrCreateTaskSpace("verify home destinations");
await cdp("Emulation.setFocusEmulationEnabled", { enabled: true });

await gotoUrl("https://github.com/");

/** Waits for something of ours, rather than for a fixed number of seconds. */
const until = async (what, expression, tries = 40) => {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    const answer = await js(expression).catch(() => false);
    if (answer === true) return true;
    await new Promise((wake) => setTimeout(wake, 500));
  }
  cliLog(`gave up waiting for ${what}`);
  return false;
};

await until(
  "the Rail",
  String.raw`document.querySelector('nav[aria-label="Rail"]') !== null`
);

const measured = String.raw`(() => {
  const rail = document.querySelector('nav[aria-label="Rail"]')
  const buttons = [...(rail?.querySelectorAll('button[aria-label]') ?? [])]
  const here = rail?.querySelector('[aria-current="page"]')
  const list = rail?.querySelector('ul[aria-label^="Repositories"]')
  const filter = rail?.querySelector('input[type="search"]')
  const court = document.querySelector('[data-court], section')
  return JSON.stringify({
    rail: rail === null ? null : { width: Math.round(rail.getBoundingClientRect().width), height: Math.round(rail.getBoundingClientRect().height) },
    destinations: buttons.map((one) => one.getAttribute('aria-label')).filter((name) => /Working Set|Repositories|Activity/.test(name ?? '')),
    here: here?.textContent ?? null,
    repositories: [...(list?.querySelectorAll('a[href]') ?? [])].map((one) => one.getAttribute('href')).slice(0, 8),
    filter: filter === null || filter === undefined ? null : Math.round(filter.getBoundingClientRect().width),
    court: court === null ? null : Math.round(court.getBoundingClientRect().width),
    theirSidebar: document.querySelector('aside.feed-left-sidebar') === null ? 'gone' : getComputedStyle(document.querySelector('aside.feed-left-sidebar')).display,
    theirExplore: document.querySelector('aside.feed-right-column') === null ? 'gone' : getComputedStyle(document.querySelector('aside.feed-right-column')).display
  }, null, 2)
})()`;

cliLog("=== the Working Set Destination ===");
cliLog(await js(measured));
await shot("home-working-set");

/** Presses a Destination by its name in the Rail. */
const press = async (name) =>
  js(
    String.raw`(() => {
      const rail = document.querySelector('nav[aria-label="Rail"]')
      const found = [...(rail?.querySelectorAll('button') ?? [])]
        .find((one) => (one.getAttribute('aria-label') ?? '').startsWith(${JSON.stringify(name)}))
      if (found === undefined) return 'no ' + ${JSON.stringify(name)}
      found.click()
      return 'pressed'
    })()`
  );

cliLog("=== Repositories ===");
cliLog(await press("Repositories"));
await until(
  "every repository",
  String.raw`(document.querySelectorAll('a[href$="/pulls"]').length > 20)`
);
cliLog(
  await js(String.raw`(() => {
    const rows = [...document.querySelectorAll('a[href$="/pulls"]')]
    const filter = document.querySelector('input[type="search"]')
    const count = [...document.querySelectorAll('*')].find((one) => /of 1[0-9][0-9]/.test(one.textContent ?? '') && one.children.length === 0)
    return JSON.stringify({
      howMany: rows.length,
      first: rows.slice(0, 4).map((one) => one.getAttribute('href')),
      filters: filter !== null,
      says: count?.textContent?.trim() ?? null,
      private: [...document.querySelectorAll('*')].filter((one) => one.children.length === 0 && (one.textContent ?? '').trim() === 'Private').length
    }, null, 2)
  })()`)
);
await shot("home-repositories");

cliLog("=== typing in the filter ===");
cliLog(
  await js(String.raw`(async () => {
    const filter = document.querySelector('input[type="search"]')
    if (filter === null) return 'no filter'
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    set.call(filter, 'flowl')
    filter.dispatchEvent(new Event('input', { bubbles: true }))
    await new Promise((wake) => setTimeout(wake, 300))
    return JSON.stringify({
      left: [...document.querySelectorAll('a[href$="/pulls"]')].map((one) => one.getAttribute('href')).slice(0, 6)
    })
  })()`)
);
await shot("home-filtered");

cliLog("=== Activity ===");
cliLog(await press("Activity"));
await until(
  "what happened",
  String.raw`document.querySelectorAll('time').length > 3`
);
cliLog(
  await js(String.raw`(() => {
    const times = [...document.querySelectorAll('time')]
    const said = document.body.innerText
    return JSON.stringify({
      lines: times.length,
      newest: times[0]?.getAttribute('datetime') ?? null,
      pushes: (said.match(/pushed to/g) ?? []).length,
      merges: (said.match(/merged #/g) ?? []).length,
      stars: (said.match(/starred/g) ?? []).length,
      recommendations: (said.match(/Trending|Recommended|might like/g) ?? []).length,
      firstLines: said.split('\n').filter((line) => line.trim().length > 0).slice(4, 12)
    }, null, 2)
  })()`)
);
await shot("home-activity");

cliLog("=== narrowing the Rail, and whether it is remembered ===");
cliLog(
  await js(String.raw`(() => {
    const rail = document.querySelector('nav[aria-label="Rail"]')
    const narrow = [...(rail?.querySelectorAll('button') ?? [])].find((one) => one.getAttribute('aria-label') === 'Narrow the Rail')
    if (narrow === undefined) return 'no narrow control'
    narrow.click()
    return JSON.stringify({ width: Math.round(rail.getBoundingClientRect().width) })
  })()`)
);
await shot("home-narrow");

await gotoUrl("https://github.com/");
await until(
  "the Rail again",
  String.raw`document.querySelector('nav[aria-label="Rail"]') !== null`
);
cliLog(
  await js(String.raw`(() => {
    const rail = document.querySelector('nav[aria-label="Rail"]')
    const widen = [...(rail?.querySelectorAll('button') ?? [])].find((one) => one.getAttribute('aria-label') === 'Widen the Rail')
    return JSON.stringify({
      width: Math.round(rail.getBoundingClientRect().width),
      stillNarrow: widen !== undefined,
      destination: rail?.querySelector('[aria-current="page"]')?.textContent ?? null
    })
  })()`)
);
await shot("home-after-reload");
