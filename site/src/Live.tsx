import { useEffect, useRef, useState } from "react"
import { SETTINGS } from "@/ui/keeping"
import { Supplied } from "../../shots/Supplied"
import type { View } from "../../shots/view"
import { SCREEN_EDGE, SCREEN_SHADOW } from "./brand"
import type { Focus } from "./features"

const LIGHT = { [SETTINGS]: { theme: { appearance: "light", pack: "gitquiet" } } }

/**
 * The narrowest the extension is drawn at before it is scaled down instead.
 *
 * Below this its own layout starts dropping columns and clipping the right-hand side
 * of a row, which reads as a broken screen rather than a small one. Scaling a wider
 * draw down keeps every column where a reader expects it.
 */
const FLOOR = 760

/**
 * On a phone the wide crop is scaled so far that the words go to grey, so the crop
 * itself narrows and the letters stay close to their own size.
 */
const TIGHT = { width: 430, height: 470 } as const

/** The same for the screen the page opens with, which has more height to give. */
const TALL = { width: 430, height: 620 } as const

const NARROW = 560

const useNear = (host: HTMLElement | null, eager: boolean): boolean => {
  const [near, setNear] = useState(eager)

  const already = useRef(eager)

  useEffect(() => {
    if (host === null || already.current) return

    const watch = new IntersectionObserver(
      (entries) => {
        if (!entries.some((one) => one.isIntersecting)) return
        already.current = true
        setNear(true)
        watch.disconnect()
      },
      { rootMargin: "800px 0px" }
    )

    watch.observe(host)
    return () => watch.disconnect()
  }, [host])

  return near
}

/** How much width the page is giving this screen, measured rather than guessed. */
const useRoom = (holder: HTMLElement | null): number | undefined => {
  const [room, setRoom] = useState<number | undefined>(undefined)

  useEffect(() => {
    if (holder === null) return

    const watch = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (width !== undefined && width > 0) setRoom(width)
    })

    watch.observe(holder)
    return () => watch.disconnect()
  }, [holder])

  return room
}

export const Live = ({
  view,
  eager = false,
  focus,
  tight
}: {
  readonly view: View

  readonly eager?: boolean

  readonly focus?: Focus

  /** What a phone shows instead of the narrow part of the same screen. */
  readonly tight?: Focus
}) => {
  const [holder, setHolder] = useState<HTMLElement | null>(null)
  const [host, setHost] = useState<HTMLElement | null>(null)
  const near = useNear(host, eager)
  const room = useRoom(holder)

  const cramped = room !== undefined && room < NARROW

  /*
   * What the extension is drawn at, before anything is cut out of it or scaled.
   *
   * The extension answers the page's own width, not this frame's, so on a phone every
   * screen falls into its stacked form and the pane that stood on the right now stands
   * a thousand pixels lower. A crop that reaches that far needs the draw to be that
   * tall, since the frame paints nothing past its own height.
   */
  const paint =
    focus === undefined
      ? { width: Math.max(room ?? FLOOR, FLOOR), height: view.height }
      : {
          width: view.width,
          height: Math.max(view.height, tight === undefined ? 0 : tight.y + tight.height)
        }

  /* The part of that draw a reader sees. */
  const shown =
    focus === undefined
      ? cramped
        ? { x: 0, y: 0, ...TALL }
        : { x: 0, y: 0, ...paint }
      : cramped
        ? (tight ?? { x: focus.x, y: focus.y, width: TIGHT.width, height: TIGHT.height })
        : focus

  const scale = room === undefined ? 1 : Math.min(1, room / shown.width)

  return (
    <div ref={setHolder} style={{ width: "100%" }}>
      <div
        className="overflow-hidden rounded-xl border"
        style={{
          position: "relative",

          /*
           * Until the room is measured the frame asks for no width of its own. A frame
           * that opens at the crop's width makes its column that wide, and a flex or
           * grid item that wide never shrinks back, which is a page a phone scrolls
           * sideways.
           */
          width: room === undefined ? "100%" : shown.width * scale,
          height: room === undefined ? undefined : shown.height * scale,
          aspectRatio: room === undefined ? `${shown.width} / ${shown.height}` : undefined,
          maxWidth: "100%",

          borderColor: SCREEN_EDGE,
          boxShadow: SCREEN_SHADOW,
          background: "var(--color-canvas)"
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: shown.width,
            height: shown.height,
            overflow: "hidden",
            transform: scale === 1 ? undefined : `scale(${scale})`,
            transformOrigin: "top left"
          }}
        >
          <div
            ref={setHost}

            data-gitquiet-outside

            data-live={view.name}
            style={{
              background: "var(--color-canvas)",

              position: "absolute",
              left: -shown.x,
              top: -shown.y,
              width: paint.width,
              height: paint.height,

              contain: "paint",

              overflow: "hidden",
              isolation: "isolate"
            }}
          >
            {host === null || !near ? null : (
              <Supplied chosen={{ ...view.chosen, ...LIGHT }} element={host}>
                <div data-screen className="live-in">
                  {view.draw()}
                </div>
              </Supplied>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
