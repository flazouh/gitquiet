/**
 * Noticing that GitHub has gone somewhere else without loading a page.
 *
 * GitHub navigates with Turbo: clicking a pull request in a list swaps the
 * document's contents and rewrites the address bar, and no page load happens at
 * all. A content script is started once per document, so without this it goes
 * on believing it is looking at whichever pull request it was injected on, and
 * the interface for that one stays standing over a page about something else.
 *
 * `soft-nav:start` is the event GitHub fires, and it fires *before* the address
 * has changed — it announces the intention, not the arrival. So it is used only
 * as a prompt to start looking, and what is actually watched is the address
 * itself. `popstate` covers the back and forward buttons, and the interval
 * covers everything neither of them mentions, which on a page belonging to
 * somebody else is the case worth planning for.
 */
const LOOK_AGAIN = 200

/** GitHub's own announcements. None of them are contractual; all of them help. */
const THEIR_EVENTS = [
  "soft-nav:start",
  "soft-nav:success",
  "soft-nav:end",
  "soft-nav:frame-update",
  "turbo:load",
  "turbo:render"
]

export type Stop = () => void

/**
 * Calls back with the new path whenever it changes, and never for the path it
 * started on. Returns the way to stop.
 */
export const whenLocationChanges = (
  target: Window,
  onChange: (path: string) => void,
  lookAgain: number = LOOK_AGAIN
): Stop => {
  let known = target.location.pathname

  const look = (): void => {
    const now = target.location.pathname
    if (now === known) return
    known = now
    onChange(now)
  }

  // Their events land before the address is rewritten as often as after it, so
  // each one is a reason to look now and again on the next turn of the loop.
  const soon = (): void => {
    look()
    target.setTimeout(look, 0)
  }

  for (const name of THEIR_EVENTS) target.document.addEventListener(name, soon, true)
  target.addEventListener("popstate", soon)
  const ticking = target.setInterval(look, lookAgain)

  return () => {
    for (const name of THEIR_EVENTS) target.document.removeEventListener(name, soon, true)
    target.removeEventListener("popstate", soon)
    target.clearInterval(ticking)
  }
}
