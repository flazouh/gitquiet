/**
 * The last few things the interface said, kept where the door can reach them.
 *
 * A webview's console goes nowhere: Electrobun does not pipe it to the terminal
 * that launched the app, and `screencapture` and AppleScript cannot see this
 * window either. So an interface that failed and explained itself perfectly well
 * to `console.error` explained it to nobody, and the only symptom left was a
 * screen saying something vague — which is exactly how a working GraphQL read
 * came to look like being signed out.
 *
 * A ring, so it cannot grow without bound in an app meant to stay open for days,
 * and holding the message rather than the objects, so nothing here keeps a
 * component or a response alive.
 *
 * Reachable only through the inspector, which the main process opens for
 * `bun run dev` and never for a build anybody downloads.
 */

const KEPT = 200

export type Line = {
  readonly at: string
  readonly level: "log" | "warn" | "error"
  readonly said: string
}

const lines: Array<Line> = []

/**
 * Where the inspector listens, which is the one port a development run uses.
 *
 * Kept in step with `bun run dev` by being the same number, which is a poor sort
 * of link and the best one available: nothing crosses from the main process into
 * this page before it draws, and a log that only works once the page is drawing is
 * a log that misses what happened first.
 */
const DOOR = "http://127.0.0.1:50505/said"

/**
 * Said out loud, over a channel that owes the bridge nothing.
 *
 * The ring below is only readable by asking the webview for it, so it is useless
 * for the failure worth reading a log about: a webview that has stopped answering.
 * A `fetch` at 127.0.0.1 is answered by the main process itself, and in a build
 * nobody is listening on that port — the request fails, this ignores it, and the
 * interface never knows the difference.
 */
const tell = (line: Line) => {
  void fetch(DOOR, { method: "POST", body: `${line.level}: ${line.said}` }).catch(() => {})
}

const keep = (level: Line["level"], said: string) => {
  const line = { at: new Date().toISOString(), level, said }
  lines.push(line)
  if (lines.length > KEPT) lines.shift()
  tell(line)
}

/**
 * What a console argument is, once it has to survive as text.
 *
 * `String(error)` gives "Error: …" and loses the stack, and `JSON.stringify` of
 * an `Error` gives `{}` — both of which have wasted an afternoon before. Errors
 * are unwrapped by hand; everything else goes through JSON and falls back to
 * `String` for what JSON will not hold, such as a cycle or a function.
 */
const asText = (it: unknown): string => {
  if (typeof it === "string") return it
  if (it instanceof Error) return `${it.name}: ${it.message}${it.stack === undefined ? "" : `\n${it.stack}`}`
  try {
    return JSON.stringify(it) ?? String(it)
  } catch {
    return String(it)
  }
}

const said = (args: ReadonlyArray<unknown>) => args.map(asText).join(" ")

/** Starts keeping what the interface says. Safe to call more than once. */
export const record = () => {
  const already = globalThis as { __recorded?: () => ReadonlyArray<Line> }
  if (already.__recorded !== undefined) return

  for (const level of ["log", "warn", "error"] as const) {
    const was = console[level].bind(console)
    console[level] = (...args: ReadonlyArray<unknown>) => {
      keep(level, said(args))
      was(...args)
    }
  }

  // The two failures that never reach `console.error` on their own: a throw
  // nobody caught, and a promise nobody attached to. Both are how a screen ends
  // up blank, and both were invisible from outside this window.
  window.addEventListener("error", (event) => {
    keep("error", `uncaught: ${asText(event.error ?? event.message)}`)
  })
  window.addEventListener("unhandledrejection", (event) => {
    keep("error", `unhandled rejection: ${asText(event.reason)}`)
  })

  already.__recorded = () => lines

  // The first line, and the one that says the channel above works: a terminal
  // that never sees this knows the page did not get as far as running any of it.
  keep("log", "recording")
}
