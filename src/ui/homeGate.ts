export const HOME_READY = "data-gitquiet-home"

/** Keeps the home flash gate in sync without a body-wide CSS ancestry check. */
export const watchHomeGate = (target: Document): (() => void) => {
  let marked: HTMLElement | null = null
  const update = () => {
    const body = target.body
    if (marked !== body) {
      marked?.removeAttribute(HOME_READY)
      marked = body
    }
    if (body === null) return
    const dashboard = target.getElementById("dashboard")
    const ready = dashboard !== null && dashboard !== body && dashboard.classList.contains("dashboard") && body.contains(dashboard)
    if (body.hasAttribute(HOME_READY) !== ready) body.toggleAttribute(HOME_READY, ready)
  }
  const observer = new MutationObserver(update)
  observer.observe(target.documentElement, {
    childList: true, subtree: true, attributes: true, attributeFilter: ["id", "class"]
  })
  update()
  return () => {
    observer.disconnect()
    marked?.removeAttribute(HOME_READY)
    marked = null
  }
}
