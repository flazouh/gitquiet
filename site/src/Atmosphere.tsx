import { MeshGradient, StaticMeshGradient } from "@paper-design/shaders-react"
import type { CSSProperties } from "react"
import { useEffect, useState } from "react"
import { BED } from "@/ui/bed"

/**
 * Dark-glass poster field for the marketing site.
 *
 * Live MeshGradient (Lumen CharcoalField pattern): absolute inset-0 + style
 * width/height 100% so the shader fills the tall poster card
 * (`min-h-[calc(100svh-20px)]`). CSS band fallback under the canvas; light grain;
 * optional headline-left shade. Wafer teal→sand — not charcoal/cobalt, not a PNG.
 *
 * Measured Wafer structure: teal UPPER / sand LOWER as a clear vertical band.
 * Shared BED stops stay untouched (extension + onboarding); warmer sand and a
 * stronger teal live here only.
 */

/** Stronger teal — Atmosphere-local (shared BED stays as-is). */
const TEAL_STRONG = "#90a8a8"
/** Warmer sand — Atmosphere-local; keeps the lower band from reading as pure grey. */
const SAND_WARM = "#9c9078"

/**
 * Mesh stops ordered teal-heavy then sand-heavy so spots prefer upper / lower
 * families instead of averaging into mid greys (#848484 / #909090).
 */
const ATMOSPHERE_COLORS = [
  TEAL_STRONG,
  BED[0],
  BED[4],
  BED[2],
  BED[1],
  SAND_WARM,
  BED[3]
] as const

/**
 * Base CSS enforces the vertical split before (and under) the shader.
 * Teal family on top, mid BED[2], sand family on bottom — split is obvious.
 */
const ATMOSPHERE_CSS = [
  `radial-gradient(95% 70% at 16% 10%, ${BED[0]}d9 0%, transparent 58%)`,
  `radial-gradient(85% 65% at 84% 14%, ${TEAL_STRONG}b3 0%, transparent 52%)`,
  `radial-gradient(100% 80% at 78% 90%, ${SAND_WARM}cc 0%, transparent 60%)`,
  `radial-gradient(90% 75% at 18% 94%, ${BED[3]}b8 0%, transparent 56%)`,
  `linear-gradient(180deg, ${TEAL_STRONG} 0%, ${BED[0]} 20%, ${BED[4]} 36%, ${BED[2]} 48%, ${BED[1]} 60%, ${SAND_WARM} 78%, ${BED[3]} 100%)`
].join(", ")

/** Static mesh: low mixing → harder bands; low grainOverlay → keeps chroma. */
const ATMOSPHERE_SHADER = {
  colors: [...ATMOSPHERE_COLORS],
  positions: 34,
  waveX: 0.26,
  waveXShift: 0.48,
  waveY: 0.2,
  waveYShift: 0.16,
  mixing: 0.16,
  grainMixer: 0.12,
  grainOverlay: 0.04
}

/** Motion mesh: calm drift; no BED_MOTION spread (that muddies the field). */
const ATMOSPHERE_MOTION = {
  colors: [...ATMOSPHERE_COLORS],
  speed: 0.1,
  distortion: 0.2,
  swirl: 0.04,
  grainMixer: ATMOSPHERE_SHADER.grainMixer,
  grainOverlay: ATMOSPHERE_SHADER.grainOverlay
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
        style={{ background: ATMOSPHERE_CSS }}
      />
      <div aria-hidden className="absolute inset-0 opacity-[0.88]">
        {alive && !calm ? (
          <MeshGradient {...ATMOSPHERE_MOTION} scale={1.12} fit="cover" style={canvas} />
        ) : (
          <StaticMeshGradient
            {...ATMOSPHERE_SHADER}
            scale={1.12}
            fit="cover"
            style={canvas}
          />
        )}
      </div>
      {/* Light Wafer-like dither — opacity kept low so chroma survives. */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07] mix-blend-soft-light pointer-events-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 128 128' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"
        }}
      />
      {shade === "headline-left" ? (
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 95% at 14% 100%, rgba(28, 44, 46, 0.2) 0%, transparent 68%)"
          }}
        />
      ) : null}
    </>
  )
}
