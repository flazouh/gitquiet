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
import { syntaxOf } from "../domain/syntax"
import {
  PAPER,
  type DiffHandle,
  type DiffPreparation,
  type DiffRequest,
  type DiffSide,
  type Note,
  type Picked
} from "../ports/Renderer"
import { LOADERS } from "../syntax/loaders"
import { Effect } from "effect"
import {
  CORE_CSS_ATTRIBUTE,
  FileDiff,
  getFiletypeFromFileName,
  getTotalLineCountFromHunks,
  parsePatchFiles,
  registerCustomTheme,
  type RenderRange,
  wrapCoreCSS
} from "@pierre/diffs"
import { WorkerPoolManager } from "@pierre/diffs/worker"
import { remoteDiffWorker } from "./remoteWorker"

/**
 * The syntax colours Pierre can name, registered once.
 *
 * Which pair a render uses is `syntaxOf`: Match follows the pack, One Dark and
 * GitHub stay as overrides. Surfaces are not these — see SURFACES below.
 */
for (const [name, load] of Object.entries(LOADERS)) {
  registerCustomTheme(name, load as Parameters<typeof registerCustomTheme>[1])
}

let workerPool: WorkerPoolManager | undefined
let workerPoolKey: string | undefined

const poolFor = (request: DiffPreparation): WorkerPoolManager | undefined => {
  if (typeof Worker === "undefined") return undefined
  const syntax = syntaxOf(request.choices.syntax, request.pack ?? "github")
  const key = `${syntax.light}|${syntax.dark}|${request.choices.withinLine}`
  if (workerPool !== undefined && workerPoolKey === key) return workerPool

  workerPool?.terminate()
  workerPoolKey = key
  workerPool = new WorkerPoolManager(
    {
      workerFactory: remoteDiffWorker,
      poolSize: 1
    },
    {
      theme: syntax,
      lineDiffType: request.choices.withinLine,
      langs: [getFiletypeFromFileName(request.path)]
    }
  )
  return workerPool
}

/**
 * Everything around the code: the canvas, the gutter, the green and the red.
 *
 * The theme above colours tokens and nothing else, so left alone the diff sits
 * on Pierre's own surfaces in the middle of the pack. These are all the
 * variables their stylesheet leaves open, pointed at ours — which means the
 * pack, whichever it is, is answered without naming a single colour here.
 */
const SHEET = `var(${PAPER}, var(--bgColor-default))`

export const SURFACES: Readonly<Record<string, string>> = {
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
  "--diffs-bg-hover-override": "var(--color-hover)",
  "--diffs-fg-number-override": "var(--fgColor-muted)",
  // The page's own text colour on the tinted cells: a tint of the canvas keeps
  // the canvas's lightness, so what reads on one reads on the other.
  "--diffs-fg-number-addition-override": "var(--fgColor-default)",
  "--diffs-fg-number-deletion-override": "var(--fgColor-default)",

  // Whatever mono the reader has set for the rest of GitHub. The size is not
  // here: it is theirs to choose, and set per render below.
  "--diffs-font-family":
    "var(--font-mono, var(--fontStack-monospace, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace))"
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
const DIFF_CSS = `
  [data-code] {
    padding-top: 0;
  }
`

const asAnnotation = (note: Note) => ({
  side: note.side,
  lineNumber: note.line,
  metadata: note.key
})

const ROW_BATCH = 4

/** Plans partial renders without changing the diff's reserved scroll height. */
export const renderRanges = (
  totalLines: number,
  lineHeight: number,
  batch: number = ROW_BATCH
): ReadonlyArray<RenderRange> => {
  const ranges: Array<RenderRange> = []
  for (let visible = batch; visible < totalLines; visible += batch) {
    ranges.push({
      startingLine: 0,
      totalLines: visible,
      bufferBefore: 0,
      bufferAfter: (totalLines - visible) * lineHeight
    })
  }
  if (totalLines > 0)
    ranges.push({ startingLine: 0, totalLines, bufferBefore: 0, bufferAfter: 0 })
  return ranges
}

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
 * The element the renderer draws into, dressed as its custom element.
 *
 * Normally `<diffs-container>` upgrades itself: shadow root, then Pierre's
 * stylesheet adopted into it. This code performs the same setup before render.
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
  for (const [name, value] of Object.entries(SURFACES)) host.style.setProperty(name, value)
  host.style.setProperty("--diffs-font-size", `${choices.fontSize}px`)
  host.style.setProperty("--diffs-line-height", `${choices.lineHeight}px`)

  // Their core CSS, which every selector the renderer emits is written against.
  // Written into a real <style> rather than built with their createStyleElement:
  // that returns a hast node for their own renderer to convert, and appending it
  // to a shadow root puts the string "[object Object]" on the page instead of a
  // stylesheet — which is exactly what the diff looked like.
  const style = document.createElement("style")
  style.setAttribute(CORE_CSS_ATTRIBUTE, "")
  style.textContent = wrapCoreCSS(DIFF_CSS)
  shadow.append(style)
  return host
}

type PreparedHandle = DiffHandle & {
  readonly activate: (container: HTMLElement, request: DiffRequest) => void
}

const preparedViews = new Map<string, PreparedHandle>()

const preparationKey = (request: DiffPreparation): string =>
  `${request.path}\u0000${request.patch}\u0000${request.theme}\u0000${request.pack ?? "github"}\u0000${JSON.stringify(request.choices)}`

const keyFingerprint = (key: string): string => {
  let hash = 2_166_136_261
  for (let index = 0; index < key.length; index += 1) {
    hash = Math.imul(hash ^ key.charCodeAt(index), 16_777_619)
  }
  return `${key.length}:${hash >>> 0}`
}

const buildDiff = (
  container: HTMLElement,
  request: DiffRequest | DiffPreparation,
  initiallyPaused: boolean
): PreparedHandle => {
  // A patch parses to a list of patches, each holding a list of files. One file
  // is rendered at a time here, so the first of each is the one meant.
  const [patch] = parsePatchFiles(request.patch, request.path, true)
  const parsed = patch?.files[0]
  if (parsed === undefined) throw new Error(`Nothing to render in the patch for ${request.path}`)

  const choices = request.choices
  let current: DiffPreparation &
    Partial<Pick<DiffRequest, "onPick" | "notes" | "fillNote">> = request
  let queueNext = (): void => {}
  const pool = poolFor(request)
  const diff = new FileDiff<string>({
    diffStyle: choices.layout,
    overflow: choices.overflow,
    theme: syntaxOf(choices.syntax, request.pack ?? "github"),
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
    onGutterUtilityClick: (range) => current.onPick?.(picked(range)),
    onLineSelected: (range) => current.onPick?.(range === null ? null : picked(range)),
    // A row's contents are the caller's, and they are hung in the host's own
    // children rather than in the shadow root — the renderer slots them in.
    // Which is what makes them ordinary elements on the page, reached by the
    // page's stylesheets, rather than something needing a stylesheet in here.
    renderAnnotation: (annotation) => current.fillNote?.(annotation.metadata),
    // Pierre marks a changed line with a bar in the margin and leaves the line
    // itself the colour of the page. GitHub fills the line, and filled lines
    // are how anyone who reads pull requests knows at a glance how much of a
    // file moved — so both default to GitHub's way of it, and both can be
    // turned back.
    diffIndicators: choices.marks,
    disableBackground: !choices.fill,
    onPostRender: () => queueNext()
  } as ConstructorParameters<typeof FileDiff<string>>[0], pool)
  const host = dressedContainer(request.theme, choices)
  container.replaceChildren(host)
  const totalLines = Math.max(
    getTotalLineCountFromHunks(parsed.hunks),
    parsed.additionLines.length,
    parsed.deletionLines.length
  )
  const ranges = renderRanges(totalLines, choices.lineHeight)
  let rangeAt = 0
  let queued = false
  let destroyed = false
  let paused = initiallyPaused
  let timer: number | undefined
  let heldNotes = current.notes ?? []
  const draw = (): boolean =>
    diff.render({
      fileDiff: parsed,
      fileContainer: host,
      lineAnnotations: heldNotes.map(asAnnotation),
      renderRange: ranges[rangeAt]
    })

  queueNext = () => {
    if (destroyed || paused || queued || rangeAt >= ranges.length - 1) return
    queued = true
    timer = window.setTimeout(() => {
      queued = false
      if (destroyed) return
      rangeAt += 1
      if (draw()) queueNext()
    }, 0)
  }
  if (draw()) queueNext()

  return {
    onThemeChange: (theme) => {
      diff.setThemeType(theme)
      diff.onThemeChange()
    },
    showNotes: (notes) => {
      heldNotes = notes
      if (draw()) queueNext()
    },
    unpick: () => {
      diff.setSelectedLines(null)
    },
    destroy: () => {
      destroyed = true
      if (timer !== undefined) window.clearTimeout(timer)
      diff.cleanUp()
      host.remove()
    },
    activate: (destination, liveRequest) => {
      current = liveRequest
      heldNotes = liveRequest.notes ?? []
      if (host.parentElement !== destination) destination.replaceChildren(host)
      paused = false
      queueNext()
    }
  }
}

export const renderDiff = (container: HTMLElement, request: DiffRequest): DiffHandle => {
  const started = performance.now()
  const key = preparationKey(request)
  const prepared = preparedViews.get(key)
  performance.mark("gitquiet:prepared-view", {
    detail: {
      hit: prepared !== undefined,
      size: preparedViews.size,
      path: request.path,
      key: keyFingerprint(key)
    }
  })
  const measured = (handle: DiffHandle): DiffHandle => {
    performance.measure("gitquiet:diff-render", {
      start: started,
      detail: { path: request.path, prepared: prepared !== undefined }
    })
    return handle
  }
  if (prepared === undefined) return measured(buildDiff(container, request, false))

  preparedViews.delete(key)
  const timer = window.setTimeout(() => prepared.activate(container, request), 0)
  return measured({
    onThemeChange: prepared.onThemeChange,
    showNotes: prepared.showNotes,
    unpick: prepared.unpick,
    destroy: () => {
      window.clearTimeout(timer)
      prepared.destroy()
    }
  })
}

const preparing = new Set<string>()

/**
 * Starts Pierre's syntax worker while the rendered document is readable.
 */
export const prepareDiff = (
  container: HTMLElement,
  request: DiffPreparation
): Effect.Effect<void, unknown> => {
  const key = preparationKey(request)
  if (preparedViews.has(key) || preparing.has(key)) return Effect.void
  preparing.add(key)
  const started = performance.now()

  const pool = poolFor(request)
  if (pool === undefined) {
    preparing.delete(key)
    return Effect.void
  }
  const [patch] = parsePatchFiles(request.patch, request.path, true)
  const parsed = patch?.files[0]
  if (parsed === undefined) {
    preparing.delete(key)
    return Effect.fail(new Error(`Nothing to prepare in the patch for ${request.path}`))
  }
  return Effect.tryPromise({
    try: () => pool.initialize([getFiletypeFromFileName(request.path)]),
    catch: (cause) => cause
  }).pipe(
    Effect.flatMap(() =>
      Effect.tryPromise({
        try: () => pool.primeDiffHighlightCache(parsed),
        catch: (cause) => cause
      })
    ),
    Effect.tap(() =>
      Effect.sync(() => {
        const view = buildDiff(container, request, true)
        const held = preparedViews.get(key)
        held?.destroy()
        preparedViews.set(key, view)
        while (preparedViews.size > 4) {
          const oldest = preparedViews.entries().next().value as
            | [string, PreparedHandle]
            | undefined
          if (oldest === undefined) break
          oldest[1].destroy()
          preparedViews.delete(oldest[0])
        }
      })
    ),
    Effect.tap(() =>
      Effect.sync(() => {
        performance.measure("gitquiet:diff-prepare", {
          start: started,
          detail: { path: request.path, key: keyFingerprint(key) }
        })
      })
    ),
    Effect.ensuring(Effect.sync(() => preparing.delete(key)))
  )
}
