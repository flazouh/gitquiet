import { Option } from "effect"

/**
 * An owner's face, or their initial where GitHub gave none.
 *
 * `alt=""` and `aria-hidden` on both: the name is beside them in text, and a screen reader
 * that read the face as well would say every repository twice.
 */
export const Face = ({
  faceUrl,
  name,
  big = false,
  pinned = false
}: {
  readonly faceUrl: Option.Option<string>
  readonly name: string
  /** The reader's own face, which is a person and not a repository, so it is a size up. */
  readonly big?: boolean
  /**
   * Marked, for a pinned repository on a Rail too narrow to hold the pin itself.
   *
   * The pin button goes with the width, and without it the pinned repositories at the top
   * of the strip are the same faces as the ones below the rule. A dot on the corner is the
   * cheapest thing that tells them apart at sixteen pixels, and it is the only thing this
   * list has to say about a face other than whose it is.
   */
  readonly pinned?: boolean
}) => {
  const size = big ? "size-5" : "size-4"

  const face = Option.match(faceUrl, {
    onNone: () => (
      <span
        aria-hidden="true"
        className={`grid ${size} shrink-0 place-items-center rounded bg-hover font-mono text-[9px] text-ink-muted`}
      >
        {name.slice(0, 1).toLowerCase()}
      </span>
    ),
    onSome: (url) => (
      <img
        src={url}
        alt=""
        aria-hidden="true"
        // Round for the reader, because that is the shape GitHub gives a person everywhere
        // else on the page; square-ish for the owner beside a repository name.
        className={`${size} shrink-0 ${big ? "rounded-full" : "rounded"}`}
      />
    )
  })

  if (!pinned) return face

  return (
    <span className="relative flex shrink-0">
      {face}
      <span
        aria-hidden="true"
        className="absolute -bottom-0.5 -right-0.5 size-1.5 rounded-full bg-accent-emphasis"
      />
    </span>
  )
}
