const source = await Bun.file("scripts/performance/record-traces.js").text()
const script = `globalThis.GITQUIET_PROBE_ROOT = ${JSON.stringify(process.cwd())};\n${source}`
const child = Bun.spawn(["ego-browser", "nodejs"], {
  stdin: new Blob([script]), stdout: "inherit", stderr: "inherit"
})
process.exit(await child.exited)
