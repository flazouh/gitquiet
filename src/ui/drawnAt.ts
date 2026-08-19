import { useEffect } from "react"
import { theScreenIsAt, theScreenLeft } from "./mount"

/**
 * Says which address the screen has the page for, from the page rather than from
 * the press that asked for it.
 *
 * Every screen here can be standing with somebody else's contents on it. A reader
 * pressing one pull request from inside another keeps the container, the React root
 * and the screen, and only draws again — so between the press and the answer there
 * is a window, seconds long on that route, where the address is the new one and
 * everything on the screen is the old one. A caller asking "did the screen for this
 * address arrive" during that window has to be told no.
 *
 * So the address is published when the read is ready and withdrawn when it is not.
 * `null` is the whole of the "not" side: a screen that is loading, failing, or
 * showing a page for somewhere else passes it, and the mark stays off.
 *
 * A screen that never calls this never claims to have arrived. That is the safe
 * direction and the reason a partial rollout is fine: reading ahead stays quiet for
 * its full window instead of stopping early, which is the behaviour this replaced
 * being wrong in the expensive direction rather than the cheap one.
 */
export const useDrawnAt = (path: string | null): void => {
  useEffect(() => {
    if (path === null) return

    theScreenIsAt(document, path)
    return () => theScreenLeft(document, path)
  }, [path])
}
