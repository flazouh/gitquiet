import { useEffect, useRef } from "react"
import { markScreenRoute, theScreenIsAt, theScreenLeft } from "./mount"
import { useScreenActivity } from "./screenActivity"

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

    markScreenRoute(target, path)
    theScreenIsAt(target, path, owner)
    return () => theScreenLeft(target, owner)
  }, [path, target])
}

/**
 * The same claim as a component, for a screen that says it from its render.
 *
 * One component rather than the hook called in every screen, because the half
 * the screens would each get wrong on their own is activity: a screen kept as a
 * live history entry stays mounted off the page, and a mark it went on
 * publishing would claim the page for a screen that is not on it.
 * `useScreenActivity` is the answer the provider around every screen already
 * carries — false for a detached live entry, false again for a route rendered
 * quietly off the page — so the claim is only ever made from the tree that has
 * the page.
 *
 * What a screen passes as `path` is the exact pathname it stands for, straight
 * from the address its entry parsed and never rebuilt from the data. The
 * comparison this feeds is equality against the pathname a press pushed, and
 * the wrong answer loads a document: a reconstruction that dropped so much as a
 * trailing slash would turn a working press into a reload. For the same reason
 * a screen whose entry keeps it up across an address change must not pass a
 * path that can go stale on such a move — a stale claim under a fresh address
 * is exactly the wrong-page signal the repair acts on.
 *
 * A failure screen passes its path too. It is an answer for the address — the
 * sentence that says why, and the way to GitHub's own page — and a repair that
 * loaded the document over it would take both away.
 */
export const DrawnAt = ({ path }: { readonly path: string | null }) => {
  const active = useScreenActivity()
  useDrawnAt(active ? path : null)
  return null
}
