import { useCallback, useEffect, useRef, useState } from "react"

/** The rows of a list to draw, and the height of what was left out. */
export type Slice = {
  readonly from: number
  /** One past the last row drawn, as a slice takes it. */
  readonly to: number
  /** Pixels standing in for the rows above, so the scrollbar tells the truth. */
  readonly above: number
  /** Pixels standing in for the rows below. */
  readonly below: number
}

export type Measured = {
  /** One row's height in pixels. Zero until something has measured one. */
  readonly row: number
  /** The visible height of the list in pixels. Zero until it has been laid out. */
  readonly height: number
  /** How far down the list is scrolled. */
  readonly top: number
  /** How many rows to draw beyond each edge, so a flick does not show a gap. */
  readonly spare?: number
}

/**
 * Which rows of a list are worth putting in the document.
 *
 * A tree with four folders open is a few thousand rows, and every one of them is
 * a grid, two icons, a link and three spans. The reader sees twenty. So the rest
 * are two empty divs of the right height, which keeps the scrollbar and the wheel
 * exactly where they would have been.
 *
 * The whole list where nothing has been measured, which is the state before the
 * first layout and in any test without one. Drawing a short list because it could
 * not measure itself is how rows go missing; drawing all of them is merely the
 * cost this exists to avoid, paid for one frame.
 */
export const sliceOf = (many: number, { row, height, top, spare = 6 }: Measured): Slice => {
  if (many <= 0) return { from: 0, to: 0, above: 0, below: 0 }
  if (row <= 0 || height <= 0) return { from: 0, to: many, above: 0, below: 0 }

  const last = Math.min(many, Math.ceil((top + height) / row) + spare)
  const to = Math.max(last, 1)
  /*
   * Counted back from the end rather than forward from the scroll, so a list
   * that shrank under the reader — a folder closing — still draws rows. A `from`
   * past `to` would be an empty list over a scrollbar with somewhere to be.
   */
  const first = Math.min(Math.max(0, Math.floor(top / row) - spare), Math.max(0, to - 1))

  return {
    from: first,
    to,
    above: first * row,
    below: (many - to) * row
  }
}

/** The attribute a row wears, so one of them can be measured. */
const ROW = "[data-path]"

/**
 * A scrolling list that draws the rows in front of the reader and no others.
 *
 * Everything is measured rather than declared. One row's height comes from a row
 * that is already on the screen, which is the only figure that survives a change
 * of font size, a zoom, or a class edit in this file — a constant here would go
 * quietly wrong on the first of those. Until a row exists to measure, the whole
 * list is drawn, so the measuring never depends on the measurement.
 *
 * The scroll is read once a frame at most. `scroll` fires far faster than a list
 * is worth redrawing, and redrawing on every event is how a wheel turns to jank.
 */
export const useSlice = (many: number) => {
  const frame = useRef<HTMLDivElement | null>(null)
  const waiting = useRef(0)
  const [seen, setSeen] = useState<Measured>({ row: 0, height: 0, top: 0 })

  const measure = useCallback(() => {
    const element = frame.current
    if (element === null) return

    const row = element.querySelector<HTMLElement>(ROW)?.getBoundingClientRect().height ?? 0
    const height = element.clientHeight
    const top = element.scrollTop

    // The same three numbers are the ordinary answer: a scroll inside one row's
    // height changes nothing this draws, and setting state for it would redraw
    // the list for no reason.
    setSeen((was) =>
      was.row === row && was.height === height && was.top === top ? was : { row, height, top }
    )
  }, [])

  useEffect(() => {
    measure()
  }, [measure, many])

  useEffect(() => {
    const element = frame.current
    if (element === null || typeof ResizeObserver === "undefined") return

    const watching = new ResizeObserver(() => measure())
    watching.observe(element)
    return () => watching.disconnect()
  }, [measure])

  useEffect(
    () => () => {
      if (waiting.current !== 0) window.cancelAnimationFrame(waiting.current)
    },
    []
  )

  const onScroll = useCallback(() => {
    if (waiting.current !== 0) return
    waiting.current = window.requestAnimationFrame(() => {
      waiting.current = 0
      measure()
    })
  }, [measure])

  return { frame, slice: sliceOf(many, seen), onScroll }
}
