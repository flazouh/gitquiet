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
 */

import { rememberSpot } from "@/app/settings"
import type { Spot } from "@/domain/Settings"
import type { Store } from "@/ports/Settings"
import { reveal, ungate } from "@/ui/mount"
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

/** Forgets it, for a test that must not inherit where the last one left the widget. */
export const forgetTheSpot = (): void => {
  dropped = null
}

/**
 * Lets GitHub's own page through and stands the way back in front of it.
 *
 * `takeBack` is what the screen does when the mark is pressed, which is its own
 * business: every screen re-enters differently, and the one thing they share is that
 * the choice has to be written down before the page is taken. `spot` is where the
 * reader left the widget as far as the screen knows, which is used until they move it;
 * after that the answer above is the better one and this is the only place that has to
 * know the difference.
 *
 * Hands back the way to withdraw it, which a screen calls before it hands over again
 * and when it leaves the page for somewhere this extension has nothing to say about.
 */
export const handOverToGitHub = (
  store: Store,
  target: Document,
  spot: Spot,
  takeBack: () => void
): (() => void) => {
  reveal(target)
  ungate(target)

  return offerOurPage(target, takeBack, dropped ?? spot, (where) => {
    dropped = where
    rememberSpot(store, where)
  })
}
