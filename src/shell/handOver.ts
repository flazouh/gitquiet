/**
 * Giving a page to GitHub, and leaving the way back on it.
 *
 * Every screen here does the same two things when the reader has asked for GitHub's
 * pages: lift the gate that hides their version, and put up something to press to
 * change their mind. The first was written out in each of the twenty screens and the
 * second in four of them, which is how sixteen pages came to hand over and offer
 * nothing at all — turn the interface off from the dashboard, a repository's home, its
 * issues or its Actions and the only way back was to go and open a pull request.
 *
 * So both halves live here, and a screen hands over by calling one function. What the
 * way back looks like is `src/ui/wayBack.ts`; this is the part that knows a hand-over
 * is never only a reveal.
 *
 * The inverse halves are here for the same reason. Handing the way to withdraw the
 * widget back to the screen put a `let unoffer` in twenty files and asked each of them
 * to call it on every path that leaves GitHub's page. Sixteen called it on one path and
 * not on the other, which left a green mark standing over a page its screen no longer
 * manages, wired to a button that does nothing. There is one widget on a document, so
 * the way to take it off is held here rather than copied out.
 */

import { rememberView, rememberSpot } from "@/app/settings"
import type { Spot } from "@/domain/Settings"
import type { Store } from "@/ports/Settings"
import { gate, handBack, reveal, ungate } from "@/ui/mount"
import { offerOurPage } from "@/ui/wayBack"

/**
 * Where the reader last dropped the widget, for as long as this document lives.
 *
 * Here rather than in each screen, because there is one widget on a page and where it
 * sits is a fact about the page rather than about whichever screen put it there. Each
 * screen reads the stored place once, when it starts, and a screen holding that copy
 * alone re-plants the widget where it was an hour ago: drag it, walk to another
 * repository without a reload, and it jumps back to the corner you moved it out of.
 *
 * Storage is written as well and is what survives a reload. This is only what carries
 * the answer from one hand-over to the next, ahead of a read that has not come back.
 */
let dropped: Spot | null = null

/**
 * How to take the way back off the page, while one is on it.
 *
 * `null` says there is nothing up. One widget to a document, so one of these: a screen
 * that hands over twice replaces its own, and a screen arriving where another left one
 * takes that one down rather than standing a second beside it.
 */
let withdraw: (() => void) | null = null

/**
 * Says where the reader left the widget, as far as the screen's stored settings know.
 *
 * Used until they move it; after that the answer above is the better one, and this is
 * the only place that has to know the difference. A screen calls this once, with what
 * its settings read, and never has to carry the value again.
 */
export const theSpotWas = (spot: Spot): void => {
  if (dropped === null) dropped = spot
}

/** Forgets it, for a test that must not inherit where the last one left the widget. */
export const forgetTheSpot = (): void => {
  dropped = null
  withdrawTheWayBack()
}

/** Takes the way back off the page, whoever put it there, if one is up. */
export const withdrawTheWayBack = (): void => {
  withdraw?.()
  withdraw = null
}

/**
 * Lets GitHub's own page through and stands the way back in front of it.
 *
 * `takeBack` is what the screen does when the mark is pressed, which is its own
 * business: every screen re-enters differently, and the one thing they share is that
 * the choice has to be written down before the page is taken.
 */
export const handOverToGitHub = (
  store: Store,
  target: Document,
  takeBack: () => void
): void => {
  withdrawTheWayBack()

  reveal(target)
  ungate(target)

  withdraw = offerOurPage(target, takeBack, dropped ?? undefined, (where) => {
    dropped = where
    rememberSpot(store, where)
  })
}

/**
 * The press answered: this interface from here on, starting with this page.
 *
 * Writing the choice down, taking the widget off, and gating the page again are the
 * three a screen does in that order before it draws. What it draws afterwards differs
 * everywhere, which is why that half stays with the screen.
 */
export const takeTheWayBack = (store: Store, target: Document): void => {
  rememberView(store, "ours")
  withdrawTheWayBack()
  gate(target)
}

/**
 * Leaving a page this screen has nothing to say about.
 *
 * The gate is written per page and hangs on the document, so it has to come off or
 * GitHub's own page stays hidden behind it. The widget has to come off with it: it
 * stands on `documentElement` and survives the soft navigation that brought the reader
 * here, so left up it is a mark over somebody else's page whose press runs a screen
 * that will turn straight around and leave again.
 */
export const leaveTheirPages = (target: Document): void => {
  withdrawTheWayBack()
  handBack(target)
}
