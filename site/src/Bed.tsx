import { MeshGradient, StaticMeshGradient } from "@paper-design/shaders-react"
import type { CSSProperties, ReactNode } from "react"
import { useEffect, useState } from "react"
import { BED_MOTION, BED_SHADER } from "@/ui/bed"
import { STORE_BED_SHADER } from "./brand"

/* Read at the first render rather than in the effect: read afterwards, a reader who
   asked for less motion gets one frame of the animated shader and a canvas swap. */
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

export const Bed = ({
  children,
  rotation = 0,
  scale = 1,
  saturated = false,
  alive = false,
  className,
  style
}: {
  readonly children?: ReactNode

  readonly rotation?: number
  readonly scale?: number

  readonly saturated?: boolean

  readonly alive?: boolean
  readonly className?: string
  readonly style?: CSSProperties
}) => {
  const calm = useCalm()
  const canvas: CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%"
  }

  return (
    <div className={className} style={{ position: "relative", overflow: "hidden", ...style }}>
      {alive && !calm ? (
        <MeshGradient {...BED_MOTION} rotation={rotation} scale={scale} fit="cover" style={canvas} />
      ) : (
        <StaticMeshGradient
          {...(saturated ? STORE_BED_SHADER : BED_SHADER)}
          rotation={rotation}
          scale={scale}
          fit="cover"
          style={canvas}
        />
      )}

      <div style={{ position: "relative", height: "100%" }}>{children}</div>
    </div>
  )
}
