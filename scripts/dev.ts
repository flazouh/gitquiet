/**
 * One command for a working session: watch everything, rebuild on save, and put
 * the result in the browser you are already signed in to.
 *
 *     bun run dev
 *
 * Three builds make this extension and only one of them is WXT's. The shell and
 * the worker are entrypoints, so `wxt` watches those itself. The four screens
 * (scripts/build-screens.ts), the diff renderer (scripts/build-diff-engine.ts),
 * and the Mermaid renderer are built beside it into `public/`. WXT treats that
 * folder as static: it copies what changes and reloads the
 * extension, but it will not rebuild a screen because a component under `src/ui`
 * was saved. So those watchers are started here, and between them and `wxt`
 * every file in `src` is watched by something.
 *
 * Then the browser. `wxt` would normally start one, and it cannot here — there is
 * no Chrome installed and the browser we develop against is ego lite, already
 * running and already signed in to GitHub. wxt.config.ts turns the runner off and
 * scripts/ego-dev.js installs the build over CDP instead. It is run once the
 * first build has landed, because an extension folder without a manifest is one
 * the browser refuses.
 *
 * Ctrl-C stops all four.
 */

import { type ChildProcess, spawn } from "node:child_process"
import { openSync, statSync, utimesSync } from "node:fs"
import { fileURLToPath } from "node:url"

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))

const MANIFEST = here("../.output/chrome-mv3-dev/manifest.json")

/** What WXT waits for after a file changes before it looks at what changed. */
const DEBOUNCE = 800

const children: ChildProcess[] = []

const stop = () => {
  for (const child of children) child.kill()
}

process.on("SIGINT", () => {
  stop()
  process.exit(0)
})
process.on("SIGTERM", () => {
  stop()
  process.exit(0)
})

/** Everything a child says, with the name of the child in front of it. */
const label = (name: string, child: ChildProcess) => {
  for (const stream of [child.stdout, child.stderr]) {
    stream?.on("data", (chunk: Buffer) => {
      for (const line of chunk.toString().split("\n")) {
        if (line.trim() !== "") console.log(`${name} | ${line}`)
      }
    })
  }
}

/**
 * Tell WXT that `public/` changed, once the writing into it has stopped.
 *
 * It is watching, and it will not do on its own. WXT debounces on the leading
 * edge and takes no trailing call, so out of a burst of writes it acts on the
 * first and discards the rest — and a screens build is thirty files, of which the
 * first is whichever chunk was written first. What it copied was `public/` as it
 * stood at that moment, and the screen actually edited, written a moment later,
 * never arrived at all. This was every second change appearing to do nothing.
 *
 * One touch, after everything is written, is a leading edge of its own, and the
 * copy it asks for is of the whole folder. Counted from the last build rather
 * than the first, so a run of rebuilds nudges once at the end of it.
 */
let scheduled: ReturnType<typeof setTimeout> | undefined
const nudge = () => {
  clearTimeout(scheduled)
  scheduled = setTimeout(() => {
    const now = new Date()
    try {
      utimesSync(here("../public/diff-engine.js"), now, now)
    } catch {
      // The diff renderer is built before this can be called, so this is only
      // reachable if that build has just failed. The next nudge will do.
    }
    try {
      utimesSync(here("../public/markdown-mermaid.js"), now, now)
    } catch {
      // Same as above, for mermaid.
    }
  }, DEBOUNCE + 400)
}

const watcher = (name: string, script: string, done: string) =>
  new Promise<ChildProcess>((resolve, reject) => {
    const child = spawn("bun", [here(script), "--watch"], { stdio: "pipe" })
    children.push(child)
    label(name, child)
    child.stdout?.on("data", (chunk: Buffer) => {
      if (!chunk.toString().includes(done)) return
      // Resolving is for the first build; resolving again is nothing.
      resolve(child)
      nudge()
    })
    child.on("exit", (code) => reject(new Error(`${name} exited with ${code}`)))
  })

const once = (name: string, script: string) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn("bun", [here(script)], { stdio: "pipe" })
    label(name, child)
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${name} exited with ${code}`))
    )
  })

/** The moment `wxt` has written a build worth installing. */
const waitForBuild = async (after: number) => {
  for (let attempt = 0; attempt < 480; attempt++) {
    try {
      if (statSync(MANIFEST).mtimeMs >= after) return
    } catch {
      // Not written yet.
    }
    await new Promise((wake) => setTimeout(wake, 250))
  }
  throw new Error("wxt did not write .output/chrome-mv3-dev/manifest.json")
}

// The gate stylesheets are generated into `src/ui`, where the screens import
// them, so they have to exist before anything is built rather than be watched.
await once("gates", "build-gates.ts")

await watcher("diff", "build-diff-engine.ts", "built public/diff-engine.js")
await watcher("mermaid", "build-markdown-mermaid.ts", "built public/markdown-mermaid.js")
await watcher("screens", "build-screens.ts", "built public/screens/")

const started = Date.now()
const wxt = spawn("wxt", [], { stdio: "inherit" })
children.push(wxt)
wxt.on("exit", (code) => {
  stop()
  process.exit(code ?? 0)
})

await waitForBuild(started)

// Fed on standard input because the runtime inside ego takes no arguments and
// inherits no environment: a script is all it reads.
const ego = spawn("ego-browser", ["nodejs"], {
  stdio: [openSync(here("ego-dev.js"), "r"), "pipe", "pipe"]
})
label("ego", ego)
