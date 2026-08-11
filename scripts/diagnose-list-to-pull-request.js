/**
 * Watches what happens between our repository list and the pull request it opens.
 *
 *     ego-browser nodejs < scripts/diagnose-list-to-pull-request.js
 *
 * The report is a skeleton and then an empty page. Both of this extension's
 * scripts are alive across that press — the list's, which is being left, and the
 * card's, which is arriving — and either one tearing down the other would look
 * exactly like this from the outside.
 *
 * Polled from out here rather than from a timer inside the page, which is the
 * first way this was written and which recorded nothing: the press replaces the
 * document, and anything the page was keeping goes with it. Every reading below
 * is a fresh evaluation against whatever document is on the screen now.
 */

const LIST = "https://github.com/octo-org/octo-repo/pulls";

/** Sixteen seconds at four readings a second, which outlasts the slowest read. */
const READINGS = 64;
const EVERY = 0.25;

const task = await useOrCreateTaskSpace("diagnose list to pull request");
await takeOverTaskSpace(task.id);

await cdp("Emulation.setFocusEmulationEnabled", { enabled: true });
await cdp("Page.bringToFront");

const state = () =>
  js(String.raw`(() => {
    const html = document.documentElement
    // Mid-navigation there is no document element yet, and asking one anything
    // throws. That moment is a real reading — the page is empty because it is
    // being replaced — rather than an error worth stopping for.
    if (html === null) return { path: location.pathname, replacing: true }
    const root = document.getElementById("gitquiet-root")
    return {
      path: location.pathname,
      root: root !== null,
      attached: root === null ? false : root.isConnected,
      height: root === null ? 0 : Math.round(root.getBoundingClientRect().height),
      gating: html.hasAttribute("data-gitquiet-gating"),
      taken: html.hasAttribute("data-gitquiet-taken"),
      revealed: html.hasAttribute("data-gitquiet-revealed"),
      says: (root?.textContent ?? "").trim().slice(0, 50)
    }
  })()`);

/** The numbers on our own list, which is the only list a reader can press. */
const ours = () =>
  js(String.raw`(() => {
    const root = document.getElementById("gitquiet-root")
    const seen = new Set()
    for (const link of root?.querySelectorAll('a[href*="/pull/"]') ?? []) {
      const found = (link.getAttribute("href") || "").match(/\/pull\/(\d+)$/)
      if (found !== null) seen.add(found[1])
    }
    return [...seen]
  })()`);

const open = async (number, settled) => {
  await gotoAndWait(LIST, { timeout: 60, settle: 3 });
  await wait(settled);

  // Ours, and the scope matters: GitHub's own list is hidden rather than removed,
  // so an unscoped selector finds their row first and presses something invisible.
  await click(`#gitquiet-root a[href$="/pull/${number}"]`, { label: `open ${number}` });

  const seen = [];
  for (let reading = 0; reading < READINGS; reading += 1) {
    const now = await state();
    const last = seen.at(-1);
    if (last === undefined || JSON.stringify({ ...last.was, at: 0 }) !== JSON.stringify({ ...now, at: 0 })) {
      seen.push({ at: Math.round(reading * EVERY * 1000), was: now });
    }
    await wait(EVERY);
  }

  const last = seen.at(-1)?.was;
  const blank = last === undefined || !last.root || last.height < 80;
  cliLog(
    `#${number} pressed after ${settled}s — ${blank ? "BLANK" : "drew"}: ` +
      `root ${last?.root}, height ${last?.height}, taken ${last?.taken}, ` +
      `revealed ${last?.revealed}, gating ${last?.gating}, says "${last?.says}"`
  );
  if (blank) cliLog(JSON.stringify(seen, null, 1));
  return blank;
};

await gotoAndWait(LIST, { timeout: 60, settle: 3 });
await wait(4);
const numbers = (await ours()).slice(0, 3);
cliLog(`pressing ${numbers.join(", ")}`);

let blanks = 0;
for (const settled of [0.5, 4]) {
  for (const number of numbers) if (await open(number, settled)) blanks += 1;
}

cliLog(`\n${blanks} of ${numbers.length * 2} presses came up blank`);
