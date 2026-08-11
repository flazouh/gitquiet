/**
 * Measures press-to-rows on a repository's pull request list.
 *
 *     bun run build && ego-browser nodejs < scripts/benchmark-list-flow.js
 *
 * The list is the slowest page this extension draws — a search, six shelves, the
 * standings and a branch read per row — and until now every visit paid for all of
 * it before a single row appeared. Two things are supposed to have changed that:
 * the shelves and the search are kept, so a second visit paints from the store;
 * and resting on the tab reads them ahead, so even a first visit can.
 *
 * Three conditions, because they answer three different questions:
 *
 *   cold        a freshly installed extension, pressed straight away. What the
 *               page cost before any of this, and the number the others beat.
 *   remembered  the same extension, second visit. What a reader who has been
 *               here today gets.
 *   dwelled     a freshly installed extension again, with the pointer resting on
 *               the tab for a second and a half first. What the reading-ahead is
 *               worth on its own, with nothing in the store to help it.
 *
 * The two cold conditions each start from a fresh install because uninstalling
 * takes the extension's storage with it, which is the only way to have a store
 * that is honestly empty.
 *
 * Pressed rather than navigated to: the repository's own tab is a soft
 * navigation, so the document survives the press and can time itself.
 */

const EXTENSION = "/Users/alex/Documents/githubpro/.output/chrome-mv3";
const REPO = "https://github.com/microsoft/vscode";
const TAB = 'a[href="/microsoft/vscode/pulls"]';

/** Past the 150ms the prefetch waits for, and no longer than a reader would rest. */
const DWELL = 1.5;

/** Long enough for the whole read — search, shelves, standings, branches. */
const PATIENCE = 20;

const task = await useOrCreateTaskSpace("benchmark list flow");
await takeOverTaskSpace(task.id);

const focus = async () => {
  await cdp("Emulation.setFocusEmulationEnabled", { enabled: true });
  await cdp("Page.bringToFront");
};

/**
 * Watches from the press until there are rows on the screen.
 *
 * `rows` is the first row drawn, which is the moment the page stops being a
 * skeleton. `settled` is the last change to the row count, which is where the
 * live read finished filling in behind whatever was shown first — the two are
 * the same number on a cold visit and far apart on a remembered one, and that
 * gap is the whole point.
 */
const install = () =>
  js(String.raw`(() => {
    window.__marks = { gate: null, rows: null, settled: null, count: 0 }
    document.addEventListener("click", () => {
      const t0 = performance.now()
      const since = () => Math.round(performance.now() - t0)
      const timer = setInterval(() => {
        const marks = window.__marks
        if (marks.gate === null && document.documentElement.hasAttribute("data-gitquiet-gating")) {
          marks.gate = since()
        }
        const root = document.getElementById("gitquiet-root")
        const rows = root === null ? 0 : root.querySelectorAll('a[href*="/pull/"]').length
        if (rows === 0) return
        if (marks.rows === null) marks.rows = since()
        if (rows !== marks.count) {
          marks.count = rows
          marks.settled = since()
        }
      }, 16)
      setTimeout(() => clearInterval(timer), 30000)
    }, { capture: true, once: true })
    return true
  })()`);

const freshExtension = async () => {
  try {
    await cdp("Extensions.uninstall", { id: "ablmcookkmabldlblkojbpchnbdlogjd" }, null);
  } catch {
    // Not installed, which is the state this wants anyway.
  }
  await wait(1);
  const { id } = await cdp("Extensions.loadUnpacked", { path: EXTENSION }, null);
  await focus();
  return id;
};

/** One press of the tab, from the repository's own front page. */
const run = async ({ dwell }) => {
  await gotoAndWait(REPO, { timeout: 60, settle: 3 });
  await focus();
  await wait(2);
  await install();

  if (dwell) {
    await hover(TAB, { label: "rest on the Pull requests tab" });
    await wait(DWELL);
  }

  await click(TAB, { label: "open the pull requests" });
  await wait(PATIENCE);
  return await js(String.raw`window.__marks`);
};

const show = (value) => (value === null || value === undefined ? "—" : value + "ms");

await freshExtension();
const cold = await run({ dwell: false });
cliLog(`cold        rows ${show(cold.rows)}, settled ${show(cold.settled)}, ${cold.count} rows`);

const remembered = await run({ dwell: false });
cliLog(
  `remembered  rows ${show(remembered.rows)}, settled ${show(remembered.settled)}, ${remembered.count} rows`,
);

await freshExtension();
const dwelled = await run({ dwell: true });
cliLog(
  `dwelled     rows ${show(dwelled.rows)}, settled ${show(dwelled.settled)}, ${dwelled.count} rows`,
);

cliLog(`\n${"-".repeat(60)}`);
cliLog("Press to the first row of a repository's pull request list\n");
cliLog(`  cold        ${show(cold.rows)}`);
cliLog(`  remembered  ${show(remembered.rows)}`);
cliLog(`  dwelled     ${show(dwelled.rows)}`);
