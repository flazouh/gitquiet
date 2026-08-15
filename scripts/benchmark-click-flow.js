/**
 * Measures the way a pull request is actually opened: pointer rests on a row in
 * the list, then presses it. Runs the same flow twice, warm and cold, because
 * the two answer different questions and only one of them was ever measured.
 *
 *     ego-browser nodejs < scripts/benchmark-click-flow.js
 *
 * This is the measurement that matters, and it is not the one you get by typing
 * a pull request into the address bar. A press from the list is a soft
 * navigation, with no second document and no second time to first byte, and the
 * pointer resting on the row for 150ms has already read the pull request ahead
 * (src/entrypoints/prefetch.content.ts). Measured from the address bar instead,
 * both of those advantages are thrown away and the interface looks two seconds
 * slower than it is.
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
 * Starts the clock in the page, where the press happens.
 *
 * `sessionStorage` rather than `window`, because GitHub's own list leaves the
 * document when a row is pressed and anything held on `window` leaves with it.
 * That is what made every baseline cell read `—`. `Date.now()` rather than
 * `performance.now()`, because the second document starts that clock again and
 * the elapsed time would be measured from the wrong zero.
 */
const install = () =>
  js(String.raw`(() => {
    sessionStorage.setItem("__bench", JSON.stringify({ t0: null }))
    document.addEventListener("click", () => {
      sessionStorage.setItem("__bench", JSON.stringify({ t0: Date.now() }))
    }, { capture: true, once: true })
    return true
  })()`);

/**
 * One reading of the page, with the elapsed time the page itself computes.
 *
 * The end is sampled from here rather than by a timer in the page. A timer would
 * be finer, but it cannot be put into GitHub's second document without
 * `Page.addScriptToEvaluateOnNewDocument`, which this runtime does not carry.
 * Both sides are therefore read the same way, and both carry the same round-trip
 * error, which is what keeps the two columns comparable.
 */
const sample = () =>
  js(String.raw`(() => {
    const marks = JSON.parse(sessionStorage.getItem("__bench") || "null")
    if (marks === null || marks.t0 === null) return { armed: false }
    const root = document.getElementById("gitquiet-root")
    return {
      armed: true,
      at: Date.now() - marks.t0,
      onPull: location.pathname.includes("/pull/"),
      gating: document.documentElement.hasAttribute("data-gitquiet-gating"),
      // Ours is readable when the interface says it is showing the conversation
      // and the skeleton has gone. The attribute matters: without it the reading
      // catches the list still standing under the new URL and reports the gate
      // twice, which is how cold once came out faster than warm.
      oursReady: document.documentElement.getAttribute("data-gitquiet-shown") === "conversation" &&
        root !== null && root.querySelector("h2") !== null &&
        root.querySelector("[data-gitquiet-loading]") === null,
      theirsReady: document.querySelector(".timeline-comment") !== null
    }
  })()`);

/** Reads until the pull request is readable, or until the wait runs out. */
const watch = async (seconds) => {
  const marks = { gate: null, ours: null, theirs: null };
  const until = Date.now() + seconds * 1000;
  while (Date.now() < until) {
    let state;
    try {
      state = await sample();
    } catch {
      // The document is being swapped under us, which is the navigation itself.
      continue;
    }
    if (state.armed) {
      if (marks.gate === null && state.gating) marks.gate = state.at;
      if (state.onPull) {
        if (marks.ours === null && state.oursReady) marks.ours = state.at;
        if (marks.theirs === null && state.theirsReady) marks.theirs = state.at;
      }
      if (marks.ours !== null || marks.theirs !== null) return marks;
    }
  }
  return marks;
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

const theirs = { warm: [], cold: [] };
for (const dwell of [DWELL, 0]) {
  const which = dwell > 0 ? "warm" : "cold";
  cliLog(`\nGitHub's own page, no extension, ${which}:`);
  for (const number of numbers) {
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
  for (const number of pressed) {
    const marks = await clickThrough(number, "#gitquiet-root ", dwell);
    if (typeof marks.ours === "number") ours[which].push(marks.ours);
    if (typeof marks.gate === "number") gates[which].push(marks.gate);
    cliLog(
      `  #${number}  ${show(marks.ours ?? undefined)} to the interface, gate at ${show(marks.gate ?? undefined)}`
    );
  }
}

cliLog(`\n${"-".repeat(64)}`);
cliLog(`Press to readable pull request, median of ${RUNS}\n`);
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
