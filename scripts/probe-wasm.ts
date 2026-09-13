/**
 * Plan 009: whether a Tree-sitter grammar can be compiled at all.
 *
 *     bun run build && bun scripts/build-wasm-probe.ts && bun scripts/probe-wasm.ts
 *
 * `src/diff/shiki.ts` records that GitHub's policy refuses WebAssembly inside a
 * content script, and guesses that a context at our own origin is held to ours
 * instead. Everything in `docs/spec/following.md` rests on that guess. This asks
 * it on a live github.com page, in the three places it could be true:
 *
 *   1. the content script, which is expected to be refused and is the control —
 *      a run where all three succeed is a run that proved nothing;
 *   2. the offscreen document, an extension page;
 *   3. a dedicated worker started from that document, from an extension URL.
 *
 * Signed out, on a throwaway profile, because a policy is served to everybody.
 */
import { connect, withExtension } from "./chrome"

const PAGE = "https://github.com/microsoft/vscode/pull/327442"
const EXTENSION = `${import.meta.dir}/../.output/chrome-mv3`

type Attempt = {
  where: string
  tiny: string
  grammar: string
  parse: string
  grammarBytes: number
  runtimeMs: number
  grammarMs: number
  parseMs: number
  sampleBytes: number
  nodes: number
}

/**
 * The port `chrome.ts` is on, read the same way it reads it.
 *
 * Not set here. That file reads the variable when it is imported, and a static
 * import is hoisted above every statement in this one — so a port assigned at
 * the top of this file is assigned after Chrome has already been told a
 * different one, and the probe then asks an address nothing is listening on.
 * Which is exactly what it did.
 *
 * `chrome.ts` also warns that something else answering here is a case it cannot
 * tell apart. A probe that throws before `stop` is how something else comes to
 * be answering: the Chrome it left behind holds the port, and the next run talks
 * to a browser with the last run's extension in it. Hence the `finally` below.
 */
const PORT = process.env["GITQUIET_CDP_PORT"] ?? "9222"

const session = await withExtension(PAGE, EXTENSION)

try {

/** The control, in the one world github.com's policy reaches. */
const inContentScript = await session.evaluateInExtension<{
  tiny: string
  grammar: string
  bytes: number
}>(`
  (async () => {
    const out = { tiny: "", grammar: "", bytes: 0 }
    try {
      await WebAssembly.compile(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]))
      out.tiny = "ok"
    } catch (error) { out.tiny = String(error) }
    try {
      const url = chrome.runtime.getURL("/ledger/tree-sitter-typescript.wasm")
      const bytes = await (await fetch(url)).arrayBuffer()
      out.bytes = bytes.byteLength
      await WebAssembly.compile(bytes)
      out.grammar = "ok"
    } catch (error) { out.grammar = String(error) }
    return out
  })()
`)

/*
 * And the two contexts at our own origin.
 *
 * Asked from the worker rather than from the page. The page's message is what
 * wakes the worker and opens the document, and that hop is not the question —
 * whether a grammar compiles is. A relay in the middle of a measurement is one
 * more thing that can answer `undefined` and leave a run that proves nothing,
 * which is what the first three attempts at this probe did.
 */
await session
  .evaluateInExtension(`chrome.runtime.sendMessage({ kind: "gitquiet/wasm-probe" })`)
  .catch(() => undefined)

const targets = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()) as ReadonlyArray<{
  type: string
  url: string
  webSocketDebuggerUrl: string
}>
const background = targets.find(
  (target) => target.type === "service_worker" && target.url.includes(session.extensionId)
)
if (background === undefined) throw new Error("The extension's worker never started")

const worker = await connect(background.webSocketDebuggerUrl)
await worker.send("Runtime.enable")
const asked = await worker.send<{
  result: { value?: { attempts: ReadonlyArray<Attempt>; notes: ReadonlyArray<string> } }
  exceptionDetails?: { text: string }
}>("Runtime.evaluate", {
  expression: `chrome.runtime.sendMessage({ kind: "gitquiet/wasm-probe-work" })`,
  returnByValue: true,
  awaitPromise: true
})
const answer = asked.result.value

const page = await session.evaluate<string>(`document.location.href`)
const policy = await session.evaluate<string | null>(`
  (async () => {
    const response = await fetch(document.location.href, { credentials: "include" })
    return response.headers.get("content-security-policy")
  })()
`)

console.log(JSON.stringify(
  {
    page,
    chrome: process.env["CHROME_PATH"] ?? "system google-chrome",
    contentScript: inContentScript,
    attempts: answer?.attempts ?? [],
    notes: answer?.notes ?? [],
    scriptSrc: (policy ?? "")
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("script-src")) ?? null,
    problems: session.problems()
  },
  null,
  2
))

} finally {
  session.stop()
}
