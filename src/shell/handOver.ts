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
 * Lets GitHub's own page through and stands the way back in front of it.
 *
 * `takeBack` is what the screen does when the mark is pressed, which is its own
 * business: every screen re-enters differently, and the one thing they share is that
 * the choice has to be written down before the page is taken. `spot` is where the
 * reader last left the widget, and where it is dropped is written down from here so
 * that no screen has to remember to.
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

  return offerOurPage(target, takeBack, spot, (where) => rememberSpot(store, where))
}
