/**
 * What the merge card says on a squash-only repository, with the built extension.
 *
 *     bun run build && ego-browser nodejs < scripts/qa-merge-method.js
 *
 * Opens `flazouh/perry-proof-qa#2`, which is squash only and carries a base branch
 * ruleset saying the same, and reports the blocker rows the card drew and the word on
 * the button that lands the change. Before the merge method was read off the merge box,
 * the card asked GitHub about a merge commit and drew whatever GitHub refused it for.
 */

const EXTENSION = "/Users/alex/Documents/githubpro/.output/chrome-mv3";
const PULL = process.env.QA_PULL ?? "https://github.com/flazouh/perry-proof-qa/pull/2";

const task = await useOrCreateTaskSpace("merge method qa");

const { id } = await cdp("Extensions.loadUnpacked", { path: EXTENSION }, null);
cliLog(`loaded ${id}`);

await gotoAndWait(PULL, { timeout: 30, settle: 3 });
await wait(3);

const said = await js(String.raw`(() => {
  const root = document.getElementById("gitquiet-root")
  if (root === null) return { mounted: false }

  const section = [...root.querySelectorAll("section, div")].find(
    (one) => one.querySelector("h2, h3")?.textContent?.trim() === "Merge"
  )
  const card = section ?? root

  return {
    mounted: true,
    summary: card.querySelector("h2, h3")?.parentElement?.textContent?.trim() ?? null,
    buttons: [...card.querySelectorAll("button")].map((one) => one.innerText.trim()).filter(Boolean),
    said: [...card.querySelectorAll("p, li")].map((one) => one.textContent.trim()).filter(Boolean)
  }
})()`);

cliLog(JSON.stringify(said, null, 1));

/*
 * The card alone, clipped out of the page rather than shot with it.
 *
 * The window this runs in is shorter than the column the card sits at the foot of, so a
 * plain screenshot catches the sections above it and cuts the card off. `captureBeyondViewport`
 * takes the clip from the laid-out page instead of from what is on the screen.
 */
/*
 * A taller window before the clip is measured. `captureBeyondViewport` is clamped
 * to the window's own height here, so a card below the fold comes back cut off at
 * exactly the same line however the clip is written. Growing the window moves the
 * fold instead.
 */
await cdp("Emulation.setDeviceMetricsOverride", {
  width: 1400,
  height: 1600,
  deviceScaleFactor: 2,
  mobile: false
});
await wait(2);

const box = await js(String.raw`(() => {
  const root = document.getElementById("gitquiet-root")
  const heading = [...root.querySelectorAll("h2, h3")].find((one) => one.textContent.trim() === "Merge")
  /*
   * From the heading down to the last control, rather than from any one
   * ancestor's rectangle. The card sits in a column of sections and no single
   * element's box covers the heading and the row of buttons both.
   */
  const buttons = [...document.querySelectorAll("#gitquiet-root button")].filter((one) =>
    /Squash and merge|Close pull request/.test(one.innerText)
  )
  const top = heading.getBoundingClientRect()
  const foot = buttons[buttons.length - 1].getBoundingClientRect()
  const column = heading.closest("section")?.getBoundingClientRect() ?? top

  return {
    x: column.x + window.scrollX - 8,
    y: top.y + window.scrollY - 16,
    width: column.width + 16,
    height: foot.bottom - top.y + 32,
    scale: 2
  }
})()`);

const shot = await cdp("Page.captureScreenshot", {
  format: "png",
  clip: box,
  captureBeyondViewport: true
});
const { writeFile } = await import("node:fs/promises");
await writeFile("/tmp/merge-card.png", Buffer.from(shot.data, "base64"));
cliLog("/tmp/merge-card.png");

await cdp("Emulation.clearDeviceMetricsOverride", {});

await cdp("Extensions.uninstall", { id }, null);
await completeTaskSpace(task.id, { keep: false });
