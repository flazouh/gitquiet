/**
 * Whether the Working Set stands on home, and whether getting there costs the page
 * being left anything.
 *
 *     bun run reload && ego-browser nodejs < scripts/verify-home.js
 *
 * Home is the address every soft navigation on GitHub passes through, so this is the
 * one page where the rules that hide theirs are switched on while somebody else's page
 * is still on the screen. Three arrivals, because they fail differently:
 *
 * 1. Loaded on home. The ordinary case, and the only one a `matches` pattern sees.
 * 2. Their dashboard and back. The same screen, two of GitHub's pages: a list left
 *    standing across that move would be holding a container in a region GitHub threw
 *    away, under rules written for the page being left.
 * 3. Home from the feed. `/feed` carries the same `aside.feed-left-sidebar` as home to
 *    the attribute, and a rule naming it plainly would take the feed's own sidebar off
 *    the screen for as long as GitHub took to answer the press. The band is proved
 *    against home's own column instead; this is what says so.
 */

/**
 * What the reader can see, sampled, from before the press until after the arrival.
 *
 * Installed into every document rather than into one, because whether a press of Home
 * even keeps the document is the first thing this has to find out: a shared rule can
 * only take somebody else's page off the screen while that page is still the page, and
 * a press GitHub answers with a real document load never was at risk. The token is how
 * the two are told apart — same number after the press, same document.
 */
const SAMPLER = String.raw`
(() => {
  if (window.__home !== undefined) return 'already sampling'
  const seen = (element) => {
    if (element === null || element === undefined) return false
    for (let at = element; at !== null; at = at.parentElement) {
      if (at.hasAttribute?.('hidden')) return false
      const style = getComputedStyle(at)
      if (style.display === 'none' || style.visibility === 'hidden') return false
    }
    return true
  }
  window.__home = { token: Math.round(Math.random() * 1e9), samples: [] }
  window.__home.stop = setInterval(() => {
    const root = document.getElementById('gitquiet-root')
    window.__home.samples.push({
      at: Math.round(performance.now()),
      path: location.pathname,
      // Their sidebar, which both pages have and only one of them may hide.
      sidebar: seen(document.querySelector('aside.feed-left-sidebar')),
      // The feed itself, which is the thing a reader leaving it is still reading.
      feed: seen(document.querySelector('feed-container')),
      ours: root === null ? -1 : Math.round(root.getBoundingClientRect().height)
    })
  }, 40)
  return 'sampling'
})()
`;

/** Waits for the list to have finished reading rather than for a number of seconds. */
const drawn = async () => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((wake) => setTimeout(wake, 1000));
    const ready = await js(String.raw`(() => {
      const root = document.getElementById('gitquiet-root')
      return root !== null && root.querySelectorAll('a[aria-label]').length > 0
    })()`);
    if (ready === true) return true;
  }
  return false;
};

const state = () =>
  js(String.raw`
    const root = document.getElementById('gitquiet-root')
    const seen = (element) => {
      if (element === null || element === undefined) return false
      for (let at = element; at !== null; at = at.parentElement) {
        if (at.hasAttribute?.('hidden')) return false
        const style = getComputedStyle(at)
        if (style.display === 'none' || style.visibility === 'hidden') return false
      }
      return true
    }

    return JSON.stringify({
      path: location.pathname,
      page: document.documentElement.getAttribute('data-gitquiet-page'),
      gating: document.documentElement.hasAttribute('data-gitquiet-gating'),
      mounted: root !== null,
      // Which of GitHub's regions ours is standing in, named as the places name them.
      standingIn: root === null
        ? null
        : root.closest('#dashboard.dashboard') !== null
          ? 'home'
          : root.closest('[data-testid="pulls-dashboard-surface-layout"]') !== null
            ? 'dashboard'
            : (root.parentElement?.tagName.toLowerCase() ?? 'nowhere'),
      belongsTo: root?.getAttribute('data-gitquiet-belongs-to') ?? null,
      rows: root?.querySelectorAll('a[aria-label]').length ?? 0,
      courts: [...(root?.querySelectorAll('section') ?? [])]
        .map((region) => (region.querySelector('h2')?.textContent ?? '').trim())
        .filter((name) => name.length > 0),
      // The two things home's place is meant to take, read as a reader meets them.
      theirCopilotBox: seen(document.querySelector('div.copilotPreview__container')),
      theirSidebar: seen(document.querySelector('aside.feed-left-sidebar')),
      /*
       * The Rail, and how much room it left the list.
       *
       * Measured rather than assumed: home's centre column was 680 wide when the probe
       * read it, and a strip taken out of that is room the Courts no longer have. The
       * fixed tracks in the list are what this number has to be read against.
       */
      rail: (() => {
        const rail = root?.querySelector('nav[aria-label="Rail"]') ?? null
        if (rail === null) return null
        const destinations = rail.querySelector('ul:not([aria-label])')
        return {
          width: Math.round(rail.getBoundingClientRect().width),
          destinations: [...(destinations?.children ?? [])].map((row) => row.textContent.trim()),
          repositories: [...rail.querySelectorAll('ul[aria-label] li')].map((row) => row.textContent.trim())
        }
      })(),
      listWidth: (() => {
        const court = root?.querySelector('section') ?? null
        return court === null ? 0 : Math.round(court.getBoundingClientRect().width)
      })()
    })
  `).then(JSON.parse);

const problems = [];

await useOrCreateTaskSpace("verify home");

// 1. Loaded on home. A document of its own rather than whatever tab is open: a tab left
//    here by the last run is still holding the last build's screen in memory.
await gotoUrl("https://github.com/");
if (!(await drawn())) cliLog("the Working Set never finished reading on home");
const onHome = await state();
cliLog(`loaded on home: ${JSON.stringify(onHome, null, 2)}`);

if (onHome.path !== "/")
  problems.push(`never arrived at home, on ${onHome.path}`);
if (!onHome.mounted) problems.push("nothing of ours was put on home");
if (onHome.page !== "home")
  problems.push(`the document is named ${onHome.page} rather than home`);
if (onHome.standingIn !== "home")
  problems.push(`ours is standing in ${onHome.standingIn}, not home's column`);
if (onHome.rows === 0) problems.push("the Working Set drew no rows on home");
if (onHome.gating) problems.push("home was left gated, which is a blank page");
if (onHome.theirCopilotBox)
  problems.push("GitHub's Copilot box is still on home");
if (onHome.theirSidebar)
  problems.push("GitHub's repository sidebar is still on home");

// The Rail, which is what replaces the sidebar above rather than merely removing it.
if (onHome.rail === null)
  problems.push(
    "home has no Rail, so their sidebar was taken and nothing put back",
  );
else {
  const named = onHome.rail.destinations.join(" ");
  for (const destination of ["Working Set", "Repositories", "Activity"]) {
    if (!named.includes(destination))
      problems.push(`the Rail does not name ${destination}`);
  }
  if (onHome.rail.repositories.length === 0) {
    problems.push(
      "the Rail lists no repositories, though the list it was folded from has rows",
    );
  }
  /*
   * Only where anything could be measured at all.
   *
   * Every box on this page reads 0x0 in a window the operating system is not painting,
   * which `scripts/probe-home-dom.js` measured and says so about. A width of zero is
   * that, not a layout to fix, and failing on it would make this script lie on a machine
   * whose window happens to be behind another.
   */
  if (onHome.listWidth > 0 && onHome.listWidth < 480) {
    problems.push(
      `the Rail left the Courts ${onHome.listWidth}px, which is narrower than their tracks want`,
    );
  }
  if (onHome.listWidth === 0) {
    cliLog(
      "nothing could be measured — this window is not being painted, so widths say nothing",
    );
  }
}

// 2. Their dashboard and back, both without a document.
const toDashboard = await js(String.raw`
  const link = [...document.querySelectorAll('a')].find((a) => new URL(a.href, location.origin).pathname === '/pulls')
  if (link === undefined) return 'no link to their dashboard on this page'
  link.click()
  return 'pressed /pulls'
`);
cliLog(toDashboard);
if (!(await drawn()))
  cliLog("the Working Set never finished reading on their dashboard");
const onDashboard = await state();
cliLog(`their dashboard: ${JSON.stringify(onDashboard, null, 2)}`);

if (!onDashboard.path.startsWith("/pulls")) {
  problems.push(`never arrived at their dashboard, on ${onDashboard.path}`);
} else {
  if (onDashboard.standingIn !== "dashboard") {
    problems.push(
      `on /pulls ours is standing in ${onDashboard.standingIn}, not their layout`,
    );
  }
  if (onDashboard.page !== "dashboard") {
    problems.push(
      `on /pulls the document is named ${onDashboard.page} rather than dashboard`,
    );
  }
  if (onDashboard.gating) problems.push("their dashboard was left gated");
}

const homeAgain = await js(String.raw`
  const link = [...document.querySelectorAll('header a, a.AppHeader-logo')].find(
    (a) => new URL(a.href, location.origin).pathname === '/'
  )
  if (link === undefined) return 'no link home in their header'
  link.click()
  return 'pressed home'
`);
cliLog(homeAgain);
if (!(await drawn()))
  cliLog("the Working Set never finished reading back on home");
const backHome = await state();
cliLog(`back on home: ${JSON.stringify(backHome, null, 2)}`);

if (backHome.path !== "/")
  problems.push(`never arrived back home, on ${backHome.path}`);
else {
  if (backHome.standingIn !== "home") {
    problems.push(
      `back home ours is standing in ${backHome.standingIn}, not home's column`,
    );
  }
  if (backHome.page !== "home") {
    problems.push(
      `back home the document is named ${backHome.page} rather than home`,
    );
  }
  if (backHome.rows === 0)
    problems.push("back home the Working Set drew no rows");
  if (backHome.gating) problems.push("home was left gated on the way back");
  if (backHome.theirSidebar)
    problems.push("back home GitHub's sidebar is still on the page");
}

// 3. Home from the feed, which is the one page that shares the sidebar.
await cdp("Page.addScriptToEvaluateOnNewDocument", { source: SAMPLER });
// Their own tab rather than a fresh one, because the script above is attached to this
// target: a tab opened around it starts a document the sampler was never put into.
await gotoUrl("https://github.com/feed");
await new Promise((wake) => setTimeout(wake, 3000));

const feedAtRest = await js(String.raw`(() => {
  const aside = document.querySelector('aside.feed-left-sidebar')
  return JSON.stringify({
    token: window.__home?.token ?? null,
    page: document.documentElement.getAttribute('data-gitquiet-page'),
    sidebar: aside !== null && getComputedStyle(aside).display !== 'none' && !aside.hasAttribute('hidden'),
    ours: document.getElementById('gitquiet-root') !== null
  })
})()`).then(JSON.parse);
cliLog(`the feed at rest: ${JSON.stringify(feedAtRest)}`);

// Before anything is pressed. A page this extension has nothing to say about should be
// untouched by it, and the feed is the page whose furniture home's rules name.
if (feedAtRest.token === null)
  problems.push("the sampler never ran on the feed");
if (!feedAtRest.sidebar)
  problems.push(
    "the feed's own sidebar is hidden while the reader is on the feed",
  );
if (feedAtRest.page !== null)
  problems.push(
    `the feed is named ${feedAtRest.page}, which is somebody else's page`,
  );

const leftTheFeed = await js(String.raw`
  const link = [...document.querySelectorAll('a')].find((a) => new URL(a.href, location.origin).pathname === '/')
  if (link === undefined) return 'no link home on the feed'
  link.click()
  return 'pressed home from the feed'
`);
cliLog(leftTheFeed);
if (!(await drawn()))
  cliLog("the Working Set never finished reading after the feed");
await new Promise((wake) => setTimeout(wake, 1000));

const after = await js(String.raw`(() => {
  const life = window.__home
  if (life === undefined) return JSON.stringify({ token: null, samples: [] })
  clearInterval(life.stop)
  return JSON.stringify({ token: life.token, samples: life.samples })
})()`).then(JSON.parse);

if (after.token !== feedAtRest.token) {
  // GitHub answered with a document of its own. The old page is torn down by the
  // browser rather than by a rule of ours, so nothing here could have taken it early.
  cliLog(
    `the press loaded a document (${feedAtRest.token} became ${after.token}), so the feed was never at risk from a rule`,
  );
} else {
  const onTheFeed = after.samples.filter((sample) => sample.path === "/feed");
  const blinked = onTheFeed.filter((sample) => !sample.sidebar);
  const lost = onTheFeed.filter((sample) => !sample.feed);

  cliLog(
    `${after.samples.length} samples in one document, ${onTheFeed.length} while the feed was still the page` +
      (blinked.length === 0
        ? ""
        : `\n  sidebar gone at ${blinked.map((s) => s.at + "ms").join(", ")}`),
  );

  if (onTheFeed.length === 0)
    problems.push("the feed was never sampled, so this proves nothing");
  if (blinked.length > 0) {
    problems.push(
      `the feed's own sidebar went off the screen ${blinked.length} sample(s) before home arrived`,
    );
  }
  if (lost.length > 0) {
    problems.push(
      `the feed itself went off the screen ${lost.length} sample(s) before home arrived`,
    );
  }
}

const afterTheFeed = await state();
cliLog(`home from the feed: ${JSON.stringify(afterTheFeed, null, 2)}`);
if (afterTheFeed.standingIn !== "home") {
  problems.push(
    `from the feed ours is standing in ${afterTheFeed.standingIn}, not home's column`,
  );
}

cliLog(
  problems.length === 0
    ? "PASS — home is ours, and nobody else's page paid for it"
    : `FAIL\n  ${problems.join("\n  ")}`,
);
