import { MeshGradient, StaticMeshGradient } from "@paper-design/shaders-react"
import type { CSSProperties } from "react"
import { useEffect, useState } from "react"
import { BED_BEHIND, BED_IN_CSS, BED_MOTION, BED_SHADER } from "../../../src/ui/bed"

/**
 * Whether this reader has asked their machine for less movement.
 *
 * Asked rather than assumed, and asked again if they change their mind while the
 * window is open: this is the one surface in the app that moves on its own, so it is
 * the one that has to listen.
 *
 * Read at the first render rather than in the effect. Read afterwards, a reader who
 * asked for less motion got one frame of the animated shader and then a canvas swapped
 * out from under them, which is the movement they turned off.
 */
const useCalm = (): boolean => {
  const [calm, setCalm] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches)

  useEffect(() => {
    const ask = window.matchMedia("(prefers-reduced-motion: reduce)")

    const heard = (event: MediaQueryListEvent) => setCalm(event.matches)
    ask.addEventListener("change", heard)
    return () => ask.removeEventListener("change", heard)
  }, [])

  return calm
}

/**
 * The gradient from gitquiet.com, filling this window.
 *
 * The same five stops and the same shader as the page the reader downloaded this
 * from — `src/ui/bed.ts` holds the numbers both of them read — because the first
 * screen of the app and the last screen of the site are half a minute apart, and
 * they should be recognisably the same thing.
 *
 * Its own component rather than the site's, which looks like a copy and is not: the
 * page composes several beds at different rotations with content inside them, and
 * this is one bed behind a whole window. Sharing the file would mean a component with
 * four props for one caller, in a folder the extension's bundle also reaches,
 * importing WebGL. What must not differ is in `bed.ts`: the stops, the two numbers it
 * is turned by, and the CSS floor.
 */
export const Bed = ({ className }: { readonly className?: string }) => {
  const calm = useCalm()

  const canvas: CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%" }

  return (
    /*
     * The CSS bed underneath, which is what is on screen for the frame or two the
     * shader takes to compile, and for as long as ever on a machine with no WebGL.
     * Without it the app's first paint is a white rectangle.
     */
    <div className={className} style={{ background: BED_IN_CSS, overflow: "hidden" }}>
      {calm ? (
        <StaticMeshGradient {...BED_SHADER} {...BED_BEHIND} fit="cover" style={canvas} />
      ) : (
        <MeshGradient {...BED_MOTION} {...BED_BEHIND} fit="cover" style={canvas} />
      )}
    </div>
  )
}
