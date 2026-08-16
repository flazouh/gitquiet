import { MeshGradient, StaticMeshGradient } from "@paper-design/shaders-react"
import type { CSSProperties } from "react"
import { useEffect, useState } from "react"
import { BED_IN_CSS, BED_MOTION, BED_SHADER } from "../../../src/ui/bed"

/**
 * Whether this reader has asked their machine for less movement.
 *
 * Asked rather than assumed, and asked again if they change their mind while the
 * window is open: this is the one surface in the app that moves on its own, so it is
 * the one that has to listen.
 */
const useCalm = (): boolean => {
  const [calm, setCalm] = useState(false)

  useEffect(() => {
    const ask = window.matchMedia("(prefers-reduced-motion: reduce)")
    setCalm(ask.matches)

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
 * this is one bed behind a whole window with a CSS floor under it. Sharing the file
 * would mean a component with four props for one caller, in a folder the extension's
 * bundle also reaches, importing WebGL.
 *
 * Rotated and over-scaled deliberately. The mesh's seams run corner to corner at
 * rest, and a window is wider than it is tall, so at `scale: 1` the middle of the
 * screen — where every word on this screen is — sat in the flattest part of it.
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
        <StaticMeshGradient {...BED_SHADER} rotation={14} scale={1.45} fit="cover" style={canvas} />
      ) : (
        <MeshGradient {...BED_MOTION} rotation={14} scale={1.45} fit="cover" style={canvas} />
      )}
    </div>
  )
}
