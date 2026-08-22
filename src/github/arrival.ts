import { Option } from "effect"
import { fromPathname, type PullRequestRef, sameReference } from "../domain/PullRequestRef"
import { STILL_GOOD } from "./onTheWay"

/**
 * The pull request this document is arriving at, noted while it was still arriving.
 *
 * The worker holds the seven payloads for the pull request a tab was navigating to,
 * and only a page that is really that arrival may claim them. By the time anything can
 * ask, the evidence is gone: the shell is the first script on the page, but the screen
 * that does the asking is a bundle of its own, which on a heavy pull request finishes
 * loading a second and a half later — after GitHub's own `load` event. A page reading
 * `readyState` at that moment is told the document has been sitting there complete for
 * some time, which is true and beside the point.
 *
 * So the shell takes the note at `document_start`, where the answer is plain, and the
 * screen reads it whenever it gets there. On the window the two of them share, like
 * every other thing one hands the next — see `intent.ts`, which also says why not a
 * `data-` attribute: this window belongs to the extension, and GitHub's page cannot
 * read it or write it.
 */
type World = Window & { gitquietArrival?: { readonly at: number; readonly path: string } }

/**
 * Notes the address, where this document is one the browser is still fetching.
 *
 * A soft navigation and a Back leave `readyState` past `loading`, and neither told the
 * worker anything: no note is taken, and reads on those pages go to GitHub the way they
 * always did.
 */
export const noteArrival = (target: Window, page: Document): void => {
  if (page.readyState !== "loading") return
  ;(target as World).gitquietArrival = { at: Date.now(), path: page.location.pathname }
}

/**
 * Claims the arrival for this pull request, which only the read it was taken for can do.
 *
 * Taken rather than read, and taken only on a match. A pull request page reads other
 * pull requests while the reader rests on their links — `warming.ts` — and any of those
 * can be first, in the second and a half before the screen loads. A note spent on one of
 * them is the arrival read going to GitHub for what the worker is holding, which is the
 * whole of what this path exists to stop.
 *
 * Spent once, because the claim is worth making once. A second read of the same pull
 * request minutes later — a refresh of a stale card, a retry after a failure — would find
 * a worker Chrome stopped long ago and pay to wake it before hearing it has nothing.
 *
 * And not at all once the worker's hold is over. The two are measured from different
 * moments and that way round is the safe one: this counts from the navigation, the worker
 * counts from the read it finished afterwards, so a note stops being claimed a little
 * before the payloads it points at stop being held.
 */
export const claimArrival = (target: Window, reference: PullRequestRef): boolean => {
  const noted = (target as World).gitquietArrival
  if (noted === undefined) return false
  if (Date.now() - noted.at >= STILL_GOOD) return false

  const there = fromPathname(noted.path)
  if (Option.isNone(there) || !sameReference(there.value, reference)) return false

  delete (target as World).gitquietArrival
  return true
}

/** Drops the note, for a test standing two arrivals up in one window. */
export const forgetArrival = (target: Window): void => {
  delete (target as World).gitquietArrival
}
