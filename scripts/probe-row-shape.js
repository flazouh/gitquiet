/**
 * What a row actually is, in the DOM, on the live page.
 *
 *     ego-browser nodejs < scripts/probe-row-shape.js
 *
 * Written because two guesses at a row selector both came back empty while the rows were
 * plainly on the screen. This prints the ancestry of a real link instead of guessing again.
 */

await useOrCreateTaskSpace("verify home issues");
await cdp("Emulation.setFocusEmulationEnabled", { enabled: true });
await gotoUrl("https://github.com/");

for (let attempt = 0; attempt < 40; attempt += 1) {
  const there = await js(
    String.raw`document.querySelectorAll('a[href*="/pull/"], a[href*="/issues/"]').length > 0`
  ).catch(() => false);
  if (there === true) break;
  await new Promise((wake) => setTimeout(wake, 500));
}
await new Promise((wake) => setTimeout(wake, 4000));

cliLog(
  await js(String.raw`(() => {
    const link = document.querySelector('a[href*="/issues/"]')
    const pull = document.querySelector('a[href*="/pull/"]')
    const ancestry = (from) => {
      const said = []
      let here = from
      for (let up = 0; up < 8 && here !== null; up += 1) {
        said.push({
          tag: here.tagName.toLowerCase(),
          attributes: [...here.attributes].map((one) => one.name + (one.value === '' ? '' : '=' + one.value.slice(0, 90))),
          children: here.children.length
        })
        here = here.parentElement
      }
      return said
    }
    return JSON.stringify({
      dataRow: document.querySelectorAll('[data-row]').length,
      dataIssue: document.querySelectorAll('[data-issue]').length,
      issueAncestry: link === null ? null : ancestry(link),
      pullAncestry: pull === null ? null : ancestry(pull).slice(0, 5)
    }, null, 2)
  })()`)
);
