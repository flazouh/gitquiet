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

import type { DiffChoices } from "../domain/choices"
import { PAPER, type DiffHandle, type DiffRequest, type DiffSide, type Note, type Picked } from "../ports/Renderer"
import {
  CORE_CSS_ATTRIBUTE,
  FileDiff,
  parsePatchFiles,
  registerCustomTheme,
  wrapCoreCSS
} from "@pierre/diffs"

/**
 * The syntax colours, which are the reader's to choose.
 *
 * Only the tokens: the surfaces, the gutter and the green and red of a changed
 * line are GitHub's either way — see PRIMER below — so the diff sits in the
 * page rather than on it whichever of these is picked. One Dark has no light
 * half, so its light counterpart is Pierre's own.
 */
const THEMES = {
  "one-dark": { dark: "one-dark-pro", light: "pierre-light" },
  github: { dark: "github-dark-default", light: "github-light-default" }
} as const

registerCustomTheme("one-dark-pro", () => import("@shikijs/themes/one-dark-pro"))
registerCustomTheme("github-dark-default", () => import("@shikijs/themes/github-dark-default"))
registerCustomTheme("github-light-default", () => import("@shikijs/themes/github-light-default"))

/**
 * Everything around the code: the canvas, the gutter, the green and the red.
 *
 * The theme above colours tokens and nothing else, so left alone the diff sits
 * on Pierre's own surfaces in the middle of GitHub's. These are all the
 * variables their stylesheet leaves open, pointed at Primer's — which means the
 * page's theme, whichever of the six it is, is answered without naming a single
 * colour here.
 */
const SHEET = `var(${PAPER}, var(--bgColor-default))`

const PRIMER: Readonly<Record<string, string>> = {
  "--diffs-light-bg": SHEET,
  "--diffs-dark-bg": SHEET,
  "--diffs-light": "var(--fgColor-default)",
  "--diffs-dark": "var(--fgColor-default)",

  // Primer's green and red as the *base* colour of a change, and no more than
  // that: their stylesheet mixes a base into the canvas itself — twelve percent
  // of it in light, twenty in dark, more for the number and the changed words —
  // and that is the tint we want. Overriding the fills instead, as this did
  // twice, means choosing those numbers by hand for both themes: full-strength
  // emphasis paints a line in signal red and the code on it cannot be read, and
  // GitHub's own `--diffBlob-*` fills are ten percent alpha, which disappears.
  "--diffs-addition-color-override": "var(--fgColor-success)",
  "--diffs-deletion-color-override": "var(--fgColor-danger)",

  "--diffs-bg-context-override": SHEET,
  "--diffs-bg-context-gutter-override": "var(--bgColor-muted)",
  "--diffs-bg-buffer-override": SHEET,
  "--diffs-bg-separator-override": "var(--bgColor-muted)",
  "--diffs-bg-hover-override": "var(--bgColor-neutral-muted)",
  "--diffs-fg-number-override": "var(--fgColor-muted)",
  // The page's own text colour on the tinted cells: a tint of the canvas keeps
  // the canvas's lightness, so what reads on one reads on the other.
  "--diffs-fg-number-addition-override": "var(--fgColor-default)",
  "--diffs-fg-number-deletion-override": "var(--fgColor-default)",

  // Whatever mono the reader has set for the rest of GitHub. The size is not
  // here: it is theirs to choose, and set per render below.
  "--diffs-font-family": "var(--fontStack-monospace)"
}

/**
 * The gap their own header would have closed, closed.
 *
 * Their stylesheet puts eight pixels above the first line of a diff and takes
 * them straight back off when a file header is sitting on top of it:
 * `[data-diffs-header] ~ [data-diff] [data-code] { padding-top: 0 }`. Both halves
 * are right. What is not right is that this interface takes `disableFileHeader`
 * and draws `FileHeading` instead, which satisfies the first rule and not the
 * second — so every open file had a band of canvas between its name and its
 * first line, and on a file that is all additions the band reads as a line of
 * the diff that failed to paint.
 *
 * Through `wrapCoreCSS` rather than as a shadow-root stylesheet of our own,
 * because that is the door they built: it lands in `@layer theme`, and their own
 * rules are in `@layer base`. Layers beat specificity, so this holds without an
 * `!important` and without knowing which copy of the core stylesheet the shell
 * happened to adopt.
 */
const OURS = `
  [data-code] {
    padding-top: 0;
  }
`

const asAnnotation = (note: Note) => ({
  side: note.side,
  lineNumber: note.line,
  metadata: note.key
})

/**
 * Their range, as a range.
 *
 * Dragging upwards reports the end above the start, and a range that has to be
 * read either way round to find its first line is a bug waiting in every caller.
 */
const picked = (range: { start: number; end: number; side?: DiffSide }): Picked => ({
  side: range.side ?? "additions",
  from: Math.min(range.start, range.end),
  to: Math.max(range.start, range.end)
})

/**
 * A host's shadow root, made only if it has not made its own.
 *
 * Which of the two happens depends on whether anything upgraded the element, and
 * that differs by platform in a way this file cannot see. In a content script
 * nothing upgrades — the isolated world's registry is a stand-in that defines and
 * upgrades nothing — so the shadow root has to be attached here. In a window the
 * registry is real, `<diffs-container>` upgrades the instant it is created, and it
 * has attached one already.
 *
 * Asking twice is not a no-op: `attachShadow` on a host that has one throws
 * `NotSupportedError`, which threw out of a mount effect and took the whole card
 * down with it — a pull request that read perfectly and drew nothing at all.
 */
export const shadowFor = (host: HTMLElement): ShadowRoot =>
  host.shadowRoot ?? host.attachShadow({ mode: "open" })

/**
 * The element the renderer draws into, dressed as its custom element would have
 * dressed it.
 *
 * Normally `<diffs-container>` upgrades itself: shadow root, then Pierre's
 * stylesheet adopted into it. Where nothing upgrades, the two lines the element
 * would have run are run here instead. The renderer only ever asks for
 * `shadowRoot ?? attachShadow(...)`, and finds one already waiting either way.
 */
const dressedContainer = (theme: "light" | "dark", choices: DiffChoices): HTMLElement => {
  const host = document.createElement("diffs-container")
  const shadow = shadowFor(host)

  // Which half of a light-dark() applies here. Their stylesheet is written in
  // light-dark() throughout, and that reads `color-scheme` — not the page's
  // theme, not a media query — so a host that never declares one is a light
  // host inside a dark page: every tint was being mixed into white and came out
  // invisible against the dark canvas.
  host.style.colorScheme = theme

  // On the host rather than inside the shadow root: custom properties inherit
  // across the boundary, so Primer's variables — which are declared out on the
  // page — resolve here and are read by their stylesheet in there.
  for (const [name, value] of Object.entries(PRIMER)) host.style.setProperty(name, value)
  host.style.setProperty("--diffs-font-size", `${choices.fontSize}px`)
  host.style.setProperty("--diffs-line-height", `${choices.lineHeight}px`)

  // Their core CSS, which every selector the renderer emits is written against.
  // Written into a real <style> rather than built with their createStyleElement:
  // that returns a hast node for their own renderer to convert, and appending it
  // to a shadow root puts the string "[object Object]" on the page instead of a
  // stylesheet — which is exactly what the diff looked like.
  const style = document.createElement("style")
  style.setAttribute(CORE_CSS_ATTRIBUTE, "")
  style.textContent = wrapCoreCSS(OURS)
  shadow.append(style)
  return host
}

export const renderDiff = (container: HTMLElement, request: DiffRequest): DiffHandle => {
  // A patch parses to a list of patches, each holding a list of files. One file
  // is rendered at a time here, so the first of each is the one meant.
  const [patch] = parsePatchFiles(request.patch, request.path, true)
  const parsed = patch?.files[0]
  if (parsed === undefined) throw new Error(`Nothing to render in the patch for ${request.path}`)

  const choices = request.choices
  const diff = new FileDiff<string>({
    diffStyle: choices.layout,
    overflow: choices.overflow,
    theme: THEMES[choices.syntax],
    themeType: request.theme,
    disableFileHeader: true,
    disableLineNumbers: !choices.lineNumbers,
    hunkSeparators: choices.separators,
    lineDiffType: choices.withinLine,
    collapsedContextThreshold: choices.context,
    expansionLineCount: choices.expansion,

    // Marking lines out and saying something about them. Both ways in that
    // GitHub has: dragging across the numbers, and the plus that follows the
    // pointer down the gutter — the renderer draws and places that button
    // itself, all it wants is somewhere to report the click.
    //
    // Both go away when there is nowhere to report to. A plus that follows the
    // pointer for the length of a file and then opens nothing is an offer this
    // interface cannot keep, and the reader is the last one to find that out.
    enableLineSelection: request.onPick !== undefined,
    enableGutterUtility: request.onPick !== undefined,
    lineHoverHighlight: "both",
    onGutterUtilityClick: (range) => request.onPick?.(picked(range)),
    onLineSelected: (range) => request.onPick?.(range === null ? null : picked(range)),
    // A row's contents are the caller's, and they are hung in the host's own
    // children rather than in the shadow root — the renderer slots them in.
    // Which is what makes them ordinary elements on the page, reached by the
    // page's stylesheets, rather than something needing a stylesheet in here.
    renderAnnotation: (annotation) => request.fillNote?.(annotation.metadata),
    // Pierre marks a changed line with a bar in the margin and leaves the line
    // itself the colour of the page. GitHub fills the line, and filled lines
    // are how anyone who reads pull requests knows at a glance how much of a
    // file moved — so both default to GitHub's way of it, and both can be
    // turned back.
    diffIndicators: choices.marks,
    disableBackground: !choices.fill
  } as ConstructorParameters<typeof FileDiff<string>>[0])

  const host = dressedContainer(request.theme, choices)
  container.replaceChildren(host)
  diff.render({
    fileDiff: parsed,
    fileContainer: host,
    lineAnnotations: (request.notes ?? []).map(asAnnotation)
  })

  return {
    onThemeChange: (theme) => {
      diff.setThemeType(theme)
      diff.onThemeChange()
    },
    showNotes: (notes) => {
      diff.render({ fileDiff: parsed, fileContainer: host, lineAnnotations: notes.map(asAnnotation) })
    },
    unpick: () => {
      diff.setSelectedLines(null)
    },
    destroy: () => {
      diff.cleanUp()
    }
  }
}
