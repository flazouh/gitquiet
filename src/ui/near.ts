import { useCallback, useEffect, useRef } from "react"

export type Point = { readonly x: number; readonly y: number }

export type Box = {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

/**
 * How far a point is from a box, in pixels, and zero inside it.
 *
 * The straight-line distance rather than the distance along either axis, so a
 * pointer arriving diagonally is treated the same as one arriving level with
 * the row — which is what "near" means to the person moving the mouse.
 */
export const gapTo = (box: Box, point: Point): number => {
  const across = Math.max(box.left - point.x, 0, point.x - box.right)
  const down = Math.max(box.top - point.y, 0, point.y - box.bottom)
  return Math.hypot(across, down)
}

/** The keys whose boxes the pointer has come within `within` pixels of. */
export const withinReach = <Key>(
  boxes: Iterable<readonly [Key, Box]>,
  point: Point,
  within: number
): ReadonlyArray<Key> => {
  const reached: Array<Key> = []
  for (const [key, box] of boxes) if (gapTo(box, point) <= within) reached.push(key)
  return reached
}

/** The attribute a child wears to say it is worth warming. */
export const NEAR = "data-near"

export type NearbyOptions<Key extends string> = {
  /** Called once per key, the first time the pointer comes close to it. */
  readonly onNear: (key: Key) => void
  /** How close counts. Roughly a row's height, so it fires about a move early. */
  readonly within?: number
  /** Off entirely when false, for when there is nothing to warm. */
  readonly enabled?: boolean
}

/**
 * Warms what the pointer is heading for, before it gets there.
 *
 * A click is the end of a movement that started a few hundred milliseconds
 * earlier, and that gap is long enough to have fetched what the click is going
 * to ask for. So: watch the pointer, and when it comes within reach of a child
 * marked `data-near`, say so once.
 *
 * The measuring is deliberately lazy. Nothing is read from the layout until the
 * pointer is near the container itself, and each key is announced once, so a
 * mouse resting over a list of forty rows costs one rect per frame rather than
 * forty — and a mouse elsewhere on the page costs nothing at all.
 */
export const useNearby = <Key extends string>({
  onNear,
  within = 80,
  enabled = true
}: NearbyOptions<Key>) => {
  const mine = useRef<HTMLElement | null>(null)
  const announced = useRef<Set<string>>(new Set())
  const latest = useRef(onNear)
  latest.current = onNear

  useEffect(() => {
    const element = mine.current
    if (!enabled || element === null || typeof window === "undefined") return

    let frame = 0
    let at: Point | undefined

    const look = () => {
      frame = 0
      const point = at
      if (point === undefined) return

      // The container first: while the pointer is elsewhere on the page this is
      // the only rect anyone reads, which is the whole point of the two steps.
      if (gapTo(element.getBoundingClientRect(), point) > within) return

      for (const child of element.querySelectorAll<HTMLElement>(`[${NEAR}]`)) {
        const key = child.getAttribute(NEAR)
        if (key === null || announced.current.has(key)) continue
        if (gapTo(child.getBoundingClientRect(), point) > within) continue

        announced.current.add(key)
        latest.current(key as Key)
      }
    }

    const moved = (event: PointerEvent) => {
      at = { x: event.clientX, y: event.clientY }
      // One measurement a frame at most: pointermove fires far faster than the
      // layout is worth reading, and reading it on every event is how a hover
      // turns into jank.
      if (frame === 0) frame = window.requestAnimationFrame(look)
    }

    window.addEventListener("pointermove", moved, { passive: true })
    return () => {
      window.removeEventListener("pointermove", moved)
      if (frame !== 0) window.cancelAnimationFrame(frame)
    }
  }, [enabled, within])

  return useCallback((element: HTMLElement | null) => {
    mine.current = element
  }, [])
}
