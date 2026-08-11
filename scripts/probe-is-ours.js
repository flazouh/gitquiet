/**
 * Is our extension even here?
 *
 *     ego-browser nodejs < scripts/probe-is-ours.js
 *
 * A row probe came back with GitHub's own `dashboard-lists` partial, which either means the
 * gate is not holding or means our screen never mounted in this browsing context. This tells
 * the two apart before anything is concluded about the rows.
 */

const where = process.env.SPACE ?? "verify home issues";
await useOrCreateTaskSpace(where);
await cdp("Emulation.setFocusEmulationEnabled", { enabled: true });
await gotoUrl("https://github.com/");
await new Promise((wake) => setTimeout(wake, 5000));

cliLog(`task space: ${where}`);
cliLog(
  await js(String.raw`(() => {
    const ours = document.querySelector('#gitquiet-root')
    const partials = [...document.querySelectorAll('react-partial')].map((one) => ({
      name: one.getAttribute('partial-name'),
      shown: getComputedStyle(one).display,
      height: Math.round(one.getBoundingClientRect().height)
    }))
    return JSON.stringify({
      ourRoot: ours === null ? null : {
        shown: getComputedStyle(ours).display,
        height: Math.round(ours.getBoundingClientRect().height),
        children: ours.children.length
      },
      rail: document.querySelector('nav[aria-label="Rail"]') !== null,
      gateStyles: [...document.querySelectorAll('style[id], link[rel="stylesheet"]')]
        .map((one) => one.id || one.getAttribute('href'))
        .filter((one) => /gate|gitquiet/.test(one ?? '')),
      partials,
      html: document.documentElement.getAttribute('data-gitquiet') ?? document.documentElement.className.slice(0, 120)
    }, null, 2)
  })()`)
);
