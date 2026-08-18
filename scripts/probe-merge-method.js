/**
 * The bug and its absence, measured on our own squash-only repository.
 *
 *     ego-browser nodejs < scripts/probe-merge-method.js
 *
 * Reads GitHub's merge box twice for one pull request: once at the address the card used
 * to ask at, with `merge_method=MERGE` on the end of it, and once at the address it asks
 * at now. Prints the failed conditions each answer carries, and the methods the direct
 * merge says it would accept.
 *
 * Run with `flazouh/ghpro-scratch` set to squash only, which is the setting the two
 * answers differ under. Reported by Ahmed on `OpenRouterInternal/ori#2088`, which nobody
 * outside that organisation can read — this is the same shape on a repository we own.
 */

const PULL = process.env.PROBE_PULL ?? "https://github.com/flazouh/ghpro-scratch/pull/12";
const BOX = `${PULL}/page_data/merge_box?bypass_requirements=false`;

await useOrCreateTaskSpace("merge method probe");
await gotoUrl(PULL);

const read = (url) =>
  js(
    String.raw`
    (async () => {
      const said = await fetch(${JSON.stringify(url)}, {
        credentials: 'include',
        // Both, or the route answers 406. See REQUIRED_HEADERS in the gateway.
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
      })
      if (!said.ok) return JSON.stringify({ status: said.status })

      const box = await said.json()
      const direct = (box.pullRequest.viewerMergeActions ?? []).find(
        (action) => action.name === 'DIRECT_MERGE'
      )
      return JSON.stringify({
        status: said.status,
        state: box.mergeRequirements?.state ?? null,
        failed: (box.mergeRequirements?.conditions ?? [])
          .filter((condition) => condition.result === 'FAILED')
          .map((condition) => condition.displayName + ' — ' + (condition.message ?? condition.description)),
        methods: (direct?.mergeMethods ?? []).map(
          (method) => method.name + ':' + method.allowableStatus + (method.isDefault ? ' (default)' : '')
        )
      })
    })()
  `
  );

const before = JSON.parse(await read(`${BOX}&merge_method=MERGE`));
const after = JSON.parse(await read(BOX));

const say = (title, said) => {
  console.log(`\n== ${title}`);
  if (said.failed === undefined) return void console.log(`   ${JSON.stringify(said)}`);
  console.log(`   state: ${said.state}`);
  console.log(`   failed conditions: ${said.failed.length}`);
  for (const one of said.failed) console.log(`     - ${one}`);
  console.log(`   methods the direct merge allows: ${said.methods.join(", ") || "none"}`);
};

say("asked with merge_method=MERGE, which is what the card used to send", before);
say("asked with no merge method, which is what it sends now", after);
