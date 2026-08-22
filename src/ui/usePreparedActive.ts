import { useEffect, useState } from "react"
import { SCREEN_ACTIVITY, whenTheScreenMoves } from "./mount"

/** Whether a detached route root now owns the page. */
export const usePreparedActive = (root: Element | undefined): boolean => {
  const [active, setActive] = useState(root === undefined || root.isConnected)

  useEffect(() => {
    if (root === undefined) return

    const check = (): void => {
      setActive(root.isConnected)
    }
    const activity = new MutationObserver(check)
    activity.observe(root, { attributes: true, attributeFilter: [SCREEN_ACTIVITY] })
    check()
    const stop = whenTheScreenMoves(document, check)
    return () => {
      activity.disconnect()
      stop()
    }
  }, [root])

  return active
}
