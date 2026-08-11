/**
 * Measures the way a pull request is actually opened: pointer rests on a row in
 * the list, then presses it.
 *
 *     ego-browser nodejs < scripts/benchmark-click-flow.js
 *
 * This is the measurement that matters, and it is not the one you get by typing
 * a pull request into the address bar. A press from the list is a soft
 * navigation — no second document, no second time to first byte — and the
 * pointer resting on the row for 150ms has already read the pull request ahead
 * (src/entrypoints/prefetch.content.ts). Measured from the address bar instead,
 * both of those advantages are thrown away and the interface looks two seconds
 * slower than it is.
 *
 * Two traps, both of which produced wrong answers before this script existed:
 *
 * 1. A background tab is throttled by Chrome, and GitHub's conversation may
 *    never render in one at all. `Emulation.setFocusEmulationEnabled` and
 *    `Page.bringToFront` are not optional here.
 * 2. GitHub's pull request page carries none of `.repository-content`,
 *    `#discussion_bucket` or a title update, so watching for those measures
 *    nothing forever. `.timeline-comment` is their conversation arriving.
 *
 * The baseline runs with the extension uninstalled over the protocol rather
 * than switched to GitHub's view, so nothing of ours is on the page at all.
 */

const EXTENSION = "/Users/alex/Documents/githubpro/.output/chrome-mv3";
const LIST = "https://github.com/microsoft/vscode/pulls";
const RUNS = 4;

/** Long enough to pass the 150ms dwell the prefetch waits for, and no longer than a reader would rest. */
const DWELL = 1.5;

const task = await useOrCreateTaskSpace("benchmark click flow");
await takeOverTaskSpace(task.id);

const focus = async () => {
  await cdp("Emulation.setFocusEmulationEnabled", { enabled: true });
  await cdp("Page.bringToFront");
};

/**
 * Watches from the press until the pull request is readable.
 *
 * `gate` is when GitHub's conversation is hidden, which is when the reader
 * stops looking at the page they left. `ready` is ours populated, or theirs
 * arriving, depending on which is on the page.
 */
const install = () =>
  js(String.raw`(() => {
    window.__marks = { t0: null, gate: null, ours: null, theirs: null }
    document.addEventListener("click", () => {
      window.__marks.t0 = performance.now()
      const timer = setInterval(() => {
        const marks = window.__marks
        const since = () => Math.round(performance.now() - marks.t0)
        if (marks.gate === null && document.documentElement.hasAttribute("data-gitquiet-gating")) {
          marks.gate = since()
        }
        if (!location.pathname.includes("/pull/")) return
        const root = document.getElementById("gitquiet-root")
        // Ours is readable when the skeleton has gone, which is the one thing on
        // the page that says the pull request has not been read yet. Not a
        // heading: the skeleton draws the real panel names from the first frame,
        // so a heading is there long before anything it names is.
        if (marks.ours === null && root !== null && root.querySelector("h2") !== null &&
            root.querySelector("[data-gitquiet-loading]") === null) {
          marks.ours = since()
          clearInterval(timer)
        }
        if (marks.theirs === null && document.querySelector(".timeline-comment") !== null) {
          marks.theirs = since()
          clearInterval(timer)
        }
      }, 16)
    }, { capture: true, once: true })
    return true
  })()`);

const numbersOnTheList = () =>
  js(String.raw`(() => {
    const seen = new Set()
    for (const link of document.querySelectorAll('a[href*="/pull/"]')) {
      const match = (link.getAttribute("href") || "").match(/\/pull\/(\d+)$/)
      if (match !== null) seen.add(match[1])
    }
    return [...seen]
  })()`);

const clickThrough = async (number) => {
  await gotoAndWait(LIST, { timeout: 60, settle: 3 });
  await wait(2);
  await install();
  const selector = 'a[href$="/pull/' + number + '"]';
  await hover(selector, { label: "dwell on the row" });
  await wait(DWELL);
  await click(selector, { label: "open the pull request" });
  await wait(12);
  return await js(String.raw`window.__marks ?? { lost: true }`);
};

const median = (numbers) =>
  [...numbers].sort((left, right) => left - right)[Math.floor(numbers.length / 2)];

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

cliLog("\nGitHub's own page, extension uninstalled:");
const theirs = [];
for (const number of numbers) {
  const marks = await clickThrough(number);
  if (marks.theirs !== null && marks.theirs !== undefined) theirs.push(marks.theirs);
  cliLog(`  #${number}  ${marks.theirs ?? "—"}ms to their conversation`);
}

const { id } = await cdp("Extensions.loadUnpacked", { path: EXTENSION }, null);
await focus();
cliLog(`\nThe interface, extension ${id}:`);
const ours = [];
const gates = [];
for (const number of numbers) {
  const marks = await clickThrough(number);
  if (marks.ours !== null && marks.ours !== undefined) ours.push(marks.ours);
  if (marks.gate !== null && marks.gate !== undefined) gates.push(marks.gate);
  cliLog(`  #${number}  ${marks.ours ?? "—"}ms to the interface, gate at ${marks.gate ?? "—"}ms`);
}

cliLog(`\n${"-".repeat(64)}`);
cliLog(`Press to readable pull request, median of ${RUNS}\n`);
cliLog(`  GitHub      ${median(theirs)}ms`);
cliLog(`  ours        ${median(ours)}ms, their conversation gone at ${median(gates)}ms`);
cliLog(
  `\n  The first press of a session costs about a second more: the worker` +
    `\n  is asleep and the interface's script has to be injected.`
);
