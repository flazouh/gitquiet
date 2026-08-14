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
 *
 * The browser's own account of it comes first, though — see {@link theirWord}.
 */
const LOOK_AGAIN = 200

/**
 * The browser saying the address has changed, which beats guessing at it.
 *
 * `currententrychange` fires once the entry is the current one, whatever moved it:
 * a Turbo push, a replace, the back button. Where the interval was up to two
 * hundred milliseconds of the interface standing over a page it is not about, this
 * is the same turn of the event loop.
 *
 * The interval stays underneath it. This is a young API and the page belongs to
 * somebody else — a browser without it, or a way of moving it does not report,
 * costs a fifth of a second rather than everything.
 */
type Entries = {
  readonly addEventListener: (name: string, run: () => void) => void
  readonly removeEventListener: (name: string, run: () => void) => void
}

const theirWord = (target: Window): Entries | undefined => {
  const said = (target as Window & { navigation?: Entries }).navigation
  return typeof said?.addEventListener === "function" ? said : undefined
}

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
 * How long GitHub is given to move before the press is carried out by hand.
 *
 * Measured from their own click event on live pages, where a press they act on
 * rewrites the address after 468, 1092 and 1758 milliseconds on three tabs of
 * one repository. Twenty-five hundred is above the slowest of those with margin,
 * because the cost of being too quick here is a healthy page reloaded underneath
 * its reader.
 *
 * Their `soft-nav:start` looked like a way to cut this to a fifth, and it is not
 * one. It fires eight milliseconds after a press they take — but they also
 * navigate without ever firing it, which is the 1758 above. A deadline on the
 * announcement reloads that page every time.
 */
const STAYING = 2500

/**
 * Goes where the reader asked when GitHub does not.
 *
 * Their own router wedges, and it is theirs rather than ours. Walk a repository's
 * tabs and roughly every other press is dead: the address never changes, no
 * request is made, nothing is announced, and ten seconds later the page is still
 * where it was. Reproduced with this extension uninstalled, by pressing their own
 * tabs at their own coordinates, so it is a defect we inherit rather than cause.
 *
 * A reader cannot be left with a page that ignores them, so the press is carried
 * out here instead. A whole document loads, which is the slow way and the reason
 * this waits rather than doing it first: where their router works, this never
 * fires at all.
 *
 * The address is the only thing it goes on, because nothing else they emit tells
 * a dead press from a live one. So a soft navigation this never heard about, a
 * press the reader replaced with another, and a press that went somewhere
 * unexpected are all left alone. The one case this acts on is the page standing
 * exactly where it was when the deadline runs out.
 */
export const whenTheyStayPut = (
  target: Window,
  going: string,
  staying: number = STAYING
): Stop => {
  const from = target.location.pathname
  if (from === going) return () => {}

  const waiting = target.setTimeout(() => {
    if (target.location.pathname !== from) return
    target.location.assign(going)
  }, staying)

  return () => target.clearTimeout(waiting)
}

/**
 * Calls back whenever the address changes, path or search, and never for the one it
 * started on. Returns the way to stop.
 *
 * The whole address rather than the path, because three of the pages this extension
 * stands on differ by a query parameter alone: a person's profile, their repositories
 * and their stars are all `/login` with a different `tab`. A watcher that compared
 * paths never fired between them, so the screen for one went on standing on the page
 * of another — showing repositories under an address that says stars.
 *
 * Both halves are handed over, unjoined, because that is how they are asked about:
 * `placeOwning` takes a path and a search, and rejoining them at every caller is a
 * string to get wrong.
 */
export const whenAddressChanges = (
  target: Window,
  onChange: (path: string, search: string) => void,
  lookAgain: number = LOOK_AGAIN
): Stop => {
  const whole = (): string => `${target.location.pathname}${target.location.search}`
  let known = whole()

  const look = (): void => {
    const now = whole()
    if (now === known) return
    known = now
    onChange(target.location.pathname, target.location.search)
  }

  // Their events land before the address is rewritten as often as after it, so
  // each one is a reason to look now and again on the next turn of the loop.
  const soon = (): void => {
    look()
    target.setTimeout(look, 0)
  }

  for (const name of THEIR_EVENTS) target.document.addEventListener(name, soon, true)
  target.addEventListener("popstate", soon)
  const said = theirWord(target)
  // Straight to `look`, not `soon`: this one fires after the address has changed
  // rather than around it, so there is nothing to wait a turn for.
  said?.addEventListener("currententrychange", look)
  const ticking = target.setInterval(look, lookAgain)

  return () => {
    for (const name of THEIR_EVENTS) target.document.removeEventListener(name, soon, true)
    target.removeEventListener("popstate", soon)
    said?.removeEventListener("currententrychange", look)
    target.clearInterval(ticking)
  }
}

/**
 * Calls back with the new path whenever the path changes, and never for a search
 * that changed under the same path. Returns the way to stop.
 *
 * The narrower of the two questions, and the one most of this codebase asks: for
 * every page but a person's three, which page a reader is on is a path. A screen
 * that redraws for its own paging — a list writing `?page=2`, a log writing `#L23`
 * — must not be told it has arrived somewhere new.
 */
export const whenLocationChanges = (
  target: Window,
  onChange: (path: string) => void,
  lookAgain: number = LOOK_AGAIN
): Stop => {
  let known = target.location.pathname

  return whenAddressChanges(
    target,
    (path) => {
      if (path === known) return
      known = path
      onChange(path)
    },
    lookAgain
  )
}
