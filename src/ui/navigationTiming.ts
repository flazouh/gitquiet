/** The start of the latest extension-owned route change, from the input task. */
export const NAVIGATION_STARTED = "data-gitquiet-navigation-started"

/** The last measured input-to-screen duration, in milliseconds. */
export const NAVIGATION_DURATION = "data-gitquiet-navigation-duration"

/** The exact route shown by the last completed measurement. */
export const NAVIGATION_ROUTE = "data-gitquiet-navigation-measured-route"

/** Starts one extension-owned route measurement at the input handler. */
export const beginNavigation = (target: Window): void => {
  const document = target.document
  const performance = target.performance
  if (document?.documentElement === undefined || performance?.now === undefined) return

  document.documentElement.setAttribute(NAVIGATION_STARTED, performance.now().toString())
}

/** Finishes the current measurement when the target tree enters the document. */
export const finishNavigation = (target: Document, route: string): void => {
  const started = target.documentElement.getAttribute(NAVIGATION_STARTED)
  const view = target.defaultView
  if (started === null || view === null) return

  target.documentElement.setAttribute(
    NAVIGATION_DURATION,
    (view.performance.now() - Number(started)).toString()
  )
  target.documentElement.setAttribute(NAVIGATION_ROUTE, route)
  target.documentElement.removeAttribute(NAVIGATION_STARTED)
}
