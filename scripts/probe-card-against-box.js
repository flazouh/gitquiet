/**
 * The card and the merge box behind it, read in the same breath.
 *
 *     QA_PULL=<pull request url> ego-browser nodejs < scripts/probe-card-against-box.js
 *
 * Written because the two disagreed: the card drew two blocker rows about a merge commit
 * on a pull request whose merge box, fetched a minute earlier from another tab, carried no
 * failed conditions at all. One of them is looking at something the other is not, and a
 * measurement a minute apart cannot say which.
 */

const EXTENSION = "/Users/alex/Documents/githubpro/.output/chrome-mv3";
/*
 * Given on the command line rather than through the environment: the script runs inside
 * ego's own node process, which does not inherit this shell's variables.
 */
const PULL = process.argv[2] ?? "https://github.com/flazouh/perry-proof-qa/pull/3";

const task = await useOrCreateTaskSpace("card against box");
const { id } = await cdp("Extensions.loadUnpacked", { path: EXTENSION }, null);
cliLog(`loaded ${id}`);

await gotoAndWait(PULL, { timeout: 40, settle: 4 });
await wait(4);

const said = await js(
  String.raw`
  (async () => {
    const root = document.getElementById("gitquiet-root")
    const rows = root === null
      ? null
      : [...root.querySelectorAll("p, li")].map((one) => one.textContent.trim()).filter(Boolean)

    const box = await fetch(location.href.replace(/[?#].*$/, "") + "/page_data/merge_box?bypass_requirements=false", {
      credentials: 'include',
      headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
    }).then((answer) => answer.ok ? answer.json() : { status: answer.status })

    const direct = (box.pullRequest?.viewerMergeActions ?? []).find((one) => one.name === 'DIRECT_MERGE')

    return JSON.stringify({
      url: location.pathname,
      base: box.pullRequest?.baseRefName ?? null,
      head: box.pullRequest?.headRefName ?? null,
      cardRows: rows,
      boxState: box.mergeRequirements?.state ?? null,
      boxFailed: (box.mergeRequirements?.conditions ?? [])
        .filter((one) => one.result === 'FAILED')
        .map((one) => one.displayName + ' — ' + (one.message ?? one.description)),
      methods: (direct?.mergeMethods ?? []).map(
        (one) => one.name + ':' + one.allowableStatus + (one.isDefault ? ' (default)' : '')
      )
    })
  })()
`
);

cliLog(JSON.stringify(JSON.parse(said), null, 1));

await cdp("Extensions.uninstall", { id }, null);
await completeTaskSpace(task.id, { keep: false });
