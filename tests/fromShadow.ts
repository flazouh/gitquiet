/**
 * A press inside a shadow root, delivered the way a browser delivers it to the document.
 *
 * Every screen of ours stands in a shadow root, and a listener on the document hears a
 * press in there as a press on the host: `event.target` is the host, and only the
 * composed path still names what was pressed. This test environment does not retarget
 * across the boundary, so a listener that asks the target passes here and fails on
 * GitHub. The retargeting is done here instead: the event goes to the host, carrying
 * the path the browser would have given it.
 */
export const pressFromShadow = (on: Element, type: "mousedown" | "pointerdown"): void => {
  const path: Array<EventTarget> = []
  let host: Element | undefined
  for (let at: Node | null = on; at !== null; ) {
    path.push(at)
    if (at instanceof ShadowRoot) host ??= at.host
    at = at instanceof ShadowRoot ? at.host : at.parentNode
  }
  path.push(window)
  if (host === undefined) throw new Error("Not inside a shadow root")

  const press =
    type === "pointerdown"
      ? new PointerEvent(type, { bubbles: true, composed: true })
      : new MouseEvent(type, { bubbles: true, composed: true })
  Object.defineProperty(press, "composedPath", { value: () => path })
  host.dispatchEvent(press)
}

/** A stage inside a shadow root, the way every screen of ours stands on GitHub. */
export const shadowStage = (): { readonly stage: HTMLElement; readonly remove: () => void } => {
  const host = document.createElement("div")
  document.body.append(host)
  const stage = document.createElement("div")
  host.attachShadow({ mode: "open" }).append(stage)
  return { stage, remove: () => host.remove() }
}
