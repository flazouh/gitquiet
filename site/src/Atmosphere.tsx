import { MeshGradient, StaticMeshGradient } from "@paper-design/shaders-react"
import type { CSSProperties } from "react"
import { useEffect, useState } from "react"
import { BED } from "@/ui/bed"

/**
 * Dark-glass poster field for the marketing site.
 *
 * Charcoal anchors with visible muted teal/sand pools — Wafer atmosphere,
 * Luminar poster proportions. Not pink mesh, not cobalt CTA blue, not grayscale.
 */

const FIELD = "#0c0c0c"
const FIELD_MID = "#131315"

/** Charcoal only as anchors; BED teals/sands carry the field. */
const FIELD_COLORS = [
  FIELD,
  BED[0],
  BED[1],
  BED[2],
  FIELD_MID,
  BED[4],
  BED[3],
  BED[0],
  BED[1]
]

const FIELD_SHADER = {
  colors: FIELD_COLORS,
  positions: 48,
  waveX: 0.38,
  waveXShift: 0.55,
  waveY: 0.3,
  waveYShift: 0.22,
  mixing: 0.36,
  grainMixer: 0.22,
  grainOverlay: 0.28
}

const FIELD_MOTION = {
  colors: FIELD_COLORS,
  speed: 0.1,
  distortion: 0.28,
  swirl: 0.06,
  grainMixer: FIELD_SHADER.grainMixer,
  grainOverlay: FIELD_SHADER.grainOverlay
}

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
        style={{
          background: `radial-gradient(120% 95% at 18% 100%, ${BED[3]}33 0%, transparent 55%), ${FIELD}`
        }}
      />
      <div aria-hidden className="absolute inset-0">
        {alive && !calm ? (
          <MeshGradient {...FIELD_MOTION} scale={1.15} fit="cover" style={canvas} />
        ) : (
          <StaticMeshGradient {...FIELD_SHADER} scale={1.15} fit="cover" style={canvas} />
        )}
      </div>
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")"
        }}
      />
      {shade === "headline-left" ? (
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 95% at 14% 100%, rgba(16, 32, 34, 0.38) 0%, transparent 68%)"
          }}
        />
      ) : null}
    </>
  )
}
