/**
 * Dark-glass poster field for the marketing site.
 *
 * Approved Wafer still: teal-top → sand-bottom grain field as a full-bleed
 * backdrop. Shared BED tokens / Bed.tsx stay untouched (extension + onboarding).
 *
 * Not pink, not cobalt, not charcoal B&W. Not a live mesh.
 */

/** Absolute fill; parent must be `relative overflow-hidden`. */
export const Atmosphere = ({
  shade = "headline-left"
}: {
  readonly alive?: boolean
  readonly shade?: "headline-left" | "none"
}) => (
  <>
    <img
      aria-hidden
      alt=""
      src="/atmosphere.png"
      className="absolute inset-0 h-full w-full object-cover"
      draggable={false}
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
