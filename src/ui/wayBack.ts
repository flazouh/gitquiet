/**
 * The way back, for a reader who has this interface turned off.
 *
 * When the choice is GitHub's page this extension puts nothing on the screen, which
 * would also mean nothing to press to change your mind. A preference that can only be
 * undone from the browser's extension settings is a preference that traps people.
 *
 * It used to go at the end of GitHub's own pull request tab row, dressed as the tabs
 * beside it. That row is the right place on the one page that has it, and sixteen of
 * the twenty-one pages this extension draws do not: turn the interface off from the
 * dashboard, a repository's home, its issues or its Actions, and nothing was offered
 * anywhere. The only way back was to open a pull request first, which is a thing a
 * reader has to be told.
 *
 * So it is one small mark, in front of the page rather than inside it, and it is the
 * same mark on every page. Standing on top of somebody's page is the cost of that, and
 * it is why this can be moved: wherever it is put by default it will sit over something
 * that matters on somebody's screen, and the reader is the one who can see which.
 */

import { DEFAULT_SPOT, type Spot } from "@/domain/Settings"

/** The holder, which is what a caller looks for and what a test asks about. */
export const WAY_BACK_ID = "gitquiet-way-back"

/** The handle that appears on hover, and the only part of this that drags. */
export const GRIP_ID = "gitquiet-way-back-grip"

/**
 * The mark on everything of ours that stands on `body` rather than inside our root.
 *
 * Written out rather than imported from `mount.ts`, because this runs on a page where
 * nothing of ours is mounted at all and importing the mounting module to read one
 * string would pull the whole of it onto a page that has no use for it.
 */
const OUTSIDE = "data-gitquiet-outside"

/** How wide and tall the mark's own button is. */
const SIZE = 34

/** The grip, and the air between it and the mark. */
const GRIP_H = 16
const GAP = 4

/**
 * The whole widget, grip included.
 *
 * The grip is inside this box rather than floating above it, and that is the whole of
 * why the box is taller than the mark. Outside it, the pointer left the widget on its
 * way from the mark up to the grip, the grip went out of sight on that `pointerleave`,
 * and the handle could never be reached by the hand that had just been shown it.
 */
const TALL = SIZE + GRIP_H + GAP

/** How far the widget stays off the edge of the window at either end of its travel. */
const EDGE = 16

/** How far one arrow key moves it, for a reader who is not using a pointer. */
const STEP = 24

const LABEL = "Turn the gitquiet interface back on"

/**
 * The gitquiet mark, drawn here rather than imported.
 *
 * `Mark.tsx` is the one this product draws everywhere else and it is a React component.
 * There is no React on this page — this widget exists precisely because ours is not
 * running — so the geometry is written out a second time. The two are the same circle,
 * the same stem and the same dot, and a change to one is a change that has to be made
 * to both.
 */
const MARK =
  '<svg width="19" height="19" viewBox="0 0 32 32" fill="none" stroke="currentColor"' +
  ' aria-hidden="true" focusable="false">' +
  '<circle cx="15.4" cy="12.2" r="7" stroke-width="2.5"/>' +
  '<path d="M22.4 12.2 V23.4" stroke-width="2.5"/>' +
  '<circle cx="22.4" cy="25.6" r="2.5" fill="currentColor" stroke="none"/>' +
  "</svg>"

/** Six dots, which is what a thing you can pick up and move looks like everywhere else. */
const GRIP =
  '<svg width="16" height="10" viewBox="0 0 16 10" aria-hidden="true" focusable="false">' +
  '<g fill="currentColor">' +
  '<circle cx="4" cy="3.5" r="1.1"/><circle cx="8" cy="3.5" r="1.1"/>' +
  '<circle cx="12" cy="3.5" r="1.1"/>' +
  '<circle cx="4" cy="6.5" r="1.1"/><circle cx="8" cy="6.5" r="1.1"/>' +
  '<circle cx="12" cy="6.5" r="1.1"/>' +
  "</g></svg>"

/**
 * Their tokens first and a literal behind each one, so the widget is GitHub's own
 * green on GitHub's page and still a green button on a page that never loaded their
 * variables. The same reasoning the tab row control was dressed by.
 */
const REST = "var(--button-primary-bgColor-rest, #1f883d)"
const LIT = "var(--button-primary-bgColor-hover, #1a7f37)"

/**
 * How far the widget can travel on each axis, which is the window less the widget
 * itself and the margin it keeps at either end.
 *
 * Never negative: a window narrower than the widget plus its margins would otherwise
 * give a travel below zero, and a fraction of that puts the widget outside the window
 * on the side it was trying to stay inside.
 */
const travel = (view: Window): { readonly across: number; readonly down: number } => ({
  across: Math.max(0, view.innerWidth - SIZE - EDGE * 2),
  down: Math.max(0, view.innerHeight - TALL - EDGE * 2)
})

const pixelsOf = (spot: Spot, view: Window): { readonly left: number; readonly top: number } => {
  const room = travel(view)
  return { left: EDGE + spot.x * room.across, top: EDGE + spot.y * room.down }
}

const spotOf = (left: number, top: number, view: Window): Spot => {
  const room = travel(view)
  return {
    x: room.across === 0 ? 0 : Math.min(1, Math.max(0, (left - EDGE) / room.across)),
    y: room.down === 0 ? 0 : Math.min(1, Math.max(0, (top - EDGE) / room.down))
  }
}

/**
 * The whole of the holder's style, position included.
 *
 * One function and one attribute rather than a base style with the position set on top
 * of it. Two writers meant the end of a drag rewrote the attribute to say the widget
 * was no longer being held and wiped `left` and `top` on its way past, which dropped
 * the widget back into the corner of the page the moment it was let go.
 */
const holderStyle = (at: Spot, view: Window): string => {
  const where = pixelsOf(at, view)
  return [
    "position: fixed",
    "left: " + where.left + "px",
    "top: " + where.top + "px",
    // Above GitHub's own dialogs and their sticky headers, and nothing on their page
    // goes higher. It is the only thing of ours on the screen; being under something
    // would make it a control the reader can see and cannot press.
    "z-index: 2147483000",
    "display: block",
    "width: " + SIZE + "px",
    "height: " + TALL + "px",
    "margin: 0",
    "padding: 0",
    // The box is taller than the mark so that the grip is inside it, and the part of
    // it the grip is not filling is a piece of somebody's page. Nothing here catches a
    // press: the two buttons take their own back below.
    "pointer-events: none"
  ].join("; ")
}

const markStyle = (lit: boolean): string =>
  [
    "position: absolute",
    "bottom: 0",
    "left: 0",
    "pointer-events: auto",
    "display: inline-flex",
    "align-items: center",
    "justify-content: center",
    "width: " + SIZE + "px",
    "height: " + SIZE + "px",
    "padding: 0",
    "margin: 0",
    "border: 1px solid var(--button-primary-borderColor-rest, rgba(31, 35, 40, 0.15))",
    "border-radius: 50%",
    "background: " + (lit ? LIT : REST),
    "color: var(--button-primary-fgColor-rest, #ffffff)",
    "box-shadow: var(--shadow-floating-small, 0 3px 6px rgba(31, 35, 40, 0.15))",
    "cursor: pointer",
    "font: inherit",
    "appearance: none"
  ].join("; ")

const gripStyle = (shown: boolean): string =>
  [
    "position: absolute",
    // Above the mark rather than beside it. Beside it, the widget grows sideways on
    // hover, and against the right edge of the window that growth has nowhere to go.
    "top: 0",
    "left: 50%",
    "transform: translateX(-50%)",
    "display: flex",
    "align-items: center",
    "justify-content: center",
    "width: 26px",
    "height: " + GRIP_H + "px",
    "padding: 0",
    "margin: 0",
    "border: 1px solid var(--borderColor-default, rgba(31, 35, 40, 0.15))",
    "border-radius: 5px",
    "background: var(--bgColor-default, #ffffff)",
    "color: var(--fgColor-muted, #59636e)",
    "box-shadow: var(--shadow-resting-small, 0 1px 0 rgba(31, 35, 40, 0.04))",
    "cursor: grab",
    "appearance: none",
    // The element a finger actually drags. On the holder, which is where this was, it
    // declared nothing: that box takes no pointer at all, so the browser never asks it
    // what a touch there should do. Here it is the difference between moving the widget
    // and scrolling the page under it.
    "touch-action: none",
    // Kept in the tree rather than removed, so a reader who reached it with the
    // keyboard can move the widget without ever showing it, and so that the hover
    // is a fade rather than a thing appearing out of nowhere.
    "opacity: " + (shown ? "1" : "0"),
    "pointer-events: " + (shown ? "auto" : "none"),
    "transition: opacity 90ms ease-out"
  ].join("; ")

/** Where a drag started: the pointer then, and where the widget was standing then. */
type Grab = {
  readonly x: number
  readonly y: number
  readonly left: number
  readonly top: number
}

/**
 * Puts the way back on the page and keeps it there, and hands back the way to take
 * it off again.
 *
 * `spot` is where the reader left it last time and `onMoved` is told where they have
 * left it now. Neither is required: a caller with nowhere to keep a position gets the
 * default corner and a widget that moves for as long as the page lives, which is far
 * better than one that cannot be moved off whatever it is covering.
 */
export const offerOurPage = (
  target: Document,
  onChoose: () => void,
  spot: Spot = DEFAULT_SPOT,
  onMoved: (spot: Spot) => void = () => {}
): (() => void) => {
  const view = target.defaultView
  if (view === null) return () => {}

  let at = spot
  let planted: HTMLElement | null = null

  const holder = target.createElement("div")
  holder.id = WAY_BACK_ID
  holder.setAttribute(OUTSIDE, "")

  const mark = target.createElement("button")
  mark.type = "button"
  mark.innerHTML = MARK
  mark.title = LABEL
  mark.setAttribute("aria-label", LABEL)
  mark.setAttribute("style", markStyle(false))

  const grip = target.createElement("button")
  grip.id = GRIP_ID
  grip.type = "button"
  grip.innerHTML = GRIP
  grip.title = "Drag to move, or use the arrow keys"
  grip.setAttribute("aria-label", "Move this control")
  grip.setAttribute("style", gripStyle(false))

  holder.append(grip, mark)

  const place = (): void => {
    holder.setAttribute("style", holderStyle(at, view))
  }

  /*
   * Shown while the pointer is on either button, while the grip has the keyboard, and
   * for as long as a drag lasts.
   *
   * Counted over the two buttons rather than watched on the holder around them, because
   * the holder catches nothing: its box is bigger than either button and the rest of it
   * is somebody's page, which a widget that is only offering a way back has no business
   * swallowing presses from.
   *
   * The wait before it goes is the other half of that. Crossing the four pixels between
   * the mark and the grip, the pointer is on neither for a frame; hidden on that frame
   * the grip also stops taking presses, so the hand that was just shown a handle arrives
   * to find nothing there. The drag needs it too — a pointer dragged faster than the
   * widget follows leaves it behind, and a grip that vanished mid-drag would read as the
   * thing being dragged having been dropped.
   */
  const REST_AFTER = 150
  const inside = new Set<Element>()
  let held = false
  let fading: ReturnType<typeof setTimeout> | undefined

  const showGrip = (): void => {
    grip.setAttribute(
      "style",
      gripStyle(inside.size > 0 || held || target.activeElement === grip)
    )
  }

  const enter = (button: Element): void => {
    clearTimeout(fading)
    inside.add(button)
    showGrip()
  }

  const leave = (button: Element): void => {
    inside.delete(button)
    clearTimeout(fading)
    fading = setTimeout(showGrip, REST_AFTER)
  }

  for (const button of [mark, grip]) {
    button.addEventListener("pointerenter", () => enter(button))
    button.addEventListener("pointerleave", () => leave(button))
  }

  grip.addEventListener("focus", showGrip)
  grip.addEventListener("blur", showGrip)

  mark.addEventListener("pointerenter", () => {
    mark.setAttribute("style", markStyle(true))
  })
  mark.addEventListener("pointerleave", () => {
    mark.setAttribute("style", markStyle(false))
  })
  mark.addEventListener("click", (event) => {
    event.preventDefault()
    onChoose()
  })

  /*
   * The drag, in the three events it is made of.
   *
   * The grip is what drags and the mark is what presses, and they are two elements
   * rather than one for a reason a single target cannot answer: a press that moves
   * two pixels is a press, and a drag that moves two pixels is a drag, and nothing in
   * the events tells them apart until the pointer is already up. One target would
   * mean either a press that sometimes moved the widget or a move that sometimes
   * turned the interface on, and both of those are the reader being ignored.
   */
  let from: Grab | null = null

  const move = (event: PointerEvent): void => {
    if (from === null) return

    event.preventDefault()
    const room = travel(view)
    const left = Math.min(EDGE + room.across, Math.max(EDGE, from.left + (event.clientX - from.x)))
    const top = Math.min(EDGE + room.down, Math.max(EDGE, from.top + (event.clientY - from.y)))
    at = spotOf(left, top, view)
    place()
  }

  const drop = (): void => {
    if (from === null) return

    from = null
    held = false
    place()
    showGrip()
    view.removeEventListener("pointermove", move)
    view.removeEventListener("pointerup", drop)
    view.removeEventListener("pointercancel", drop)
    onMoved(at)
  }

  grip.addEventListener("pointerdown", (event) => {
    event.preventDefault()
    const where = pixelsOf(at, view)
    from = { x: event.clientX, y: event.clientY, left: where.left, top: where.top }
    held = true
    place()
    showGrip()
    view.addEventListener("pointermove", move)
    view.addEventListener("pointerup", drop)
    view.addEventListener("pointercancel", drop)
  })

  /*
   * And the same move for a reader who is not holding a pointer at all. The widget
   * covers part of somebody's page by design, so being unable to move it is being
   * unable to read the page underneath it.
   */
  const NUDGES: Readonly<Record<string, readonly [number, number]>> = {
    ArrowLeft: [-STEP, 0],
    ArrowRight: [STEP, 0],
    ArrowUp: [0, -STEP],
    ArrowDown: [0, STEP]
  }

  grip.addEventListener("keydown", (event) => {
    const nudge = NUDGES[event.key]
    if (nudge === undefined) return

    event.preventDefault()
    const room = travel(view)
    const where = pixelsOf(at, view)
    at = spotOf(
      Math.min(EDGE + room.across, Math.max(EDGE, where.left + nudge[0])),
      Math.min(EDGE + room.down, Math.max(EDGE, where.top + nudge[1])),
      view
    )
    place()
    onMoved(at)
  })

  // The corner is a corner at every window size, and the fraction is what keeps it
  // one. Nothing is stored here: a resize is not the reader moving it.
  view.addEventListener("resize", place)

  /*
   * Their page is rendered by React and replaced wholesale on a soft navigation, and
   * a turbo visit swaps `body` out from under anything standing in it. So this stands
   * on `documentElement`, which survives both, and the observer below is the answer to
   * the one that neither survives: an extension or a script that empties the document.
   *
   * It only does anything when what was planted is no longer in the tree, which is
   * both the test for "something took it away" and the reason a page churning
   * underneath this does not accumulate widgets.
   */
  const stand = (): void => {
    if (planted !== null && planted.isConnected) return

    target.documentElement.append(holder)
    planted = holder
    place()
  }

  stand()

  const watcher = new MutationObserver(stand)
  watcher.observe(target.documentElement, { childList: true, subtree: true })

  /*
   * Withdrawn more than once, and that is on purpose rather than tolerated. Two
   * callers each have their own reason to take the way back off — the press that
   * asked for the interface, and the screen about to stand where the widget was —
   * and neither can know whether the other went first.
   */
  return () => {
    clearTimeout(fading)
    watcher.disconnect()
    view.removeEventListener("resize", place)
    view.removeEventListener("pointermove", move)
    view.removeEventListener("pointerup", drop)
    view.removeEventListener("pointercancel", drop)
    holder.remove()
    planted = null
  }
}
