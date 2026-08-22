/** Runs cleanup outside an input or navigation task. */
export const runWhenIdle = (act: () => void, timeout = 1_000): void => {
  const view = typeof document === "undefined" ? null : document.defaultView
  const later = view?.requestIdleCallback ?? globalThis.requestIdleCallback
  if (later === undefined) {
    setTimeout(act, 0)
    return
  }

  later.call(view, () => act(), { timeout })
}
