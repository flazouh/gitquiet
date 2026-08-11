import { useEffect, useRef } from "react"
import { seenIn } from "./motion"
import { type Freshening, freshening } from "./Toasts"

/**
 * The sentence that goes with showing a memory.
 *
 * One line per screen, beside the `useLive` that reads it. Every list here draws
 * what it remembers the instant it opens and replaces it when GitHub answers,
 * which is what makes the interface feel immediate; without this, the reader has
 * no way to tell a list that is current from one that is a minute old and being
 * checked. Both look finished, and one of them is wrong.
 *
 * Held back by the same delay as the wait, and for the same reason. Most reads
 * answer in tens of milliseconds, and a toast up for that long is not a sentence
 * anybody reads — it is the top of the screen flickering. So the only reads this
 * says anything about are the ones slow enough to have been noticed anyway.
 *
 * Ended by the read landing, by the screen going away, or by the sentence
 * changing. Never by a clock: the thing it describes has an end, and a toast that
 * expires before it would leave the reader with the same question.
 *
 * Given the one bit rather than the whole read, because the screens that need it most are
 * the ones that do not have a `useLive`: a commit is read by a component that has been
 * following a sha since before this hook existed.
 *
 * The three endings are not the same ending, which is the distinction this hook exists to keep.
 * A read that landed is the one the reader cannot see for themselves — a list that was already
 * right does not change when GitHub agrees with it — so that one gets the word and the check.
 * A screen that went away and a sentence that changed get nothing, because nothing has been
 * answered, and "Up to date" about an abandoned read is a claim somebody would act on.
 */
export const useFreshening = (catchingUp: boolean, said: string): void => {
  const standing = useRef<Freshening | null>(null)
  /*
   * Whether the read is still going, readable from a cleanup.
   *
   * A cleanup closes over the value that set it up, so a cleanup written while `catchingUp` was
   * true cannot tell the flip to false from an unmount: both are "this effect is over". The ref
   * is written during render, so by the time React tears the old effect down before running the
   * new one, it already says which of the two happened.
   */
  const reading = useRef(catchingUp)
  reading.current = catchingUp

  useEffect(() => {
    if (!catchingUp) {
      standing.current?.landed()
      standing.current = null
      return
    }

    const timer = setTimeout(() => {
      standing.current = freshening(said)
    }, seenIn())

    return () => {
      clearTimeout(timer)
      if (!reading.current) return
      standing.current?.take()
      standing.current = null
    }
  }, [catchingUp, said])

  // The screen going away, which the effect above cannot answer: its own cleanup runs on every
  // change of the sentence too, and by then the read may have landed.
  useEffect(
    () => () => {
      standing.current?.take()
      standing.current = null
    },
    []
  )
}
