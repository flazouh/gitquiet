import { useState } from "react"
import { faceOf } from "./Who"

/**
 * Whose repository it is, as the picture GitHub puts beside its name.
 *
 * A row already names the repository, and the name is the part a reader has to
 * read: `flowline-labs/flowline`, `octo-org/octo-repo`, `flazouh/stack-probe`
 * are twenty characters of monospace that all begin differently and end the same.
 * The picture is recognised instead of read — the same trick as the author's face
 * at the left edge — so a list spanning six repositories can be grouped by eye
 * without any of them being read at all.
 *
 * A rounded square rather than a circle, which is GitHub's own distinction and a
 * useful one here: the circle at the start of a row is a person, and this is a
 * place. Two round faces on one line would read as two people.
 *
 * Their redirect from a login to an avatar serves an organisation exactly as it
 * serves a person, so an owner needs no lookup of its own — and when there is
 * nothing to serve, the initial stands in rather than a broken image.
 */
export const Owner = ({
  owner,
  size = 14
}: {
  readonly owner: string
  readonly size?: number
}) => {
  const [broken, setBroken] = useState(false)

  return (
    <span
      aria-label={owner}
      role="img"
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-sm bg-surface text-[8px] font-semibold uppercase text-ink-muted"
      style={{ width: size, height: size }}
    >
      {broken ? (
        owner.slice(0, 1)
      ) : (
        <img
          alt=""
          src={faceOf(owner, size * 2)}
          width={size}
          height={size}
          onError={() => setBroken(true)}
        />
      )}
    </span>
  )
}
