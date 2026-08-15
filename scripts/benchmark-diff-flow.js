/**
 * Measures the press-to-diff flow, which is the one a reviewer actually runs.
 *
 *     ego-browser nodejs < scripts/benchmark-diff-flow.js
 *
 * `benchmark-click-flow.js` stops at the conversation, and that flatters GitHub:
 * their conversation is not the thing a reviewer came for. Reading a pull request
 * means reading the diff, and on GitHub the diff is behind a second navigation —
 * open the pull request, wait, press "Files changed", wait again. Here the files
 * are on the page the first open produced, so the second wait does not exist.
 *
 * That asymmetry is the measurement, and it is why the second press is counted
 * against GitHub. The tab is pressed the instant their conversation arrives,
 * which is faster than a person and therefore generous to them.
 *
 * Pull requests are taken from the second page of the list so neither side is
 * answering from something this profile fetched earlier, and both sides are given
 * the same pull requests, because time to a readable diff depends mostly on how
 * big the diff is.
 *
 * Their page arriving is watched for as the tab row, not `.timeline-comment`: a
 * pull request opened minutes ago has no comments, so watching for a comment
 * waits forever on exactly the fresh pull requests this script wants. Their diff
 * is `.diff-line-row`, and their "Files changed" tab now routes to `/changes`.
 *
 * ---
 *
 * Rewritten 2026-08-11, because the extension half had never produced a number.
 * It printed a dash on every run and the summary line printed a dash with it.
 *
 * It used to open the list and press a row, timing from a click listener and a
 * `window.__marks` object. That works only while the anchor it presses is the one
 * a reader sees. With the extension installed it is not: the extension draws its
 * own list into `#gitquiet-root` and leaves GitHub's markup in the document,
 * hidden. Those anchors measure 0x0 at the origin, so a coordinate click on
 * `a[href$="/pull/N"]` was landing in the top left corner of the page, on a `div`
 * whose `closest('a')` is null. Nothing was pressed, `location.pathname` never
 * reached `/pull/`, and every mark behind that condition stayed null for as long
 * as this script has existed.
 *
 * Pressing the extension's own visible row is the obvious repair and it is not
 * enough. That list is grouped by who acts next rather than by GitHub's paging,
 * so the 25 rows it shows are mostly not the pull requests GitHub's second page
 * offered, and the two halves would have been timing different diffs.
 *
 * So both halves now open the pull request URL cold. Same pull requests, same
 * starting line, and no hidden anchors. Two consequences worth stating:
 *
 *   - The extension reads a page ahead once the pointer has lingered in and around
 *     its link, and opening a URL never puts a pointer anywhere. So its number here
 *     is worse than the same pull request opened from its own list, and the
 *     comparison is conservative in GitHub's favour. `DWELL` is gone with the row
 *     press that needed it.
 *   - Marks are absolute wall clock, `performance.timeOrigin + performance.now()`,
 *     against a `Date.now()` taken in this process before the navigation is
 *     issued. Per-document clocks cannot be used because pressing "Files changed"
 *     may replace the document, which resets both `performance.now()` and any
 *     object left on `window`.
 *
 * The readable mark is deliberately several candidate signals rather than one.
 * `h2 >= 2` alone says the shell is up, which is not the same as a diff a person
 * can read, so the run prints each signal and the summary uses the strictest one
 * that fired.
 */

const EXTENSION = "/Users/alex/Documents/githubpro/.output/chrome-mv3";
const EXTENSION_ID = "ablmcookkmabldlblkojbpchnbdlogjd";
const LIST = "https://github.com/microsoft/vscode/pulls?page=2";

/**
 * Seven, not four.
 *
 * Four hand-timed trials do not support the one decimal place the marketing page
 * was printing, which is the second thing every reader of that page said about
 * it. Seven is still small and it is an odd number, so the median is a measured
 * trial rather than the mean of two.
 */
const RUNS = 7;

const task = await useOrCreateTaskSpace("benchmark diff flow");
await takeOverTaskSpace(task.id);

const focus = async () => {
  await cdp("Emulation.setFocusEmulationEnabled", { enabled: true });
  await cdp("Page.bringToFront");
};

/**
 * Records, in every document, when each side's page became readable.
 *
 * Installed once through `Page.addScriptToEvaluateOnNewDocument` so it is running
 * before the first byte of the page it is timing, rather than being injected
 * afterwards and guessing at what it missed.
 */
const RECORDER = String.raw`
  (() => {
    const now = () => Math.round(performance.timeOrigin + performance.now())
    const marks = {
      theirTalk: null, theirDiff: null,
      ourShell: null, ourSettled: null, ourCode: null
    }
    window.__gq = marks

    const timer = setInterval(() => {
      const root = document.getElementById('gitquiet-root')

      if (root !== null) {
        const headings = root.querySelectorAll('h2').length
        if (marks.ourShell === null && headings >= 2) marks.ourShell = now()

        /* The shell is up and nothing is still announcing a fetch. */
        if (marks.ourSettled === null && headings >= 2 &&
            !root.textContent.includes('Fetching this file')) {
          marks.ourSettled = now()
        }

        /*
         * Lines of code actually on the screen. The strictest signal, and the only
         * one that means what the marketing sentence claims.
         */
        if (marks.ourCode === null &&
            root.querySelector('pre, code, [data-line], [data-line-number]') !== null) {
          marks.ourCode = now()
        }
        if (marks.ourCode !== null && marks.ourSettled !== null) clearInterval(timer)
        return
      }

      if (marks.theirTalk === null &&
          document.querySelector('[aria-label="Pull request navigation tabs"]') !== null) {
        marks.theirTalk = now()
      }
      if (marks.theirDiff === null && document.querySelector('.diff-line-row') !== null) {
        marks.theirDiff = now()
        clearInterval(timer)
      }
    }, 16)

    /* A page that never arrives must not leave a timer running behind the next one. */
    setTimeout(() => clearInterval(timer), 40000)
  })()
`;

await cdp("Page.addScriptToEvaluateOnNewDocument", { source: RECORDER });

/** Waits for one of the recorder's marks, and gives up rather than hanging the run. */
const waitForMark = async (name, seconds) => {
  for (let tick = 0; tick < seconds * 4; tick++) {
    const at = await js(String.raw`window.__gq?.` + name + String.raw` ?? null`);
    if (at !== null) return at;
    await wait(0.25);
  }
  return null;
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

const url = (number) => "https://github.com/microsoft/vscode/pull/" + number;

/** GitHub: open the pull request, then press "Files changed" the moment it is pressable. */
const theirRun = async (number) => {
  const t0 = Date.now();
  await gotoAndWait(url(number), { timeout: 60, settle: 0 });
  const talk = await waitForMark("theirTalk", 30);
  if (talk === null) return { talk: null, diff: null };

  try {
    await click('a[href$="/changes"], a[href$="/files"]', { label: "open Files changed" });
  } catch {
    return { talk: talk - t0, diff: null };
  }

  const diff = await waitForMark("theirDiff", 30);
  return { talk: talk - t0, diff: diff === null ? null : diff - t0 };
};

const ourRun = async (number) => {
  const t0 = Date.now();
  await gotoAndWait(url(number), { timeout: 60, settle: 0 });
  const code = await waitForMark("ourCode", 30);
  const settled = await js(String.raw`window.__gq?.ourSettled ?? null`);
  const shell = await js(String.raw`window.__gq?.ourShell ?? null`);
  return {
    shell: shell === null ? null : shell - t0,
    settled: settled === null ? null : settled - t0,
    code: code === null ? null : code - t0
  };
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
  await cdp("Extensions.uninstall", { id: EXTENSION_ID }, null);
} catch {
  // Not installed, which is the state this half wants anyway.
}

cliLog("\nGitHub, extension uninstalled — open the pull request, then press Files changed:");
const theirDiffs = [];
for (const number of numbers) {
  const marks = await theirRun(number);
  if (typeof marks.diff === "number") theirDiffs.push(marks.diff);
  cliLog(`  #${number}  conversation ${show(marks.talk)}, diff ${show(marks.diff)}`);
}

const { id } = await cdp("Extensions.loadUnpacked", { path: EXTENSION }, null);
await focus();
cliLog(`\nThe interface, extension ${id} — open the pull request:`);
const ourShells = [];
const ourSettled = [];
const ourCode = [];
for (const number of numbers) {
  const marks = await ourRun(number);
  if (typeof marks.shell === "number") ourShells.push(marks.shell);
  if (typeof marks.settled === "number") ourSettled.push(marks.settled);
  if (typeof marks.code === "number") ourCode.push(marks.code);
  cliLog(
    `  #${number}  shell ${show(marks.shell)}, settled ${show(marks.settled)}, code on screen ${show(marks.code)}`
  );
}

/* The strictest signal that fired on every run is the one worth quoting. */
const ours = ourCode.length === numbers.length ? ourCode : ourSettled;
const which = ourCode.length === numbers.length ? "code on screen" : "shell settled";

cliLog(`\n${"-".repeat(64)}`);
cliLog(`Open a pull request, reach a diff on the screen. Median of ${RUNS}\n`);
cliLog(`  GitHub      ${show(median(theirDiffs))}  (two presses)`);
cliLog(`  ours        ${show(median(ours))}  (one press, ${which})`);
cliLog(`\n  their runs that reached a diff: ${theirDiffs.length}/${numbers.length}`);
cliLog(`  our runs that reached code:     ${ourCode.length}/${numbers.length}`);
