import type { CSSProperties } from "react"
import type { View } from "../../shots/view"
import { FEATURES } from "./features"
import { Live } from "./Live"

export const Feature = ({ view, at }: { readonly view: View; readonly at: number }) => {
  const feature = FEATURES[view.name]

  if (feature === undefined) return null

  const flipped = at % 2 === 1

  return (
    <section
      className={`flex min-w-0 flex-col items-center gap-10 lg:gap-16 ${
        flipped ? "lg:flex-row-reverse" : "lg:flex-row"
      }`}
    >

      <div className="w-full min-w-0 flex-1">
        <h3 className="m-0 text-balance text-[clamp(1.35rem,2.4vw,1.75rem)] font-semibold leading-[1.15] tracking-[-0.025em]">
          {feature.title}
        </h3>

        <p className="mt-4 text-pretty text-[16px] leading-relaxed text-muted">
          {feature.description}
        </p>
      </div>

      <div
        className="w-full min-w-0 lg:w-[var(--shot)] lg:shrink-0"
        style={{ "--shot": `${feature.focus.width}px` } as CSSProperties}
      >
        <Live view={view} focus={feature.focus} tight={feature.tight} />
      </div>
    </section>
  )
}
