import { ask } from "./rpc"
import { openCard } from "./showing"
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
 * So the window never follows a link. `where.ts` decides what each press means and this
 * installs it, in the capture phase at the document, so that a link added anywhere later
 * is caught by the same rule. Nothing about a link is the screens' business.
 */

/** That this document already has the rule, and does not need a second one. */
const LINKED = "data-gitquiet-linked"

export const openOutside = (url: string): void => {
  void ask("openOutside", { url }).then((answered) => {
    if (!answered.ok) console.error("[working-set] could not open outside:", answered.why)
  })
}

/**
 * Nothing in this window follows a link, and every press is answered by name.
 *
 * Installed once, for the life of the window, and before React is: a press that arrives
 * during the first render still must not navigate. Which is why what a pull request
 * press means is `openCard` and not a callback a component hands over — see
 * `showing.ts`, where that state lives for this reason.
 *
 * The four answers are all answered here, including the two silences. A press that was
 * stopped and then quietly dropped is a control that does nothing, which is worse than
 * one that goes to the wrong place: nothing on the screen says so. One of those silences
 * is a screen about to draw the page itself, and the other is this window not knowing
 * where a link was going, which is worth saying out loud in a log somebody reads.
 */
export const keepLinksOutside = (): void => {
  /*
   * Once for the document, however many times this is called.
   *
   * Not a flag in this module, which is the version of the guard that does nothing:
   * asked for twice, the rule is being asked for by two copies of this module, and each
   * copy has a flag of its own set to false. That is what dev is — Vite answers a change
   * it cannot patch by importing the entry a second time, so the second copy installed a
   * second rule, and one middle press opened two tabs. It goes up by one on every reload.
   *
   * The document is the one thing both copies share, so the mark goes there.
   */
  if (document.documentElement.hasAttribute(LINKED)) return
  document.documentElement.setAttribute(LINKED, "")

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

    if (meant.at === "drawn") return
    if (meant.at === "unplaceable") {
      return void console.warn("[working-set] nowhere to send this link:", meant.written)
    }
    if (meant.at === "outside") return openOutside(meant.url)

    openCard(meant.reference)
  }

  /*
   * Two listeners, and each acts on one button only.
   *
   * `click` is raised for the primary button and `auxclick` for the middle one, so in
   * this engine each press reaches one of these. Both are listened for so that no press
   * escapes the rule above whatever the engine does, and each answers only its own
   * button, so a press that somehow raised both is opened once rather than in two tabs.
   */
  document.addEventListener("click", (event) => answer(event, 0), { capture: true })
  document.addEventListener("auxclick", (event) => answer(event, 1), { capture: true })
}
