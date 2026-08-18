import { opensInside } from "./opensInside"
import { ask } from "./rpc"
import { theirPage } from "./theirPage"

/**
 * Where a link goes, in a window that must not follow one.
 *
 * The webview is the interface. It has no address bar, no back button and no tab
 * to close, so a link that navigates it does not open a page — it replaces the
 * app with a page, and the only way back is to quit. That is exactly what
 * happened: the card's own "GitHub" link is an anchor, correct markup on either
 * platform, and following it in here left the reader on github.com inside
 * something that looked like our window and behaved like nothing at all.
 *
 * So the window never follows a link. Every outward one is handed to the main
 * process, which asks the system to open it where the reader's browser is —
 * except for destinations this window itself can show (a commit panel), which
 * a plain click leaves for the screen's handler.
 *
 * Caught in the capture phase at the document, rather than on the screens, so
 * that a link added anywhere later is caught by the same rule. Nothing about a
 * link is the screens' business.
 */

export const openOutside = (url: string): void => {
  void ask("openOutside", { url }).then((answered) => {
    if (!answered.ok) console.error("[working-set] could not open outside:", answered.why)
  })
}

/**
 * Nothing in this window follows a link.
 *
 * Installed once, for the life of the window. It answers a press on an anchor
 * before any handler of ours sees it — the list's own reading of a press runs
 * after, and turns a row into a card.
 */
export const keepLinksOutside = (): void => {
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target
      const anchor = target instanceof Element ? target.closest("a[href]") : null
      if (anchor === null) return

      const href = anchor.getAttribute("href")
      if (href === null) return

      const absolute = theirPage(
        href,
        anchor instanceof HTMLAnchorElement ? anchor.href : undefined
      )
      if (absolute === null) return

      // Never let the webview navigate. Where the app can show the destination,
      // stop here and leave the press for its handler; otherwise open outside.
      event.preventDefault()
      if (
        opensInside(absolute, {
          metaKey: event.metaKey,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          button: event.button
        })
      ) {
        return
      }

      openOutside(absolute)
    },
    { capture: true }
  )
}
