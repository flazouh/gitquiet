import { SHOT_SHADOW } from "./brand"

export const Shot = ({
  name,
  caption,
  width,
  height,
  eager = false
}: {
  readonly name: string
  readonly caption: string
  readonly width: number
  readonly height: number
  readonly eager?: boolean
}) => (
  <figure className="m-0">
    <img
      src={`/shots/${name}@2x.png`}
      width={width}
      height={height}
      loading={eager ? "eager" : "lazy"}
      decoding={eager ? "sync" : "async"}

      alt={caption}

      className="block w-full rounded-xl border border-ink/10"
      style={{ boxShadow: SHOT_SHADOW }}
    />
    <figcaption className="mt-5 max-w-xl text-pretty text-[15px] leading-relaxed text-muted">
      {caption}
    </figcaption>
  </figure>
)
