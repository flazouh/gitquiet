/**
 * Measures the way a pull request is actually opened: pointer rests on a row in
 * the list, then presses it. Runs the same flow twice, warm and cold, because
 * the two answer different questions and only one of them was ever measured.
 *
 *     ego-browser nodejs < scripts/benchmark-click-flow.js
 *
 * This is the measurement that matters, and it is not the one you get by typing
 * a pull request into the address bar. A press from the list is a soft
 * navigation, with no second document and no second time to first byte, and a
 * pointer that has lingered in and around the row has already read the pull
 * request ahead (src/entrypoints/shell.content.ts, src/ui/lingering.ts).
 * Measured from the address bar instead, both of those advantages are thrown
 * away and the interface looks two seconds slower than it is.
 *
 * Warm is a reader who rests on the row. Cold is a reader who presses the moment
 * the pointer arrives, so the prefetch never fires. Nothing may be called the
 * time to open a pull request in general unless both are quoted.
 *
 * Four traps, and every one of them has produced a wrong answer here:
 *
 * 1. A background tab is throttled by Chrome, and GitHub's conversation may
 *    never render in one at all. `Emulation.setFocusEmulationEnabled` and
 *    `Page.bringToFront` are not optional.
 * 2. GitHub's pull request page carries none of `.repository-content`,
 *    `#discussion_bucket` or a title update, so watching for those measures
 *    nothing forever. `.timeline-comment` is their conversation arriving.
 * 3. The extension's id is assigned by `Extensions.loadUnpacked` and changes
 *    between profiles. Uninstalling a hard-coded id fails silently, the
 *    baseline half runs with the interface still on the page, and every cell
 *    comes back empty. Discover the id from the loaded targets instead.
 * 4. On the pages the interface takes over, GitHub's own anchors are still in
 *    the document at zero by zero. Pressing one navigates nowhere. Our half
 *    has to press our row, inside `#gitquiet-root`, and the baseline half
 *    theirs.
 */

const EXTENSION = "/Users/alex/Documents/githubpro/.output/chrome-mv3";
const LIST = "https://github.com/microsoft/vscode/pulls";
/**
 * Eight, so warm and cold can have four each.
 *
 * They must not be the same four. Pressing a pull request warm and then pressing
 * it again cold reads it out of the interface's own cache the second time, and
 * the cold column comes back at warm speed having measured nothing. Two runs of
 * this script disagreed by a factor of twenty-five on exactly that.
 */
const RUNS = 8;

/** Well past the point the read-ahead fires, and no longer than a reader would rest. */
const DWELL = 1.5;

const task = await useOrCreateTaskSpace("benchmark click flow");
await takeOverTaskSpace(task.id);

const focus = async () => {
  await cdp("Emulation.setFocusEmulationEnabled", { enabled: true });
  await cdp("Page.bringToFront");
};

/**
 * Every extension on this page, by the id its own files are served from.
 *
 * Read from the document rather than from `Target.getTargets`, which only sees an
 * extension whose service worker happens to be awake. A suspended copy is
 * invisible there, is never uninstalled, and goes on drawing the page through a
 * baseline that is supposed to have none of it.
 *
 * The profile this was written against held two copies of the interface at once:
 * the unpacked build, and the one from the web store. Both answered every event.
 */
const extensionsOnThePage = async () => {
  const fromPage = await js(String.raw`(() => {
    const ids = new Set()
    const grab = (value) => {
      const found = String(value || "").match(/chrome-extension:\/\/([a-z]{32})/)
      if (found !== null) ids.add(found[1])
    }
    for (const node of document.querySelectorAll("[src],[href]")) {
      grab(node.getAttribute("src"))
      grab(node.getAttribute("href"))
    }
    for (const sheet of document.styleSheets) { try { grab(sheet.href) } catch { /* cross-origin */ } }
    for (const node of document.querySelectorAll("*")) {
      const image = getComputedStyle(node).backgroundImage
      if (image.includes("chrome-extension")) grab(image)
    }
    return [...ids]
  })()`);
  const { targetInfos = [] } = await cdp("Target.getTargets", {}, null);
  const fromTargets = targetInfos
    .map((info) => (String(info.url || "").match(/^chrome-extension:\/\/([a-z]+)/) || [])[1])
    .filter(Boolean);
  return [...new Set([...fromPage, ...fromTargets])];
};

/**
 * Leaves the profile with no extension at all.
 *
 * Every copy, not the one we remember loading: `loadUnpacked` persists across
 * task spaces, so a session accumulates them and each one answers every event.
 */
const removeEveryExtension = async () => {
  const ids = await extensionsOnThePage();
  for (const id of ids) {
    try {
      await cdp("Extensions.uninstall", { id }, null);
    } catch {
      // Already gone, which is the state this wants.
    }
  }
  await gotoAndWait(LIST, { timeout: 60, settle: 3 });
  await wait(2);
  const left = await js(`!!document.getElementById("gitquiet-root")`);
  if (left) throw new Error("the interface is still on the page after uninstalling " + ids.join(", "));
  return ids;
};

/**
 * Records, in every document, when the pull request became readable.
 *
 * Installed through `Page.addScriptToEvaluateOnNewDocument` so the timer is
 * running before the first byte of the page it is timing. GitHub's own list
 * leaves the document when a row is pressed, so a timer injected afterwards
 * would be measuring a page it arrived too late to see the start of, and
 * anything held on `window` would have left with the first document.
 *
 * The clock is `Date.now()` and the press time lives in `sessionStorage`, both
 * for the same reason: `performance.now()` starts again in the second document
 * and the elapsed time would be measured from the wrong zero.
 */
const RECORDER = String.raw`(() => {
  if (window.__benchRunning) return
  window.__benchRunning = true
  const KEY = "__bench"
  const read = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || "null") } catch { return null } }
  setInterval(() => {
    const marks = read()
    if (marks === null || marks.t0 === null || marks.done) return
    const since = () => Date.now() - marks.t0
    if (marks.gate === null && document.documentElement.hasAttribute("data-gitquiet-gating")) {
      marks.gate = since()
    }
    if (location.pathname.includes("/pull/")) {
      const root = document.getElementById("gitquiet-root")
      // Ours is readable when the interface says it is showing the conversation
      // and the skeleton has gone. The attribute matters: without it the timer
      // catches the list still standing under the new URL and reports the gate
      // twice, which is how cold once came out faster than warm.
      if (marks.ours === null &&
          document.documentElement.getAttribute("data-gitquiet-shown") === "conversation" &&
          root !== null && root.querySelector("h2") !== null &&
          root.querySelector("[data-gitquiet-loading]") === null) {
        marks.ours = since()
        marks.done = true
      }
      if (marks.theirs === null && document.querySelector(".timeline-comment") !== null) {
        marks.theirs = since()
        marks.done = true
      }
    }
    sessionStorage.setItem(KEY, JSON.stringify(marks))
  }, 16)
})()`

await cdp("Page.addScriptToEvaluateOnNewDocument", { source: RECORDER });

/** Clears the last press and starts the clock on the next one. */
const install = async () => {
  await js(String.raw`(() => {
    sessionStorage.setItem("__bench", JSON.stringify({ t0: null, gate: null, ours: null, theirs: null, done: false }))
    document.addEventListener("click", () => {
      const marks = JSON.parse(sessionStorage.getItem("__bench"))
      marks.t0 = Date.now()
      sessionStorage.setItem("__bench", JSON.stringify(marks))
    }, { capture: true, once: true })
    return true
  })()`);
  await js(RECORDER);
};

/** Waits for the timer to say the pull request is readable, or gives up. */
const watch = async (seconds) => {
  const until = Date.now() + seconds * 1000;
  let last = { gate: null, ours: null, theirs: null };
  while (Date.now() < until) {
    try {
      const marks = await js(String.raw`JSON.parse(sessionStorage.getItem("__bench") || "null")`);
      if (marks !== null) {
        last = marks;
        if (marks.done) return marks;
      }
    } catch {
      // The document is being swapped under us, which is the navigation itself.
    }
    await wait(0.25);
  }
  return last;
};

/**
 * The pull requests on the list, read from whichever list is actually drawn.
 *
 * Ours when the interface is on, theirs when it is not, because the two lists
 * do not hold the same pull requests in the same order.
 */
const numbersOnTheList = (scope) =>
  js(String.raw`(() => {
    const within = ` + JSON.stringify(scope) + String.raw`
    const root = within === "" ? document : document.getElementById("gitquiet-root")
    if (root === null) return []
    const seen = new Set()
    for (const link of root.querySelectorAll('a[href*="/pull/"]')) {
      const match = (link.getAttribute("href") || "").match(/\/pull\/(\d+)$/)
      if (match === null) continue
      // Zero by zero is the hidden copy of their list under our takeover. It is
      // in the document, it is pressable by the protocol, and pressing it goes
      // nowhere at all.
      const box = link.getBoundingClientRect()
      if (box.width === 0 || box.height === 0) continue
      seen.add(match[1])
    }
    return [...seen]
  })()`);

/**
 * One press, from the list to a readable pull request.
 *
 * `dwell` of 0 is the cold reader. The press then carries whatever pointerover
 * the protocol's own mouse move fires a few milliseconds earlier, which is
 * under the 150ms the prefetch waits for, so nothing has been read ahead.
 */
const clickThrough = async (number, scope, dwell) => {
  await gotoAndWait(LIST, { timeout: 60, settle: 3 });
  await wait(2);
  await install();
  const selector = scope + 'a[href$="/pull/' + number + '"]';
  if (dwell > 0) {
    await hover(selector, { label: "dwell on the row" });
    await wait(dwell);
  }
  await click(selector, { label: "open the pull request" });
  return await watch(12);
};

const median = (numbers) =>
  numbers.length === 0
    ? undefined
    : [...numbers].sort((left, right) => left - right)[Math.floor(numbers.length / 2)];

const show = (value) => (value === undefined ? "—" : value + "ms");

await gotoAndWait(LIST, { timeout: 60, settle: 3 });
await focus();
await wait(2);

const removed = await removeEveryExtension();
cliLog("extensions removed for the baseline: " + (removed.join(", ") || "none were loaded"));

await gotoAndWait(LIST, { timeout: 60, settle: 3 });
await focus();
await wait(2);
const numbers = (await numbersOnTheList("")).slice(0, RUNS);
cliLog("pull requests: " + numbers.join(", "));

/** Warm takes the first half of the list, cold the second, so neither warms the other. */
const half = (which) =>
  which === "warm" ? numbers.slice(0, numbers.length / 2) : numbers.slice(numbers.length / 2);

const theirs = { warm: [], cold: [] };
for (const dwell of [DWELL, 0]) {
  const which = dwell > 0 ? "warm" : "cold";
  cliLog(`\nGitHub's own page, no extension, ${which}:`);
  for (const number of half(which)) {
    const marks = await clickThrough(number, "", dwell);
    if (typeof marks.theirs === "number") theirs[which].push(marks.theirs);
    cliLog(`  #${number}  ${show(marks.theirs ?? undefined)} to their conversation`);
  }
}

const { id } = await cdp("Extensions.loadUnpacked", { path: EXTENSION }, null);
await focus();
await gotoAndWait(LIST, { timeout: 60, settle: 3 });
await wait(3);

const ours = { warm: [], cold: [] };
const gates = { warm: [], cold: [] };
const mine = (await numbersOnTheList("#gitquiet-root ")).filter((n) => numbers.includes(n));
const pressed = mine.length > 0 ? mine : numbers;
cliLog(`\nThe interface, extension ${id}. Pressing: ${pressed.join(", ")}`);

for (const dwell of [DWELL, 0]) {
  const which = dwell > 0 ? "warm" : "cold";
  cliLog(`\nThe interface, ${which}:`);
  const mineFor = which === "warm" ? pressed.slice(0, pressed.length / 2) : pressed.slice(pressed.length / 2);
  for (const number of mineFor) {
    const marks = await clickThrough(number, "#gitquiet-root ", dwell);
    if (typeof marks.ours === "number") ours[which].push(marks.ours);
    if (typeof marks.gate === "number") gates[which].push(marks.gate);
    cliLog(
      `  #${number}  ${show(marks.ours ?? undefined)} to the interface, gate at ${show(marks.gate ?? undefined)}`
    );
  }
}

cliLog(`\n${"-".repeat(64)}`);
cliLog(`Press to readable pull request, median of ${RUNS / 2} per column\n`);
cliLog(`             warm (1.5s dwell)   cold (no dwell)`);
cliLog(`  GitHub     ${show(median(theirs.warm)).padEnd(19)}${show(median(theirs.cold))}`);
cliLog(`  ours       ${show(median(ours.warm)).padEnd(19)}${show(median(ours.cold))}`);
cliLog(`  gate       ${show(median(gates.warm)).padEnd(19)}${show(median(gates.cold))}`);
cliLog(
  `\n  Warm is a reader who rests on the row, which the prefetch reads ahead of.` +
    `\n  Cold is a reader who presses at once. Quote both or neither.` +
    `\n\n  The first press of a session costs about a second more: the worker` +
    `\n  is asleep and the interface's script has to be injected.`
);
