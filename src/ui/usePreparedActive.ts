import { useEffect, useState } from "react"
import { whenTheScreenMoves } from "./mount"

/** Whether a detached route root now owns the page. */
export const usePreparedActive = (root: Element | undefined): boolean => {
  const [active, setActive] = useState(root === undefined || root.isConnected)

  useEffect(() => {
    if (root === undefined) return

    const check = (): void => {
      if (root.isConnected) setActive(true)
    }
    check()
    return whenTheScreenMoves(document, check)
  }, [root])

  return active
}
