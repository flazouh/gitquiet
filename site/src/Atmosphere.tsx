import type { CSSProperties } from "react"
import { BED_IN_CSS } from "@/ui/bed"

/**
 * Soft Wafer atmosphere: layered teal→sand CSS radials plus a fine grain film.
 * Absolute-fills its relative parent. No pink, no cobalt, no party mesh.
 */
export const Atmosphere = ({
  className = "",
  style
}: {
  readonly className?: string
  readonly style?: CSSProperties
}) => (
  <div
    aria-hidden
    className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    style={{ background: BED_IN_CSS, ...style }}
  >
    <div
      className="absolute inset-0 opacity-[0.35] mix-blend-overlay"
      style={{
        backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
          `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'>
            <filter id='n'>
              <feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/>
              <feColorMatrix type='saturate' values='0'/>
            </filter>
            <rect width='100%' height='100%' filter='url(#n)' opacity='0.55'/>
          </svg>`
        )}")`
      }}
    />
  </div>
)
