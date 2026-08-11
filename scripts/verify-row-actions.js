/**
 * Row actions on the screen without a pointer anywhere near them.
 *
 *     bun run build && ego-browser nodejs < scripts/verify-row-actions.js
 *
 * The complaint this answers is about discoverability, so the measurement has to be made the
 * way a reader who has never hovered would meet it: computed opacity, with the pointer parked
 * off the list.
 */

const shot = async (name) => {
  const said = await captureScreenshot();
  const where = said?.path ?? said?.file ?? said;
  cliLog(`${name}: ${typeof where === "string" ? where : JSON.stringify(said).slice(0, 200)}`);
};

await useOrCreateTaskSpace("verify home issues");
await cdp("Emulation.setFocusEmulationEnabled", { enabled: true });
await gotoUrl("https://github.com/");

for (let attempt = 0; attempt < 40; attempt += 1) {
  const there = await js(
    String.raw`document.querySelectorAll('#gitquiet-root [data-row]').length > 0`
  ).catch(() => false);
  if (there === true) break;
  await new Promise((wake) => setTimeout(wake, 500));
}
await new Promise((wake) => setTimeout(wake, 3000));

cliLog(
  await js(String.raw`(() => {
    const root = document.querySelector('#gitquiet-root')
    const kebabs = [...root.querySelectorAll('[aria-label^="What to do with"]')]
    const opacities = kebabs.map((one) => Number(getComputedStyle(one).opacity))
    const fold = [...root.querySelectorAll('button')]
      .find((one) => /more issues?$/.test((one.textContent ?? '').trim()))
    return JSON.stringify({
      rows: root.querySelectorAll('[data-row]').length,
      kebabs: kebabs.length,
      invisible: opacities.filter((one) => one === 0).length,
      opacities: [...new Set(opacities)],
      fold: fold?.textContent?.trim() ?? null
    }, null, 2)
  })()`)
);
await shot("row-actions");
