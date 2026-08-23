const FILES_PANEL = '[data-gitquiet-activation="files-panel"]'
const FILES_TREE = '[data-gitquiet-activation="files-tree"]'
const FILES_CONTENT = '[data-gitquiet-activation="files-content"]'
const LIST = '[data-gitquiet-activation="list"]'
const LIST_SECTION = '[data-gitquiet-activation="list-section"]'
const ACTIVE_DRAWING = '[data-file][aria-hidden="false"]'
const PROSE_RUNS = "[data-gitquiet-prose-runs]"

const FIRST_VISIBLE_RUNS = 4
const RUN_BATCH = 4

type Schedule = (work: () => void) => void

export type RouteActivation = {
  readonly start: () => void
  readonly cancel: () => void
}

const noActivation: RouteActivation = {
  start: () => {},
  cancel: () => {}
}

/**
 * Keeps a prepared file view out of one large first layout.
 *
 * The detached tree is complete before this runs. The browser still has to
 * calculate its styles and geometry when it enters the document, so the file
 * panel enters in small tasks. Only prose below the first viewport is split
 * further. It is already outside the reader's view.
 */
export const prepareRouteActivation = (
  root: Element,
  schedule: Schedule = (work) => window.setTimeout(work, 0)
): RouteActivation => {
  const panel = root.querySelector<HTMLElement>(FILES_PANEL)
  const list = root.querySelector<HTMLElement>(LIST)
  const listSections = [...root.querySelectorAll<HTMLElement>(LIST_SECTION)]
  if (panel === null && listSections.length === 0) return noActivation

  const tree = panel?.querySelector<HTMLElement>(FILES_TREE) ?? null
  const content = panel?.querySelector<HTMLElement>(FILES_CONTENT) ?? null
  const drawing = panel?.querySelector<HTMLElement>(ACTIVE_DRAWING) ?? null
  const runs = [
    ...(drawing?.querySelector<HTMLElement>(PROSE_RUNS)?.children ?? [])
  ].filter((run): run is HTMLElement => run instanceof HTMLElement)

  const panelVisibility = panel?.style.contentVisibility ?? ""
  const panelSize = panel?.style.containIntrinsicSize ?? ""
  const treeHidden = tree?.hidden
  const contentHidden = content?.hidden
  const drawingHidden = drawing?.hidden
  const runHidden = runs.map((run) => run.hidden)
  const listWasHidden = list?.hidden
  const listHidden = listSections.map((section) => section.hidden)

  if (panel !== null) {
    panel.style.contentVisibility = "hidden"
    panel.style.containIntrinsicSize = "auto 792px"
  }
  if (tree !== null) tree.hidden = true
  if (content !== null) content.hidden = true
  if (drawing !== null) drawing.hidden = true
  for (const run of runs.slice(FIRST_VISIBLE_RUNS)) run.hidden = true
  if (list !== null) list.hidden = true
  for (const section of listSections) section.hidden = true

  const stages: Array<() => void> = []
  if (panel !== null) {
    stages.push(
      () => {
        panel.style.contentVisibility = panelVisibility
        panel.style.containIntrinsicSize = panelSize
      },
      () => {
        if (tree !== null) tree.hidden = treeHidden ?? false
      },
      () => {
        if (content !== null) content.hidden = contentHidden ?? false
      },
      () => {
        if (drawing !== null) drawing.hidden = drawingHidden ?? false
      }
    )
  }
  for (let at = FIRST_VISIBLE_RUNS; at < runs.length; at += RUN_BATCH) {
    stages.push(() => {
      for (let one = at; one < Math.min(at + RUN_BATCH, runs.length); one += 1) {
        const run = runs[one]
        if (run !== undefined) run.hidden = runHidden[one] ?? false
      }
    })
  }
  if (list !== null) {
    stages.push(() => {
      list.hidden = listWasHidden ?? false
      if (!list.hidden) void list.offsetHeight
    })
  }
  listSections.forEach((section, at) => {
    stages.push(() => {
      section.hidden = listHidden[at] ?? false
      // Pay for this one section inside its own scheduled task. If style work is
      // left pending, Chromium combines it with GitHub's next animation frame
      // and the two small jobs become one dropped frame on a history return.
      const measured = section.firstElementChild
      if (!section.hidden)
        void (measured instanceof HTMLElement ? measured : section).offsetHeight
    })
  })

  let started = false
  let cancelled = false
  const advance = (): void => {
    if (cancelled) return
    stages.shift()?.()
    if (stages.length > 0) schedule(advance)
  }

  const restore = (): void => {
    if (panel !== null) {
      panel.style.contentVisibility = panelVisibility
      panel.style.containIntrinsicSize = panelSize
    }
    if (tree !== null) tree.hidden = treeHidden ?? false
    if (content !== null) content.hidden = contentHidden ?? false
    if (drawing !== null) drawing.hidden = drawingHidden ?? false
    runs.forEach((run, at) => {
      run.hidden = runHidden[at] ?? false
    })
    if (list !== null) list.hidden = listWasHidden ?? false
    listSections.forEach((section, at) => {
      section.hidden = listHidden[at] ?? false
    })
  }

  return {
    start: () => {
      if (started || cancelled) return
      started = true
      schedule(advance)
    },
    cancel: () => {
      if (cancelled) return
      cancelled = true
      restore()
    }
  }
}
