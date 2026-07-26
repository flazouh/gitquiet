/**
 * The diff renderer, kept out of the content script on purpose.
 *
 * Pierre's renderer with the grammars it needs weighs about four and a half
 * megabytes. A content script is one file loaded on every pull request page,
 * including the ones nobody opens a diff on, so putting it there would tax
 * every visit for a view most visits never reach. This module is built
 * separately (scripts/build-diff-engine.ts) and fetched the first time someone
 * asks to see a file — once per page, then it is in memory.
 *
 * It exports functions over DOM nodes rather than components. The renderer is
 * React-free, and keeping it that way means the chunk carries no second copy of
 * React and no coupling to how the rest of the interface is built.
 */

import { CORE_CSS_ATTRIBUTE, FileDiff, parsePatchFiles, wrapCoreCSS } from "@pierre/diffs"

export type DiffHandle = {
  /** Renders again after the theme flips, since the colours are baked into the DOM. */
  readonly onThemeChange: (theme: "light" | "dark") => void
  readonly destroy: () => void
}

export type DiffRequest = {
  /** A unified diff, as GitHub gives it: `@@` hunks and their context. */
  readonly patch: string
  readonly path: string
  readonly theme: "light" | "dark"
  /** Side by side, or one column with the deletions above the additions. */
  readonly layout: "split" | "stacked"
}

/**
 * Draws one file's diff into `container`, replacing whatever was there.
 *
 * The theme names are Pierre's own light and dark, which read as the page does
 * because their contrast is built on the same idea as Primer's. Matching
 * GitHub's exact syntax colours would mean writing a Shiki theme against their
 * variables — worth doing, later, once the shape of the view has settled.
 */
/**
 * The element the renderer draws into, dressed as its custom element would have
 * dressed it.
 *
 * Normally `<diffs-container>` upgrades itself: shadow root, then Pierre's
 * stylesheet adopted into it. In a content script nothing upgrades, because the
 * isolated world has no registry, so the two lines the element would have run
 * are run here instead. The renderer only ever asks for `shadowRoot ??
 * attachShadow(...)`, and finds one already waiting.
 */
const dressedContainer = (): HTMLElement => {
  const host = document.createElement("diffs-container")
  const shadow = host.attachShadow({ mode: "open" })

  // Their core CSS, which every selector the renderer emits is written against.
  // Written into a real <style> rather than built with their createStyleElement:
  // that returns a hast node for their own renderer to convert, and appending it
  // to a shadow root puts the string "[object Object]" on the page instead of a
  // stylesheet — which is exactly what the diff looked like.
  const style = document.createElement("style")
  style.setAttribute(CORE_CSS_ATTRIBUTE, "")
  style.textContent = wrapCoreCSS("")
  shadow.append(style)
  return host
}

export const renderDiff = (container: HTMLElement, request: DiffRequest): DiffHandle => {
  // A patch parses to a list of patches, each holding a list of files. One file
  // is rendered at a time here, so the first of each is the one meant.
  const [patch] = parsePatchFiles(request.patch, request.path, true)
  const parsed = patch?.files[0]
  if (parsed === undefined) throw new Error(`Nothing to render in the patch for ${request.path}`)

  const diff = new FileDiff({
    diffLayout: request.layout,
    theme: request.theme === "dark" ? "pierre-dark" : "pierre-light",
    themeType: request.theme,
    disableFileHeader: true
  } as ConstructorParameters<typeof FileDiff>[0])

  const host = dressedContainer()
  container.replaceChildren(host)
  diff.render({ fileDiff: parsed, fileContainer: host })

  return {
    onThemeChange: (theme) => {
      diff.setThemeType(theme)
      diff.onThemeChange()
    },
    destroy: () => {
      diff.cleanUp()
    }
  }
}
