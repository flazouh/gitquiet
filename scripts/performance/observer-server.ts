import { join } from "node:path"

const label = process.argv[2] ?? "after"
if (label !== "before" && label !== "after") throw new Error("Use before or after")
const base = join(process.cwd(), ".tmp/perf-observers")
const build = await Bun.build({
  entrypoints: ["scripts/performance/entry.ts", "scripts/performance/links-entry.ts"],
  target: "browser", outdir: join(base, label), sourcemap: "external"
})
if (!build.success) throw new Error(build.logs.map(String).join("\n"))
Bun.serve({
  hostname: "127.0.0.1", port: 43127,
  fetch(request) {
    const url = new URL(request.url)
    if (url.pathname === "/") return new Response(`<!doctype html>
<title>GitQuiet observer probes</title><h1>GitQuiet observer probes</h1>
<p>The browser runner records results in .tmp/perf-observers.</p>
<script type="module">
import { runObserverProbe } from '/probe.js';
const label = new URL(location.href).searchParams.get('version') === 'before' ? 'before' : 'after';
const mount = await import('/'+label+'/entry.js');
const links = await import('/'+label+'/links-entry.js');
window.runProbe = options => runObserverProbe({...mount,...links},options);
window.probeOutput = ${JSON.stringify(join(base, "results.json"))};
</script>`, { headers: { "content-type": "text/html" } })
    if (url.pathname === "/probe.js") return new Response(Bun.file("scripts/performance/observer-probe.js"))
    if (!/^\/(before|after)\/(entry|links-entry)\.js$/.test(url.pathname))
      return new Response("Not found", { status: 404 })
    return new Response(Bun.file(join(base, url.pathname)), {
      headers: { "content-type": "text/javascript" }
    })
  }
})
console.log(`Built ${label}. Serving http://127.0.0.1:43127`)
