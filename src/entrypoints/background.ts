import { defineBackground } from "wxt/utils/define-background"
import { INTERFACE_SCRIPT, INTERFACE_STYLES, isOpenHere } from "@/app/injection"
import { initialiseErrorReporting, reportError } from "@/observability/sentry"

export default defineBackground(() => {
  initialiseErrorReporting("service-worker")

  /**
   * Puts the interface on a tab that asked for it.
   *
   * Injecting is a privilege a page does not have, which is the only reason
   * this is here rather than in the script that noticed the navigation.
   *
   * The stylesheet goes first and deliberately: it carries the rule that keeps
   * GitHub's conversation off the screen, and arriving after the script would
   * mean arriving after the interface had already had to decide whether to show
   * a page it could not yet hide.
   */
  browser.runtime.onMessage.addListener((message, sender) => {
    if (!isOpenHere(message)) return

    const tabId = sender.tab?.id
    if (tabId === undefined) return

    // Exactly where the asking came from. A pull request in an iframe is not a
    // thing GitHub does, but injecting into every frame of a page because one
    // of them asked is a habit worth not having.
    const target = { tabId, frameIds: sender.frameId === undefined ? undefined : [sender.frameId] }

    return browser.scripting
      .insertCSS({ target, files: [INTERFACE_STYLES] })
      .then(() => browser.scripting.executeScript({ target, files: [INTERFACE_SCRIPT] }))
      .then(() => ({ opened: true }))
      .catch((error: unknown) => {
        // The tab closed, or navigated away, or GitHub is not on it any more.
        // Nothing is waiting on this and there is nobody to tell.
        reportError(error)
        return { opened: false }
      })
  })
})
