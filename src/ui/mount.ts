export const ROOT_ID = "githubpro-root"

/** Marks a stylesheet as ours, so the takeover leaves it alone. */
export const OURS = "data-githubpro"

/**
 * Removes every stylesheet in the document that is not ours.
 *
 * Replacing the body leaves forty-odd GitHub stylesheets in the head, and theirs
 * win: rules we ship sit inside Tailwind's layers, and any unlayered rule
 * outranks a layered one however specific. Left alone, GitHub's `body` decides
 * the font and the background of a page that is meant to be ours.
 */
const stripForeignStyles = (target: Document): void => {
  for (const sheet of target.querySelectorAll(
    `link[rel="stylesheet"]:not([${OURS}]), style:not([${OURS}])`
  )) {
    sheet.remove()
  }
}

/**
 * Replaces GitHub's rendered page rather than layering on top of it, so their
 * scripts have nothing left to re-render into and we own the whole surface.
 * Anything the caller needs from the original document must be read first.
 */
export const takeOverPage = (
  target: Document,
  render: (container: Element) => void
): void => {
  stripForeignStyles(target)

  // GitHub keeps loading stylesheets after we have taken over — their bundles
  // arrive lazily and their scripts are still running — so this holds rather
  // than firing once. The head is watched, not the whole document: that is where
  // stylesheets appear, and the interface's own subtree changes constantly.
  new MutationObserver(() => stripForeignStyles(target)).observe(target.head, {
    childList: true
  })

  const container = target.createElement("div")
  container.id = ROOT_ID
  target.body.replaceChildren(container)

  // The host page's margins and its scrolling would otherwise leak into ours,
  // and the Control Center's whole claim is that it does not scroll.
  for (const element of [target.documentElement, target.body]) {
    element.style.margin = "0"
    element.style.padding = "0"
    element.style.height = "100%"
    element.style.overflow = "hidden"
  }

  render(container)
}
