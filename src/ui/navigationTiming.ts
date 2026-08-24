/** The start of the latest extension-owned route change, from the input task. */
export const NAVIGATION_STARTED = "data-gitquiet-navigation-started"

/** The last measured input-to-screen duration, in milliseconds. */
export const NAVIGATION_DURATION = "data-gitquiet-navigation-duration"

/** The exact route shown by the last completed measurement. */
export const NAVIGATION_ROUTE = "data-gitquiet-navigation-measured-route"

/** Exact trace boundaries for extension-owned input-to-screen work. */
export const NAVIGATION_START_MARK = "gitquiet:navigation-start"
export const NAVIGATION_END_MARK = "gitquiet:navigation-end"

/** The browser announces a traversal just after the button that started it. */
const SAME_TRAVERSAL_MS = 100

const READING = "[data-gitquiet-loading]"

/** Do not retain a screen that never finishes its read. */
const READING_LIMIT_MS = 20_000

/** The one unread screen a document is still waiting to measure. */
const readingWait = new WeakMap<Document, () => void>()

const cancelReadingWait = (target: Document): void => {
  readingWait.get(target)?.()
  readingWait.delete(target)
}

/** Starts one extension-owned route measurement at the input handler. */
export const beginNavigation = (target: Window): void => {
  const document = target.document
  const performance = target.performance
  if (document?.documentElement === undefined || performance?.now === undefined) return

  cancelReadingWait(document)
  performance.clearMarks?.(NAVIGATION_START_MARK)
  performance.clearMarks?.(NAVIGATION_END_MARK)
  performance.mark?.(NAVIGATION_START_MARK)
  document.documentElement.setAttribute(NAVIGATION_STARTED, performance.now().toString())
}

/** Starts a native history traversal without replacing its earlier in-page button press. */
export const beginTraversalNavigation = (target: Window): void => {
  const started = target.document?.documentElement?.getAttribute(NAVIGATION_STARTED)
  const now = target.performance?.now?.()
  if (now === undefined) return
  if (started !== null && now - Number(started) <= SAME_TRAVERSAL_MS) return

  beginNavigation(target)
}

/** Finishes the current measurement when the target screen can be read. */
export const finishNavigation = (target: Document, route: string, screen: Element): void => {
  const started = target.documentElement.getAttribute(NAVIGATION_STARTED)
  const view = target.defaultView
  if (started === null || view === null) return
  // Attachment is a mutation of the parent, not this screen. The takeover path
  // calls again after attachment, so an observer here can only retain dead work.
  if (!screen.isConnected) return
  cancelReadingWait(target)

  const readable = (): boolean =>
    screen.isConnected && screen.querySelector(READING) === null && screen.textContent.trim() !== ""

  let observer: MutationObserver | undefined
  let deadline: number | undefined
  const stop = (): void => {
    observer?.disconnect()
    observer = undefined
    if (deadline !== undefined) view.clearTimeout(deadline)
    deadline = undefined
    if (readingWait.get(target) === stop) readingWait.delete(target)
  }
  const publish = (): void => {
    if (target.documentElement.getAttribute(NAVIGATION_STARTED) !== started) {
      stop()
      return
    }
    if (!readable()) return

    target.documentElement.setAttribute(
      NAVIGATION_DURATION,
      (view.performance.now() - Number(started)).toString()
    )
    target.documentElement.setAttribute(NAVIGATION_ROUTE, route)
    target.documentElement.removeAttribute(NAVIGATION_STARTED)
    view.performance.mark?.(NAVIGATION_END_MARK)
    stop()
  }

  publish()
  if (readable()) return

  observer = new view.MutationObserver(publish)
  observer.observe(screen, { childList: true, subtree: true })
  deadline = view.setTimeout(() => {
    if (target.documentElement.getAttribute(NAVIGATION_STARTED) === started)
      target.documentElement.removeAttribute(NAVIGATION_STARTED)
    stop()
  }, READING_LIMIT_MS)
  readingWait.set(target, stop)
}
