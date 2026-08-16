/**
 * Records one press as a real frame stream, not a burst of screenshots.
 *
 * `captureScreenshot` costs about 700ms a frame, which is six frames across a
 * two-second page load and no use at all for a video. `Page.startScreencast`
 * has Chrome push frames instead, but it stops after the first one unless every
 * frame is acked, which is what the loop below is for.
 *
 * Each frame is written with the milliseconds since the press in its filename,
 * taken from the page's own clock, so the two sides can be cut against each
 * other on measured time rather than by eye.
 */
const OUT = "/private/tmp/claude-501/-Users-alex-Documents-githubpro--claude-worktrees-gitquiet-marketing-strategy-d7a62c/9aaedb67-d399-403a-902a-01e5c5c40890/scratchpad/race";
const SIDE = "__SIDE__";
const LIST = "https://github.com/microsoft/vscode/pulls";
const SECONDS = 6;

const { writeFileSync } = await import("node:fs");

const task = await useOrCreateTaskSpace("race capture");
cliLog("space " + task.id + ", side " + SIDE);

await gotoAndWait(LIST, { timeout: 60, settle: 4 });
await cdp("Emulation.setFocusEmulationEnabled", { enabled: true });
await cdp("Page.bringToFront");
await wait(3);

const scope = SIDE === "ours" ? "#gitquiet-root " : "";
const number = await js(String.raw`(() => {
  const within = ` + JSON.stringify(scope.trim()) + String.raw`
  const root = within === "" ? document : document.querySelector(within)
  if (root === null) return null
  for (const a of root.querySelectorAll('a[href*="/pull/"]')) {
    const m = (a.getAttribute("href") || "").match(/\/pull\/(\d+)$/)
    const b = a.getBoundingClientRect()
    if (m !== null && b.width > 200 && b.height > 0) return m[1]
  }
  return null
})()`);
if (number === null) throw new Error("no pressable row for side " + SIDE);
cliLog("pressing #" + number);

await js(String.raw`(() => {
  sessionStorage.setItem("__race", JSON.stringify({ t0: null }))
  document.addEventListener("click", () => {
    sessionStorage.setItem("__race", JSON.stringify({ t0: Date.now() }))
  }, { capture: true, once: true })
  return true
})()`);

await cdp("Page.startScreencast", {
  format: "jpeg",
  quality: 80,
  maxWidth: 1600,
  maxHeight: 1000,
  everyNthFrame: 1,
});

/*
 * Rest on the row before pressing, which is the case the numbers are quoted for.
 *
 * Recorded cold the first time, and it showed the wrong thing: at 300ms ours is a
 * spinner reading "Reading this pull request", because with no dwell the prefetch
 * never fired and there was nothing to paint yet. The claim is about a reader who
 * rests on a row, so the recording has to rest on it too.
 */
const selector = scope + 'a[href$="/pull/' + number + '"]';
await hover(selector, { label: "rest on the row" });
await wait(1.5);

const pressedAt = Date.now();
await click(selector, { label: "open the pull request" });

let saved = 0;
const stamps = [];
const until = Date.now() + SECONDS * 1000;
while (Date.now() < until) {
  // Re-arm every pass. A press on their list replaces the document, which resets
  // the Page domain and stops the screencast with it, so one call before the
  // press records the list and nothing after it.
  try {
    await cdp("Page.startScreencast", {
      format: "jpeg", quality: 80, maxWidth: 1600, maxHeight: 1000, everyNthFrame: 1,
    });
  } catch {
    // Already running, which is the state this wants.
  }
  let events = [];
  try {
    const drained = await drainEvents();
    events = Array.isArray(drained) ? drained : drained?.events || [];
  } catch {
    // The document is swapping, which is the navigation itself.
  }
  for (const event of events) {
    if (event.method !== "Page.screencastFrame") continue;
    const { data, sessionId } = event.params || {};
    if (typeof data !== "string") continue;
    // Absolute wall clock, renamed against the page's own click event once the
    // burst is over. Stamping against a Node timestamp taken before `click()`
    // put every frame two to four hundred milliseconds early, because the press
    // happens inside that call and not before it.
    const at = Date.now();
    writeFileSync(OUT + "/" + SIDE + "/abs-" + at + ".jpg", Buffer.from(data, "base64"));
    stamps.push(at);
    saved += 1;
    try {
      await cdp("Page.screencastFrameAck", { sessionId });
    } catch {
      // A dropped ack costs one frame, not the run.
    }
  }
}

try {
  await cdp("Page.stopScreencast", {});
} catch {
  // Already stopped with the document.
}

/*
 * Re-stamp against the press the page itself recorded.
 *
 * Both clocks are this machine's wall clock, so the page's `t0` and the Node
 * timestamps on the frames are directly comparable, and the frames end up on the
 * same zero the benchmark measures from.
 */
const { renameSync, existsSync } = await import("node:fs");
let t0 = null;
try {
  t0 = await js(String.raw`(() => { const m = JSON.parse(sessionStorage.getItem("__race") || "null"); return m && m.t0 })()`);
} catch {
  // The document went with the navigation; nothing to align to.
}
if (t0 === null) throw new Error("the page never recorded a press, so the frames cannot be aligned");

// Two frames can land in the same millisecond, in which case the second write
// took the first one's name. Renaming the set rather than the list avoids
// chasing a file that was already consumed.
for (const abs of [...new Set(stamps)]) {
  const from = OUT + "/" + SIDE + "/abs-" + abs + ".jpg";
  if (!existsSync(from)) continue;
  renameSync(from, OUT + "/" + SIDE + "/" + String(Math.max(0, abs - t0)).padStart(5, "0") + ".jpg");
}

cliLog("frames saved: " + saved);
cliLog("aligned to the page's press; first " + (stamps[0] - t0) + "ms, last " + (stamps[stamps.length - 1] - t0) + "ms");
cliLog("effective fps: " + Math.round((saved / SECONDS) * 10) / 10);
