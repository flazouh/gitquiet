/**
 * Involved Issues, on the live site, in the Courts beside the pull requests.
 *
 *     bun run build && ego-browser nodejs < scripts/verify-home-issues.js
 *
 * What this checks is the thing a unit test cannot: that the issue rows arrive from three real
 * searches, that they land under the right repository, and that an issue row and a pull request
 * row sitting next to each other are drawn on the same tracks.
 *
 * Two lessons are built into it. Every query is scoped to `#gitquiet-root`, because GitHub's
 * own gated partials are still in the DOM at zero height and will happily answer a query for a
 * link to a pull request. And it presses Working Set first, because the Destination is
 * remembered and the previous run may have left the Rail somewhere else.
 */

const shot = async (name) => {
  const said = await captureScreenshot();
  const where = said?.path ?? said?.file ?? said;
  cliLog(`${name}: ${typeof where === "string" ? where : JSON.stringify(said).slice(0, 200)}`);
};

await useOrCreateTaskSpace("verify home issues");
await cdp("Emulation.setFocusEmulationEnabled", { enabled: true });
await gotoUrl("https://github.com/");

const until = async (what, expression, tries = 40) => {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    const answer = await js(expression).catch(() => false);
    if (answer === true) return true;
    await new Promise((wake) => setTimeout(wake, 500));
  }
  cliLog(`gave up waiting for ${what}`);
  return false;
};

await until("the Rail", String.raw`document.querySelector('nav[aria-label="Rail"]') !== null`);

cliLog(
  await js(String.raw`(() => {
    const rail = document.querySelector('nav[aria-label="Rail"]')
    const here = rail?.querySelector('[aria-current="page"]')?.textContent ?? null
    const wide = [...(rail?.querySelectorAll('button') ?? [])]
      .find((one) => one.getAttribute('aria-label') === 'Widen the Rail')
    wide?.click()
    const working = [...(rail?.querySelectorAll('button') ?? [])]
      .find((one) => (one.getAttribute('aria-label') ?? '').startsWith('Working Set'))
    working?.click()
    return JSON.stringify({ wasAt: here, widened: wide !== undefined, pressedWorkingSet: working !== undefined })
  })()`)
);

await until(
  "a pull request row of ours",
  String.raw`document.querySelectorAll('#gitquiet-root [data-row]').length > 0`
);
/* The three issue searches land after the pull requests, so give them their own moment. */
await new Promise((wake) => setTimeout(wake, 5000));

cliLog("=== what the Courts hold ===");
cliLog(
  await js(String.raw`(() => {
    const root = document.querySelector('#gitquiet-root')
    const rows = [...root.querySelectorAll('[data-row]')].map((row) => {
      const link = row.querySelector('a[href*="/pull/"], a[href*="/issues/"]')
      const href = link?.getAttribute('href') ?? ''
      return {
        href,
        kind: /\/issues\//.test(href) ? 'issue' : 'pull',
        said: (row.textContent ?? '').replace(/\s+/g, ' ').trim(),
        grid: [...row.querySelectorAll('[style*="grid-template-columns"]')].at(-1)
      }
    }).filter((one) => one.href !== '')

    const tracks = new Map()
    for (const one of rows) {
      const columns = one.grid?.getAttribute('style')?.match(/grid-template-columns:([^;]*)/)?.[1]?.trim()
      if (columns === undefined) continue
      const seen = tracks.get(columns) ?? { pulls: 0, issues: 0, cells: one.grid.children.length }
      seen[one.kind === 'issue' ? 'issues' : 'pulls'] += 1
      tracks.set(columns, seen)
    }

    /* Which repository each row sits under, taken from the nearest heading above it. */
    const courts = [...root.querySelectorAll('h2, h3')].map((heading) => {
      const holder = heading.parentElement?.parentElement ?? heading.parentElement
      const inside = [...(holder?.querySelectorAll('[data-row]') ?? [])]
      return {
        heading: (heading.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60),
        pulls: inside.filter((one) => one.querySelector('a[href*="/pull/"]') !== null).length,
        issues: inside.filter((one) => one.querySelector('a[href*="/issues/"]') !== null).length
      }
    }).filter((one) => one.pulls + one.issues > 0)

    const said = root.innerText
    return JSON.stringify({
      pulls: rows.filter((one) => one.kind === 'pull').length,
      issues: rows.filter((one) => one.kind === 'issue').length,
      issueRows: rows.filter((one) => one.kind === 'issue').map((one) => one.said.slice(0, 110)).slice(0, 5),
      /* One entry means both kinds are drawn on the same tracks. */
      trackShapes: [...tracks.entries()].map(([columns, seen]) => ({ ...seen, columns: columns.slice(0, 140) })),
      courts,
      separateSection: /Involved Issues/.test(said),
      labelCounts: (said.match(/\d+ labels?/g) ?? []).slice(0, 4),
      placeholders: (said.match(/N\/A|unknown|undefined|NaN/g) ?? []).length
    }, null, 2)
  })()`)
);
await shot("home-issues");

cliLog("=== the walk: j through the rows ===");
cliLog(
  await js(String.raw`(async () => {
    const root = document.querySelector('#gitquiet-root')
    const press = (key) => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
    const walked = []
    for (let step = 0; step < 10; step += 1) {
      press('j')
      await new Promise((wake) => setTimeout(wake, 140))
      const here = root.querySelector('[aria-current="true"]')
      const row = here?.closest('[data-row]') ?? here
      const link = row?.querySelector('a[href*="/pull/"], a[href*="/issues/"]')
      walked.push((link?.getAttribute('href') ?? 'nothing').replace('https://github.com/', ''))
    }
    return JSON.stringify({ walked }, null, 2)
  })()`)
);
