import type { PullRequestRef } from "../../../src/domain/PullRequestRef"
import { toUrl } from "../../../src/domain/PullRequestRef"
import { ask } from "./rpc"
import { where } from "./where"

/**
 * Where a link goes, in a window that must not follow one.
 *
 * The webview is the interface. It has no address bar, no back button and no tab to
 * close, so a link that navigates it does not open a page — it replaces the app with a
 * page, and the only way back is to quit. That is exactly what happened: the card's own
 * "GitHub" link is an anchor, correct markup on either platform, and following it in
 * here left the reader on github.com inside something that looked like our window and
 * behaved like nothing at all.
 *
 * So the window never follows a link. `where.ts` decides what each press means and
 * this installs it, in the capture phase at the document, so that a link added anywhere
 * later is caught by the same rule. Nothing about a link is the screens' business.
 */

export const openOutside = (url: string): void => {
  void ask("openOutside", { url }).then((answered) => {
    if (!answered.ok) console.error("[working-set] could not open outside:", answered.why)
  })
}

/**
 * How this window becomes a pull request, once something is here that can be one.
 *
 * The rule is installed before React is, because a press that arrives before the first
 * render still must not navigate the webview. So the way to draw a card is handed over
 * afterwards, by whatever is holding which screen the window is showing.
 */
let drawsCards: ((reference: PullRequestRef) => void) | null = null

export const cardsOpenHere = (open: (reference: PullRequestRef) => void): (() => void) => {
  drawsCards = open
  return () => {
    if (drawsCards === open) drawsCards = null
  }
}

/**
 * Nothing in this window follows a link, and no link in it ends in nothing.
 *
 * Installed once, for the life of the window. Both halves matter, and the second one
 * is the half that was missing: a press that was stopped and then handed to nobody is a
 * control that does nothing, which is worse than one that goes to the wrong place
 * because there is nothing on the screen to say so. A card nobody can draw is opened
 * outside instead.
 */
export const keepLinksOutside = (): void => {
  const answer = (event: MouseEvent, mine: number) => {
    const meant = where(event.target, event)
    if (meant.at === "nothing") return

    /*
     * Stopped first, and stopped whatever it turns out to mean. The one invariant here
     * is that the webview never navigates, and the way to hold it is to answer that
     * question before asking any other — before even the question of whether this
     * listener is the one that acts.
     */
    event.preventDefault()
    if (event.button !== mine) return

    if (meant.at === "stopped") return
    if (meant.at === "outside") return openOutside(meant.url)

    if (drawsCards === null) return openOutside(toUrl(meant.reference))
    drawsCards(meant.reference)
  }

  /*
   * Two listeners, and each acts on one button only.
   *
   * A middle press is `auxclick` in every engine written since 2018 and was `click`
   * with button 1 before that, and engines that did both existed in between. Both are
   * listened for so that no press escapes the rule above, and each answers only its own
   * button, so a press that raises both is opened once rather than in two tabs.
   */
  document.addEventListener("click", (event) => answer(event, 0), { capture: true })
  document.addEventListener("auxclick", (event) => answer(event, 1), { capture: true })
}
