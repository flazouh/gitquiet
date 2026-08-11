import { useEffect, useState } from "react"
import { whenAnotherBarStands } from "./barSlot"
import { oursToDraw, whenTheScreenMoves } from "./mount"

/**
 * Whether this screen is the one whose bar the page should be showing.
 *
 * The rule and the reason for it are in {@link oursToDraw}; this is the same question asked in a
 * way React can re-ask. Watched rather than read once, because the answer turns true the moment
 * the screen takes the page over — several hundred milliseconds after its tree first rendered.
 */
export const useOursToDraw = (): boolean => {
  const [mine, setMine] = useState(() => oursToDraw(document))

  useEffect(
    () =>
      whenTheScreenMoves(document, () => {
        if (oursToDraw(document)) {
          setMine(true)
          return
        }

        /*
         * The page belongs to another screen now, and its bar is a render away — eighty
         * milliseconds, measured. Stopping here would take the bar off the page for the
         * whole of that, and a bar that goes is not a smaller bar: the page moves up by
         * its height and back down, in the middle of a press.
         *
         * Asked again on the way out because the answer can turn back: a reader who
         * presses a run and comes back before it arrives is on this screen still.
         */
        whenAnotherBarStands(document, () => setMine(oursToDraw(document)))
      }),
    []
  )

  return mine
}
