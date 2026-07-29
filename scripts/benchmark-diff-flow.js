/**
 * Measures the press-to-diff flow, which is the one a reviewer actually runs.
 *
 *     ego-browser nodejs < scripts/benchmark-diff-flow.js
 *
 * `benchmark-click-flow.js` stops at the conversation, and that flatters GitHub:
 * their conversation is not the thing a reviewer came for. Reading a pull
 * request means reading the diff, and on GitHub the diff is behind a second
 * navigation — press the row, wait for the conversation, press "Files changed",
 * wait again. Here the files are on the page that the press opened, so the
 * second wait does not exist.
 *
 * So the fair comparison is press-to-diff, and it is measured in two segments on
 * GitHub's side, because the second press is the reader's and its cost is real
 * whoever pays it. The tab is pressed the instant their conversation arrives,
 * which is faster than a person and therefore generous to them.
 *
 * Pull requests are taken from the second page of the list, so that neither side
 * is answering from something this profile fetched earlier.
 *
 * Their page arriving is watched for as the tab row, not `.timeline-comment`: a
 * pull request opened minutes ago has no comments, so watching for a comment
 * waits forever on exactly the fresh pull requests this script wants. Their diff
 * is `.diff-line-row`, and their "Files changed" tab now routes to `/changes`.
 */

const EXTENSION = "/Users/alex/Documents/githubpro/.output/chrome-mv3";
const LIST = "https://github.com/microsoft/vscode/pulls?page=2";
const RUNS = 4;

/** Long enough to pass the 150ms dwell the prefetch waits for, and no longer than a reader would rest. */
const DWELL = 1.5;

const task = await useOrCreateTaskSpace("benchmark diff flow");
await takeOverTaskSpace(task.id);

const focus = async () => {
  await cdp("Emulation.setFocusEmulationEnabled", { enabled: true });
  await cdp("Page.bringToFront");
};

/**
 * Watches from the press until the diff is on the screen.
 *
 * Their conversation and their diff are different marks because the wait
 * between them is the reader's second press. Ours has one mark: the files are
 * on the page the press opened.
 */
const install = () =>
  js(String.raw`(() => {
    window.__marks = { gate: null, theirTalk: null, theirDiff: null, ourFiles: null, ourBody: null, tabAt: null }
    const theirDiff = () => document.querySelector(".diff-line-row") !== null
    document.addEventListener("click", () => {
      const t0 = performance.now()
      window.__t0 = t0
      const since = () => Math.round(performance.now() - t0)
      const timer = setInterval(() => {
        const marks = window.__marks
        if (marks.gate === null && document.documentElement.hasAttribute("data-githubpro-gating")) {
          marks.gate = since()
        }
        if (!location.pathname.includes("/pull/")) return
        const root = document.getElementById("githubpro-root")
        if (root !== null) {
          const headings = root.querySelectorAll("h2")
          if (marks.ourFiles === null && headings.length >= 2) marks.ourFiles = since()
          if (marks.ourBody === null && headings.length >= 2 &&
              !root.textContent.includes("Fetching this file")) {
            marks.ourBody = since()
            clearInterval(timer)
          }
          return
        }
        if (marks.theirTalk === null &&
            document.querySelector('[aria-label="Pull request navigation tabs"]') !== null) {
          marks.theirTalk = since()
        }
        if (marks.theirDiff === null && theirDiff()) {
          marks.theirDiff = since()
          clearInterval(timer)
        }
      }, 16)
    }, { capture: true, once: true })
    return true
  })()`);

const waitForTheirConversation = async () => {
  for (let tick = 0; tick < 120; tick++) {
    if (await js(String.raw`window.__marks?.theirTalk !== null`)) return true;
    await wait(0.25);
  }
  return false;
};

const numbersOnTheList = () =>
  js(String.raw`(() => {
    const seen = new Set()
    for (const link of document.querySelectorAll('a[href*="/pull/"]')) {
      const match = (link.getAttribute("href") || "").match(/\/pull\/(\d+)$/)
      if (match !== null) seen.add(match[1])
    }
    return [...seen]
  })()`);

const press = async (number) => {
  await gotoAndWait(LIST, { timeout: 60, settle: 3 });
  await wait(2);
  await install();
  const selector = 'a[href$="/pull/' + number + '"]';
  await hover(selector, { label: "dwell on the row" });
  await wait(DWELL);
  await click(selector, { label: "open the pull request" });
};

/** GitHub: press the row, then press "Files changed" the moment it is pressable. */
const theirRun = async (number) => {
  await press(number);
  const arrived = await waitForTheirConversation();
  if (!arrived) return await js(String.raw`window.__marks`);
  await js(
    String.raw`(() => { window.__marks.tabAt = Math.round(performance.now() - window.__t0); return true })()`,
  );
  try {
    await click('a[href$="/changes"], a[href$="/files"]', { label: "open Files changed" });
  } catch {
    return await js(String.raw`window.__marks`);
  }
  await wait(15);
  return await js(String.raw`window.__marks`);
};

const ourRun = async (number) => {
  await press(number);
  await wait(15);
  return await js(String.raw`window.__marks`);
};

const median = (numbers) =>
  numbers.length === 0
    ? null
    : [...numbers].sort((left, right) => left - right)[Math.floor(numbers.length / 2)];

const show = (value) => (value === null || value === undefined ? "—" : value + "ms");

await gotoAndWait(LIST, { timeout: 60, settle: 3 });
await focus();
await wait(2);
const numbers = (await numbersOnTheList()).slice(0, RUNS);
cliLog("pull requests: " + numbers.join(", "));

try {
  await cdp("Extensions.uninstall", { id: "ablmcookkmabldlblkojbpchnbdlogjd" }, null);
} catch {
  // Not installed, which is the state this half wants anyway.
}

cliLog("\nGitHub, extension uninstalled — press, then press Files changed:");
const theirDiffs = [];
for (const number of numbers) {
  const marks = await theirRun(number);
  if (typeof marks.theirDiff === "number") theirDiffs.push(marks.theirDiff);
  cliLog(
    `  #${number}  conversation ${show(marks.theirTalk)}, tab pressed ${show(marks.tabAt)}, diff ${show(marks.theirDiff)}`,
  );
}

const { id } = await cdp("Extensions.loadUnpacked", { path: EXTENSION }, null);
await focus();
cliLog(`\nThe interface, extension ${id} — press only:`);
const ourFiles = [];
const ourBodies = [];
for (const number of numbers) {
  const marks = await ourRun(number);
  if (typeof marks.ourFiles === "number") ourFiles.push(marks.ourFiles);
  if (typeof marks.ourBody === "number") ourBodies.push(marks.ourBody);
  cliLog(
    `  #${number}  gate ${show(marks.gate)}, files ${show(marks.ourFiles)}, readable ${show(marks.ourBody)}`,
  );
}

cliLog(`\n${"-".repeat(64)}`);
cliLog(`Press to a diff on the screen, median of ${RUNS}\n`);
cliLog(`  GitHub      ${show(median(theirDiffs))}  (two presses)`);
cliLog(`  ours        ${show(median(ourBodies))}  (one press)`);
