import { UndefinedOr } from "effect"

/**
 * Which file, and which of its lines, an address is pointing at.
 *
 * The part of a review that a URL could not say before. A reader who has walked
 * to the ninth file and marked out three lines of it has something worth sending
 * to somebody, and until this the only thing the address carried was the pull
 * request — so what they sent was a link and a sentence saying where to go.
 *
 * Written in the fragment rather than the query, because it names a place inside
 * a page that is already loaded: GitHub's own file anchors are fragments for the
 * same reason, and a fragment costs no request when it changes.
 */

/**
 * Which half of the diff a line belongs to, as the two letters GitHub writes.
 *
 * `R` and `L` rather than `additions` and `deletions`, which is what the
 * renderer calls them: this is an address a person reads and may type, and
 * `#src/one.ts:R42` is the grammar their hands already know from `#diff-…R42`.
 * The two words stay in the port, and the edge that writes an address turns one
 * into the other.
 */
export type Half = "R" | "L"

export type LookingAt = {
  readonly path: string
  /** Absent where the reader is on a file rather than on any line of it. */
  readonly lines?: {
    readonly half: Half
    readonly from: number
    /** The same as `from` for a single line, which is most of them. */
    readonly to: number
  }
}

/**
 * The lines, as they are written after the file.
 *
 * `R42` for one and `R42-48` for a run: the half is said once, because a run
 * that started on one side of a split diff and ended on the other is not
 * something a reader can mark out.
 */
const linesIn = (at: LookingAt): string => {
  if (at.lines === undefined) return ""
  const { half, from, to } = at.lines
  return from === to ? `:${half}${from}` : `:${half}${from}-${to}`
}

/**
 * The path with the characters a fragment cannot hold escaped, and no others.
 *
 * Slashes survive, because a path with its slashes in it is the whole reason to
 * put one in an address a person is going to read. Everything else goes through
 * the standard escape and comes back out of `decodeURIComponent` unchanged.
 */
const written = (path: string): string => encodeURIComponent(path).replaceAll("%2F", "/")

/** The fragment for a place, `#` included, or nothing for nowhere. */
export const addressOf = (at: LookingAt | null): string =>
  at === null || at.path === "" ? "" : `#${written(at.path)}${linesIn(at)}`

const LINES = /^([RL])(\d+)(?:-(\d+))?$/

/**
 * The place a fragment names, or nothing when it names none.
 *
 * The last colon and not the first: a path may hold one — git allows it, and a
 * fragment that guessed at the first would send a reader to half a filename.
 * What follows it has to read as lines, so a colon that is part of the path is
 * left in the path.
 *
 * Anything this does not recognise is nothing rather than a guess. The fragment
 * on a pull request may be GitHub's own `#diff-…`, a comment's `#issuecomment-…`
 * or a heading in the description, and opening the ninth file because somebody
 * followed a link to a comment would be worse than opening the first.
 */
export const lookingAt = (fragment: string): LookingAt | null => {
  const held = fragment.startsWith("#") ? fragment.slice(1) : fragment
  if (held === "" || held.startsWith("diff-") || held.startsWith("issuecomment-")) return null

  const divide = held.lastIndexOf(":")
  const said = divide === -1 ? null : LINES.exec(held.slice(divide + 1))
  const path = read(divide === -1 || said === null ? held : held.slice(0, divide))
  if (path === undefined || path === "") return null
  if (said === null) return { path }

  const [, half, from, to] = said
  const first = Number(from)
  const last = to === undefined ? first : Number(to)
  // A run written backwards is still a run, and a reader who typed it meant both
  // numbers. Sorting here rather than refusing keeps the address forgiving in
  // the one way that costs nothing.
  return {
    path,
    lines: {
      half: half as Half,
      from: Math.min(first, last),
      to: Math.max(first, last)
    }
  }
}

/**
 * The path as it was written down, or nothing when the escaping is broken.
 *
 * `%` on its own is a fragment a reader can type and a link can carry, and the
 * standard decode throws on it. Lifted rather than caught, so the one way this
 * can fail is in the type of the answer.
 */
const read = UndefinedOr.liftThrowable(decodeURIComponent)
