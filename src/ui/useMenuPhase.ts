import { useEffect, useState } from "react"
import { millisOf } from "./motion"

/** How long a close takes if the stylesheet has not been read yet. */
const CLOSING = 150

/**
 * Where a menu is in opening and shutting.
 *
 * One piece of state rather than a pair that can disagree for a frame, which is the shape
 * the filter chips arrived at the hard way. A transition needs the element to have been
 * painted in the state it is travelling from, and both halves of that were wrong when this
 * was two booleans: on the way in the menu appeared with `is-open` already on it, so its
 * first painted style was the finished one and there was nothing to move from; on the way
 * out it left the page one commit before the timer said it was leaving, and came back as a
 * new element already faded away. Both jumped.
 *
 * So `arriving` is one frame of the resting state, `here` is the class that moves it, and
 * `leaving` outlives the caller's own idea of being open — unless the close came from a key, in
 * which case there is no leaving at all: see `atOnce`.
 */
export type Phase = "shut" | "arriving" | "here" | "leaving"

export const useMenuPhase = (open: boolean, atOnce = false): Phase => {
  const [phase, setPhase] = useState<Phase>("shut")

  useEffect(() => {
    if (open) {
      if (phase === "here" || phase === "arriving") return
      setPhase("arriving")
      return
    }

    if (phase === "shut" || phase === "leaving") return
    /*
     * A dismissal by key skips the leaving altogether.
     *
     * The 150ms the pointer path spends going is the menu getting out of the way of a hand that
     * is already travelling elsewhere. A reader who pressed Escape has said they are done, and
     * anything still on the screen after that is the interface arguing.
     */
    setPhase(atOnce ? "shut" : "leaving")
  }, [open, phase, atOnce])

  useEffect(() => {
    if (phase === "arriving") {
      const frame = requestAnimationFrame(() => setPhase("here"))
      return () => cancelAnimationFrame(frame)
    }

    if (phase === "leaving") {
      const timer = setTimeout(() => setPhase("shut"), millisOf("--menu-close-dur", CLOSING))
      return () => clearTimeout(timer)
    }

    return
  }, [phase])

  return phase
}
