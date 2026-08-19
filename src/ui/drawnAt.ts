import { useEffect, useRef } from "react"
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
 * `null` is the whole of the "not" side: a screen that is loading, or showing a page
 * for somewhere else, passes it and the mark stays off.
 *
 * A screen that never calls this never claims an address. That silence is read as
 * "no answer" rather than as "never arrived" — see `theScreenIsNotElsewhere` — so a
 * screen nobody has wired yet costs a pause in reading ahead and never a reload.
 *
 * What this cannot see is whether its own tree is the one on the page: it renders
 * into a detached container, before the takeover settles, and it stays mounted after
 * a press is abandoned. `theScreenArrived` covers that today by asking the kind as
 * well, which is a document-wide mark only the screen in the slot sets. That cover
 * runs out the day two screens of one kind can be mounted for different addresses,
 * and the answer then is `oursToDraw` plus `whenOursToDrawChanges`, not a wider claim
 * here.
 */
export const useDrawnAt = (path: string | null, target: Document = document): void => {
  /*
   * One token per mounted screen, so the mark can only be withdrawn by whoever put
   * it up. Two screens stand for one address whenever a place ends up with two
   * containers, and comparing the path alone lets the stray one take down the
   * survivor's mark as it goes.
   */
  const mine = useRef<symbol>(undefined)
  mine.current ??= Symbol("drawn at")

  useEffect(() => {
    const owner = mine.current
    if (path === null || owner === undefined) return

    theScreenIsAt(target, path, owner)
    return () => theScreenLeft(target, owner)
  }, [path, target])
}
