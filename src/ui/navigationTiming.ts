/** The start of the latest extension-owned route change, from the input task. */
export const NAVIGATION_STARTED = "data-gitquiet-navigation-started"

/** The last measured input-to-screen duration, in milliseconds. */
export const NAVIGATION_DURATION = "data-gitquiet-navigation-duration"

/** The exact route shown by the last completed measurement. */
export const NAVIGATION_ROUTE = "data-gitquiet-navigation-measured-route"

/** The browser announces a traversal just after the button that started it. */
const SAME_TRAVERSAL_MS = 100

const READING = "[data-gitquiet-loading]"

/** Do not retain a screen that never finishes its read. */
const READING_LIMIT_MS = 20_000

/** Starts one extension-owned route measurement at the input handler. */
export const beginNavigation = (target: Window): void => {
  const document = target.document
  const performance = target.performance
  if (document?.documentElement === undefined || performance?.now === undefined) return

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

  const readable = (): boolean =>
    screen.isConnected && screen.querySelector(READING) === null && screen.textContent.trim() !== ""

  let observer: MutationObserver | undefined
  let deadline: number | undefined
  const stop = (): void => {
    observer?.disconnect()
    observer = undefined
    if (deadline !== undefined) view.clearTimeout(deadline)
    deadline = undefined
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
    stop()
  }

  publish()
  if (readable()) return

  observer = new view.MutationObserver(publish)
  observer.observe(screen, { childList: true, subtree: true })
  deadline = view.setTimeout(stop, READING_LIMIT_MS)
}
