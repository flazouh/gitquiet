import type { View } from "../../shots/view"
import { FEATURES } from "./features"
import { Live } from "./Live"

export const Feature = ({ view, at }: { readonly view: View; readonly at: number }) => {
  const feature = FEATURES[view.name]

  if (feature === undefined) return null

  const flipped = at % 2 === 1

  return (
    <section
      className={`flex flex-col items-center gap-10 lg:gap-16 ${
        flipped ? "lg:flex-row-reverse" : "lg:flex-row"
      }`}
    >

      <div className="w-full flex-1 lg:w-auto">
        <h3 className="m-0 text-balance text-[clamp(1.35rem,2.4vw,1.75rem)] font-semibold leading-[1.15] tracking-[-0.025em]">
          {feature.title}
        </h3>

        <p className="mt-4 text-pretty text-[16px] leading-relaxed text-muted">
          {feature.description}
        </p>
      </div>

      <div className="min-w-0 shrink-0 max-w-full">
        <Live view={view} focus={feature.focus} />
      </div>
    </section>
  )
}
