import { MeshGradient, StaticMeshGradient } from "@paper-design/shaders-react"
import type { CSSProperties } from "react"
import { useEffect, useState } from "react"
import { BED_IN_CSS, BED_MOTION, BED_SHADER } from "@/ui/bed"

/**
 * Dark-glass poster field for the marketing site.
 *
 * The shared Wafer bed — muted teal/sand stops at Luminar poster proportions.
 * Not pink mesh, not cobalt CTA blue, not grayscale. Shader grain + soft teal
 * shade only; no extra SVG noise or charcoal base that would crush chroma.
 */

const useCalm = (): boolean => {
  const [calm, setCalm] = useState(() =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )

  useEffect(() => {
    const ask = window.matchMedia("(prefers-reduced-motion: reduce)")
    const heard = (event: MediaQueryListEvent) => setCalm(event.matches)
    ask.addEventListener("change", heard)
    return () => ask.removeEventListener("change", heard)
  }, [])

  return calm
}

/** Absolute fill; parent must be `relative overflow-hidden`. */
export const Atmosphere = ({
  alive = true,
  shade = "headline-left"
}: {
  readonly alive?: boolean
  readonly shade?: "headline-left" | "none"
}) => {
  const calm = useCalm()
  const canvas: CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%"
  }

  return (
    <>
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: BED_IN_CSS }}
      />
      <div aria-hidden className="absolute inset-0">
        {alive && !calm ? (
          <MeshGradient {...BED_MOTION} scale={1.15} fit="cover" style={canvas} />
        ) : (
          <StaticMeshGradient {...BED_SHADER} scale={1.15} fit="cover" style={canvas} />
        )}
      </div>
      {shade === "headline-left" ? (
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 95% at 14% 100%, rgba(26, 36, 38, 0.26) 0%, transparent 68%)"
          }}
        />
      ) : null}
    </>
  )
}
