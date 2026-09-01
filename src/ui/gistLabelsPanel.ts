import { labelsOf, nameOf, type KeptGists } from "../domain/gistLabels"
import { placedRowsOnPage, type PlacedRow } from "../github/gistList"

/**
 * A Label and a Name on each row of a reader's own gist list, drawn beside
 * the filename GitHub picked and never lets be changed. See
 * `docs/spec/gists.md`.
 *
 * Plain DOM, the same way `gistBanner.ts` and `gistSearch.ts` are: one small
 * piece appended per row, not a region taken over.
 */
export const CHIP_CLASS = "gitquiet-gist-label-chip"
const PANEL_CLASS = "gitquiet-gist-labels-panel"
export const EDIT_ID = "gitquiet-gist-labels-edit"

/** What committing the edit form on one row hands back. */
export type OnChange = (id: string, labels: ReadonlyArray<string>, name: string | null) => void

const originalTitleOf = (titleEl: Element): string =>
  titleEl.getAttribute("data-gitquiet-original-title") ?? titleEl.textContent?.trim() ?? ""

/**
 * Redraws one row's chips and title from `kept`, without touching its edit
 * form — and without writing to the DOM at all where nothing would change.
 *
 * The content script that plants this panel watches the document with a
 * `MutationObserver` and replants on every mutation, because GitHub's own
 * `gist-pjax-container` can redraw a row without loading a document. Setting
 * `textContent` or calling `replaceChildren` is itself a mutation, even when
 * the value written is the one already there — so an unconditional redraw
 * would have the observer call this again, forever. Comparing first, and
 * writing only on a real change, is what keeps that from happening rather
 * than papering over it with a flag.
 */
const redraw = (placed: PlacedRow, kept: KeptGists): void => {
  const { element, row } = placed
  const titleEl = element.querySelector("strong.css-truncate-target")
  if (titleEl !== null && titleEl.getAttribute("data-gitquiet-original-title") === null) {
    titleEl.setAttribute("data-gitquiet-original-title", originalTitleOf(titleEl))
  }

  const wanted = titleEl === null ? null : nameOf(kept, row.id) ?? originalTitleOf(titleEl)
  if (titleEl !== null && titleEl.textContent?.trim() !== wanted) titleEl.textContent = wanted

  const panel = element.querySelector(`.${PANEL_CLASS}`)
  const chips = panel?.querySelector('[data-gitquiet-role="chips"]')
  if (chips === null || chips === undefined) return

  const wantedLabels = labelsOf(kept, row.id)
  const drawnLabels = [...chips.children].map((chip) => chip.textContent?.trim())
  if (wantedLabels.length === drawnLabels.length && wantedLabels.every((one, at) => one === drawnLabels[at])) {
    return
  }

  chips.replaceChildren(
    ...wantedLabels.map((label) => {
      const chip = element.ownerDocument.createElement("span")
      chip.className = `${CHIP_CLASS} Label mr-1`
      chip.textContent = label
      return chip
    })
  )
}

/** Builds the (closed) edit form for one row, wired to commit through `onChange`. */
const formFor = (placed: PlacedRow, kept: KeptGists, onChange: OnChange): HTMLFormElement => {
  const { row } = placed
  const doc = placed.element.ownerDocument

  const form = doc.createElement("form")
  form.hidden = true
  form.className = "d-flex flex-items-center gap-1 mt-1"

  const labelsInput = doc.createElement("input")
  labelsInput.type = "text"
  labelsInput.placeholder = "Labels, comma separated"
  labelsInput.className = "form-control input-sm"
  labelsInput.setAttribute("data-gitquiet-field", "labels")
  labelsInput.value = labelsOf(kept, row.id).join(", ")

  const nameInput = doc.createElement("input")
  nameInput.type = "text"
  nameInput.placeholder = "Name"
  nameInput.className = "form-control input-sm"
  nameInput.setAttribute("data-gitquiet-field", "name")
  nameInput.value = nameOf(kept, row.id) ?? ""

  const save = doc.createElement("button")
  save.type = "submit"
  save.className = "btn btn-sm"
  save.textContent = "Save"

  form.append(labelsInput, nameInput, save)

  form.addEventListener("submit", (event) => {
    event.preventDefault()
    const labels = labelsInput.value.split(",").map((one) => one.trim()).filter((one) => one.length > 0)
    const name = nameInput.value.trim()
    onChange(row.id, labels, name.length === 0 ? null : name)
    form.hidden = true
  })

  return form
}

/** Builds the (closed by default) panel for one row: existing chips, and the toggle that opens the form. */
const panelFor = (placed: PlacedRow, kept: KeptGists, onChange: OnChange): HTMLElement => {
  const doc = placed.element.ownerDocument
  const panel = doc.createElement("div")
  panel.className = PANEL_CLASS

  const chips = doc.createElement("span")
  chips.setAttribute("data-gitquiet-role", "chips")

  const edit = doc.createElement("button")
  edit.type = "button"
  edit.id = EDIT_ID
  edit.className = "btn-link f6"
  edit.textContent = "Label / name…"

  const form = formFor(placed, kept, onChange)
  edit.addEventListener("click", () => {
    form.hidden = !form.hidden
  })

  panel.append(chips, edit, form)
  return panel
}

/**
 * Puts a Label and a Name panel on every row, once each.
 *
 * `onChange` is asked to do the writing and the re-plant — this only builds
 * the form and reads the display back from whatever `kept` says, so a caller
 * that writes to storage and calls this again with the fresh map is the whole
 * of what keeps the two in step.
 */
export const plantGistLabelsPanel = (page: Document, kept: KeptGists, onChange: OnChange): void => {
  for (const placed of placedRowsOnPage(page)) {
    const already = placed.element.querySelector(`.${PANEL_CLASS}`)
    if (already === null) {
      const meta = placed.element.querySelector(".gist-snippet-meta > div.flex-order-1, .flex-order-1")
      meta?.append(panelFor(placed, kept, onChange))
    }
    redraw(placed, kept)
  }
}
