import { useEffect, useRef, useState } from "react"
import { millisOf, seenIn } from "./motion"

/**
 * How long the wait has to leave, read from the stylesheet that moves it.
 *
 * Asked of our own root rather than written twice: the wait is taken off the page
 * when it has finished fading, and a number here that drifted from the one in
 * `motion.css` would either cut the dissolve short or leave an invisible layer
 * sitting over what arrived. Absent in a test, where there is no stylesheet and
 * the fallback is the value that file ships.
 */
const LEAVING = 400

const leaveIn = (): number => millisOf("--wait-reveal-dur", LEAVING)

/**
 * Whether the wait is on the page.
 *
 * True from the moment a wait has lasted long enough to be worth drawing, through
 * the rest of it, and for one dissolve after it — so what GitHub sent can be drawn
 * at full strength underneath while the wait fades off the top of it. A failure
 * ends it at once: a wait fading over an explanation would read as the explanation
 * being unsure of itself.
 *
 * Shared by every screen that waits, because the timing is the same fact three
 * times and the one thing all three must not do is disagree with the stylesheet.
 *
 * Fed a read's status, which turns ready on the first stage worth reading rather
 * than on the last: the wait leaves when what is underneath becomes legible, not
 * when it is complete.
 *
 * Whoever calls this has to keep the wait in the same slot of the same wrapper
 * before and after the answer arrives. A transition needs the element to have been
 * on the page in its resting state; drawn inside something the wait was not drawn
 * inside, React throws the resting one away and mounts a second already faded out,
 * which shows the reader nothing at all.
 */
export const useWaiting = (status: "loading" | "failed" | "ready"): boolean => {
  const [waiting, setWaiting] = useState(false)
  // When it went up, for deciding afterwards whether it was up long enough to be
  // worth fading. Null while nothing has been drawn.
  const since = useRef<number | null>(null)

  // Held back rather than drawn at once. The screen renders long before the
  // reader can see it — into a container that has not been put on the page yet
  // — and on the arrival this is about, GitHub answers in the same breath as
  // the page is revealed. A wait up for that breath is a flash, so a wait that
  // ends inside it is one the reader is never shown anything for.
  useEffect(() => {
    if (status !== "loading") return

    const timer = setTimeout(() => {
      since.current = performance.now()
      setWaiting(true)
    }, seenIn())
    return () => clearTimeout(timer)
  }, [status])

  useEffect(() => {
    if (status === "loading" || !waiting) return
    if (status === "failed") {
      setWaiting(false)
      return
    }
    // A wait that went up a moment ago has nothing to dissolve: the answer landed
    // just the far side of the wait above, and fading it would put a
    // half-transparent layer over a page the reader can already read.
    if (performance.now() - (since.current ?? 0) < seenIn()) {
      setWaiting(false)
      return
    }

    const timer = setTimeout(() => setWaiting(false), leaveIn())
    return () => clearTimeout(timer)
  }, [status, waiting])

  return waiting
}
