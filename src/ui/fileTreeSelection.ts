import { shortCount, type RowMark } from "./rowMarks"

const ROW = '[data-type="item"][data-item-path]'

type FileTreeMarkChoices = {
  readonly counts: boolean
  readonly ticks: boolean
}

type MarkPart = {
  readonly text: string
  readonly color?: string
}

/** What one tree row can show after the reader changes its state. */
const markParts = (mark: RowMark, choices: FileTreeMarkChoices): ReadonlyArray<MarkPart> => [
  ...(choices.ticks && mark.seen ? [{ text: "✓\u00a0", color: "var(--fgColor-muted)" }] : []),
  ...(choices.counts && mark.added > 0
    ? [{ text: `+${shortCount(mark.added)}`, color: "var(--fgColor-success)" }]
    : []),
  ...(choices.counts && mark.added > 0 && mark.deleted > 0 ? [{ text: "\u00a0" }] : []),
  ...(choices.counts && mark.deleted > 0
    ? [{ text: `−${shortCount(mark.deleted)}`, color: "var(--fgColor-danger)" }]
    : [])
]

const markFingerprint = (mark: RowMark | undefined, choices: FileTreeMarkChoices): string =>
  mark === undefined
    ? "none"
    : `${choices.counts}:${choices.ticks}:${mark.added}:${mark.deleted}:${mark.seen}`

const decorationFor = (row: HTMLElement): HTMLElement => {
  const held = [...row.children].find(
    (child) => child.getAttribute("data-item-section") === "decoration"
  )
  if (held !== undefined) return held as HTMLElement

  const made = document.createElement("div")
  made.setAttribute("data-item-section", "decoration")
  const after = [...row.children].find((child) => {
    const section = child.getAttribute("data-item-section")
    return section === "git" || section === "action"
  })
  row.insertBefore(made, after ?? null)
  return made
}

/**
 * Paints mounted row marks without asking the virtual tree to render again.
 *
 * Opening a file changes its seen mark. Rebuilding the tree for that one small
 * change rebuilds every visible row and can start a large document layout.
 */
export const paintFileTreeMarks = (
  root: ParentNode,
  marks: ReadonlyMap<string, RowMark>,
  choices: FileTreeMarkChoices
): number => {
  let changed = 0

  for (const row of root.querySelectorAll<HTMLElement>(ROW)) {
    const path = row.dataset.itemPath?.replace(/\/$/, "")
    if (path === undefined) continue

    const mark = marks.get(path)
    const fingerprint = markFingerprint(mark, choices)
    const decoration = decorationFor(row)
    if (decoration.dataset.gitquietRowMark === fingerprint) continue

    const parts = mark === undefined ? [] : markParts(mark, choices)
    decoration.replaceChildren()
    if (parts.length > 0) {
      const label = document.createElement("span")
      const counts = `+${mark?.added ?? 0} −${mark?.deleted ?? 0}`
      label.title = mark?.seen ? `${counts}, seen` : counts
      for (const part of parts) {
        const piece = document.createElement("span")
        piece.textContent = part.text
        if (part.color !== undefined) piece.style.color = part.color
        label.append(piece)
      }
      decoration.append(label)
    }
    decoration.dataset.gitquietRowMark = fingerprint
    changed += 1
  }

  return changed
}

/**
 * Paints one mounted tree row as selected without asking the tree to rebuild.
 *
 * Pierre rebuilds every mounted row after a model selection change. A route
 * button already owns the selected path, so changing these three row attributes
 * keeps the visible and accessible state correct without repeating that work.
 */
export const paintFileTreeSelection = (
  root: ParentNode,
  wanted: string
): HTMLElement | null => {
  const rows = [...root.querySelectorAll<HTMLElement>(ROW)]
  const target = rows.find((row) => row.dataset.itemPath === wanted)
  if (target === undefined) return null

  for (const row of rows) {
    const selected = row === target
    if (selected) row.setAttribute("data-item-selected", "true")
    else row.removeAttribute("data-item-selected")
    row.setAttribute("aria-selected", `${selected}`)
    row.tabIndex = selected ? 0 : -1
  }
  return target
}

/**
 * Uses the mounted row when it exists. Virtual tree scrolling rebuilds a large
 * projection, so it is only the fallback for a row that is truly off screen.
 */
export const paintOrScrollFileTreeSelection = (
  root: ParentNode | null,
  wanted: string,
  scrollToPath: (path: string, options: { readonly focus: false }) => void
): boolean => {
  if (root !== null && paintFileTreeSelection(root, wanted) !== null) return false

  scrollToPath(wanted, { focus: false })
  return true
}
