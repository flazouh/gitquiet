import { useEffect, useMemo, useRef } from "react"
import { updated } from "./Toasts"

/**
 * Says when a background read replaced content the reader already knew.
 *
 * The read itself stays silent. Its answer matters only when it changes the finished content
 * that was already on screen. Decoded GitHub values are plain data with stable field order, so
 * their JSON form is the smallest shared comparison that works across every screen's value.
 */
export const useUpdated = (catchingUp: boolean, content: unknown, said: string): void => {
  const snapshot = useMemo(
    () => (content === undefined ? undefined : JSON.stringify(content)),
    [content]
  )
  const checking = useRef(false)
  const before = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (catchingUp) {
      if (!checking.current) before.current = snapshot
      checking.current = true
      return
    }

    if (!checking.current) return
    checking.current = false

    const known = before.current
    before.current = undefined
    if (known !== undefined && snapshot !== undefined && known !== snapshot) updated(said)
  }, [catchingUp, said, snapshot])
}
