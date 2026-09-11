import { findChrome, withExtension } from "./chrome"

/**
 * What happens to the interface's own element between the document starting and
 * the screen standing still.
 *
 * ```sh
 * bun run build && bun scripts/probe-mount-arrival.ts
 * bun scripts/probe-mount-arrival.ts --at https://github.com/owner/repo/pull/1
 * ```
 *
 * Written for one question and it answers it in one line: how many parents does
 * `#gitquiet-root` have over the life of an arrival. One is the whole of the
 * claim. Two means the element was moved after it was drawn, and a move is a
 * remove and an insert — which restarts every CSS animation under it and shows
 * the reader the page arriving twice.
 *
 * The recorder is installed ahead of the document rather than evaluated after
 * it, because everything worth seeing here is over inside half a second. It
 * watches three things and nothing else: where our element is, what the gate
 * attributes say, and which animations start. The third is the one that says
 * what a reader saw, since a replayed entrance is the same animation name
 * starting a second time on the same node.
 *
 * Signed out, which is enough. A takeover that cannot read the pull request
 * still stands, still hides their page, and still moves if the region it was
 * given is replaced — the arrival is the extension's own behaviour, and the
 * screen drawn inside it is not what is being measured.
 */

const argumentAfter = (flag: string): string | undefined => {
  const at = Bun.argv.indexOf(flag)
  return at === -1 ? undefined : Bun.argv[at + 1]
}

const AT = argumentAfter("--at") ?? "https://github.com/microsoft/vscode/pull/327442"
const EXTENSION = argumentAfter("--extension") ?? `${process.cwd()}/.output/chrome-mv3`

/** How long to watch after the load event before reading the tape. */
const WATCH = Number(argumentAfter("--watch") ?? 6000)

type Event =
  | { readonly at: number; readonly what: "parent"; readonly where: string }
  | { readonly at: number; readonly what: "gone" }
  | { readonly at: number; readonly what: "surface" }
  | { readonly at: number; readonly what: "mark"; readonly name: string; readonly on: boolean }
  | { readonly at: number; readonly what: "animation"; readonly name: string; readonly on: string }

/**
 * The recorder, as the page runs it.
 *
 * A string rather than a function serialised, because it has to survive being
 * handed to Chrome as source and read back by a person debugging this probe.
 */
const RECORDER = `
(() => {
  const started = performance.now()
  const at = () => Math.round(performance.now() - started)
  const tape = []
  window.__gitquietArrival = tape

  /** A parent said the way a person reads one: the tag, its id, its first class. */
  const nameOf = (element) => {
    if (element === null) return "(detached)"
    const id = element.id === "" ? "" : "#" + element.id
    const classes = typeof element.className === "string" ? element.className.trim() : ""
    const first = classes === "" ? "" : "." + classes.split(/\\s+/)[0]
    return element.tagName.toLowerCase() + id + first
  }

  let parent = undefined
  const look = () => {
    const root = document.getElementById("gitquiet-root")
    const now = root === null ? null : root.parentElement
    if (now === parent) return
    parent = now
    tape.push(now === null ? { at: at(), what: "gone" } : { at: at(), what: "parent", where: nameOf(now) })
  }

  /*
   * Whether the surface itself is ever swapped.
   *
   * The whole of the fix rests on it not being: an element appended to \`body\`
   * is safe from their router exactly as long as \`body\` is the same element it
   * was. Turbo replaces a frame's children and, on some routes, a whole body —
   * so this is asked rather than assumed.
   */
  let surface = undefined
  const surfaces = []
  const lookAtSurface = () => {
    if (document.body === surface) return
    surface = document.body
    surfaces.push(at())
    if (surfaces.length > 1) tape.push({ at: at(), what: "surface" })
  }

  const MARKS = [
    "data-gitquiet-page",
    "data-gitquiet-gating",
    "data-gitquiet-revealed",
    "data-gitquiet-taken",
    "data-gitquiet-shown",
    "data-gitquiet-bar-standing",
    "data-gitquiet-arrived"
  ]
  const marks = new Map()
  const readMarks = () => {
    const root = document.documentElement
    if (root === null) return
    for (const name of MARKS) {
      const on = root.hasAttribute(name)
      if (marks.get(name) === on) continue
      marks.set(name, on)
      tape.push({ at: at(), what: "mark", name, on })
    }
  }

  const watcher = new MutationObserver(() => {
    look()
    lookAtSurface()
    readMarks()
  })
  // The document itself, because this runs before there is an <html> to watch:
  // a script installed ahead of the document is installed ahead of its root
  // element too, and observing null is the one way to see nothing at all.
  watcher.observe(document, { childList: true, subtree: true, attributes: true })
  look()
  lookAtSurface()
  readMarks()

  // Bubbles, so one listener on the document catches every entrance the
  // interface runs, whichever node it runs on.
  document.addEventListener("animationstart", (event) => {
    const target = event.target
    tape.push({
      at: at(),
      what: "animation",
      name: event.animationName,
      on: target instanceof Element ? nameOf(target) : "(not an element)"
    })
  }, true)
})()
`

const say = (line: string): void => {
  process.stdout.write(`${line}\n`)
}

const main = async (): Promise<void> => {
  say(`chrome    ${findChrome()}`)
  say(`extension ${EXTENSION}`)
  say(`at        ${AT}`)
  say("")

  const session = await withExtension(AT, EXTENSION, { before: RECORDER })
  await new Promise((resolve) => setTimeout(resolve, WATCH))

  const tape = await session.evaluate<ReadonlyArray<Event>>("window.__gitquietArrival ?? []")

  /*
   * What of GitHub's is still on the screen once ours has settled.
   *
   * The other half of the claim. An interface that stands on the surface has to
   * take the surface: a child of `body` left visible is a strip of their page
   * above or below ours, which is the fault the region rules used to prevent by
   * standing inside the region instead.
   */
  const left = await session.evaluate<{
    readonly ours: boolean
    readonly showing: ReadonlyArray<string>
  }>(`
    (() => {
      const root = document.getElementById("gitquiet-root")
      const showing = []
      for (const child of document.body.children) {
        if (child === root) continue
        if (child.hasAttribute("data-gitquiet-outside")) continue
        if (child.tagName === "SCRIPT" || child.tagName === "TEMPLATE" || child.tagName === "STYLE") continue
        const box = child.getBoundingClientRect()
        if (box.width === 0 && box.height === 0) continue
        showing.push(child.tagName.toLowerCase() + (child.id ? "#" + child.id : "") + " " + Math.round(box.width) + "x" + Math.round(box.height))
      }
      return { ours: root !== null && root.getBoundingClientRect().height > 0, showing }
    })()
  `)

  say("timeline")
  for (const event of tape) {
    const stamp = String(event.at).padStart(6)
    if (event.what === "parent") say(`${stamp}ms  root stands in   ${event.where}`)
    else if (event.what === "gone") say(`${stamp}ms  root off the page`)
    else if (event.what === "surface") say(`${stamp}ms  body replaced`)
    else if (event.what === "mark") say(`${stamp}ms  ${event.on ? "set  " : "unset"} ${event.name}`)
    else say(`${stamp}ms  animation ${event.name} on ${event.on}`)
  }

  const parents = tape.filter((one) => one.what === "parent")
  const entrances = tape.filter(
    (one): one is Extract<Event, { what: "animation" }> => one.what === "animation"
  )
  const replayed = new Map<string, number>()
  for (const one of entrances) {
    const key = `${one.name} on ${one.on}`
    replayed.set(key, (replayed.get(key) ?? 0) + 1)
  }
  const twice = [...replayed.entries()].filter(([, many]) => many > 1)

  say("")
  say(`parents      ${parents.length}   ${parents.map((one) => one.where).join(" -> ")}`)
  say(`entrances    ${entrances.length}`)
  for (const [key, many] of twice) say(`replayed     ${many}x  ${key}`)
  say(`ours drawn   ${left.ours ? "yes" : "no"}`)
  say(
    left.showing.length === 0
      ? "theirs left  nothing"
      : `theirs left  ${left.showing.join(", ")}`
  )

  const problems = session.problems()
  if (problems.length > 0) {
    say("")
    say("console errors")
    for (const problem of problems.slice(0, 10)) say(`  ${problem}`)
  }

  session.stop()

  say("")
  const moved = parents.length > 1
  say(moved ? "MOVED — the interface was re-parented after it was drawn" : "STILL — one parent, start to finish")
  process.exit(moved ? 1 : 0)
}

await main()
