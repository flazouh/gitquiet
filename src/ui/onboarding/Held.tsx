import type { ReactNode } from "react"
import { useEffect, useState } from "react"

/**
 * A running screen, drawn at its own size and scaled into the room a beat leaves it.
 *
 * The geometry only. What a screen needs in order to run — the diff engine, the icons,
 * the markdown painter, a settings store — is the host's to answer, and the two hosts
 * answer it differently: the window already has all of it above this point, and the site
 * has none of it and mounts a fixture stage per screen. So this asks for the element and
 * hands it back, and the host fills it.
 *
 * Scaled rather than drawn narrow. Below about seven hundred pixels these screens start
 * dropping columns, which reads as a broken interface rather than a small one. Drawn at
 * the width the fixtures were written for and reduced, every column is where the reader
 * will find it thirty seconds from now.
 */

/** The room a beat is giving a screen, measured rather than guessed. */
type Room = { readonly width: number; readonly height: number }

const useRoom = (holder: HTMLElement | null): Room | undefined => {
  const [room, setRoom] = useState<Room | undefined>(undefined)

  useEffect(() => {
    if (holder === null) return

    const watch = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect
      if (box === undefined || box.width <= 0 || box.height <= 0) return
      setRoom({ width: box.width, height: box.height })
    })

    watch.observe(holder)
    return () => watch.disconnect()
  }, [holder])

  return room
}

/**
 * The shortest a screen is laid out at, in its own pixels, however little room it got.
 *
 * A screen told it is two hundred pixels tall is not a small screen, it is a screen with
 * its own layout collapsing inside it. Below this it is drawn taller than the room and
 * the bottom is cut off instead.
 */
const LEAST = 380

export const Held = ({
  view,
  children
}: {
  readonly view: { readonly width: number; readonly height: number }
  readonly children: (host: HTMLElement) => ReactNode
}) => {
  const [holder, setHolder] = useState<HTMLElement | null>(null)
  const [host, setHost] = useState<HTMLElement | null>(null)
  const room = useRoom(holder)

  const scale = room === undefined ? undefined : room.width / view.width

  /*
   * As tall as the room, in the screen's own pixels, rather than as tall as the fixture.
   *
   * This is the whole reason the height is measured. A screen scaled to the width it was
   * given has a height of its own, and that height is not the row's: on the site it came
   * out shorter, and the card had a band of white between the list and the sentence about
   * it. Laid out at the room's own height, the screen fills the row, and a screen with
   * more to show than fits is cut off at the bottom edge, where a reader reads it as a
   * list that continues.
   */
  const tall =
    room === undefined || scale === undefined ? view.height : Math.max(LEAST, room.height / scale)

  return (
    <div ref={setHolder} className="tour-held">
      <div
        ref={setHost}
        /* What tells the interface it is not standing on a page of GitHub's, and what the
           shared motion scale is declared on. See `motion.css`. */
        data-gitquiet-outside
        style={{
          width: view.width,
          height: tall,
          overflow: "hidden",
          transform: scale === undefined ? undefined : `scale(${scale})`,
          transformOrigin: "top left",
          /* Hidden for the one frame before the room is known, rather than drawn at the
             fixture's own 1280 and snapped down to size in front of the reader. */
          visibility: scale === undefined ? "hidden" : undefined
        }}
      >
        {host === null ? null : children(host)}
      </div>
    </div>
  )
}
