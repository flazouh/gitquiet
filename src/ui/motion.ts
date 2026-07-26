import { useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"

const durationOf = (name: string, fallback: number): number => {
  const declared = getComputedStyle(document.documentElement).getPropertyValue(name)
  const parsed = Number.parseFloat(declared)
  return Number.isNaN(parsed) ? fallback : parsed
}

/** Long enough for a frame in any window that is drawing them at all. */
const FRAME_BUDGET = 120

/**
 * True once the entrance may play: the element paints in its starting state,
 * then this flips and the transition carries it to rest. Setting it during the
 * first paint would simply show the finished state.
 *
 * The frame callback is what makes that ordering exact, and the timer is what
 * makes it safe. A window that is occluded — visible to the page, but drawing
 * no frames — can leave a frame request pending for seconds, and everything
 * waiting on this starts at zero opacity. Missing an animation nobody is
 * watching costs nothing; showing them a blank pull request costs everything.
 */
export const useRevealed = (): boolean => {
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const reveal = () => setRevealed(true)
    const frame = requestAnimationFrame(reveal)
    const backstop = setTimeout(reveal, FRAME_BUDGET)

    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(backstop)
    }
  }, [])

  return revealed
}

/**
 * Replaces text in place: the old words leave upward and the new ones arrive
 * from below. The value React renders lags the value it is given for exactly as
 * long as the exit takes, which is what leaves something to animate out.
 *
 * transitions.dev's own orchestration writes `textContent` directly. Here React
 * owns the text, so the write is a state change flushed synchronously — the new
 * words have to be in the DOM before the reflow that arms the entrance.
 */
export const useTextSwap = (value: string): {
  readonly ref: React.RefObject<HTMLSpanElement | null>
  readonly shown: string
} => {
  const ref = useRef<HTMLSpanElement>(null)
  const [shown, setShown] = useState(value)

  useEffect(() => {
    const element = ref.current
    if (element === null || shown === value) return

    const timer = setTimeout(
      () => {
        flushSync(() => setShown(value))
        element.classList.remove("is-exit")
        element.classList.add("is-enter-start")
        void element.offsetHeight
        element.classList.remove("is-enter-start")
      },
      durationOf("--text-swap-dur", 150)
    )

    element.classList.add("is-exit")

    return () => {
      clearTimeout(timer)
      element.classList.remove("is-exit", "is-enter-start")
    }
  }, [value, shown])

  return { ref, shown }
}
