const COMMIT = /^\/[^/]+\/[^/]+\/commit\/[0-9a-f]+/i

/**
 * Whether a plain click on this URL should stay in the window.
 *
 * Commit rows are real anchors to github.com (so Cmd-click and copy-link still
 * work), and without this exception the capture-phase "open outside" rule opens
 * them in the browser before the commit panel ever hears the press.
 */
export const opensInside = (
  href: string,
  how: {
    readonly metaKey: boolean
    readonly ctrlKey: boolean
    readonly shiftKey: boolean
    readonly altKey: boolean
    readonly button: number
  }
): boolean => {
  if (how.button !== 0 || how.metaKey || how.ctrlKey || how.shiftKey || how.altKey) return false

  try {
    const url = new URL(href)
    return url.hostname === "github.com" && COMMIT.test(url.pathname)
  } catch {
    return false
  }
}
