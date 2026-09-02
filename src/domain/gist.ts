import { Option } from "effect"

/**
 * `gist.github.com`'s own pages, in this codebase's words.
 *
 * A different host from every other address this extension reads, so every
 * parser here host-gates on `gist.github.com` rather than `github.com`. See
 * `docs/spec/gists.md`.
 */

/** One gist, owned by whoever created it. */
export type GistAt = {
  readonly owner: string
  readonly id: string
}

/** A reader's own list of gists, one page of it. */
export type GistList = {
  readonly owner: string
  readonly page: number
}

/**
 * The site's own addresses, which are not an owner's gists.
 *
 * `/{owner}` and `/{owner}/{id}` both look exactly like these once they have
 * one or two segments, so a parser that did not know the words GitHub reserves
 * for itself would read `/search` as an owner named "search".
 */
const NOT_AN_OWNER: ReadonlySet<string> = new Set(["search", "discover", "mine", "starred"])

/**
 * Reads one gist out of an address, or nothing where the address is not one.
 */
export const gistViewIn = (url: string): Option.Option<GistAt> => {
  const address = URL.parse(url)
  if (address === null || address.hostname !== "gist.github.com") return Option.none()

  const segments = address.pathname.split("/").filter((part) => part.length > 0)
  const [owner, id, ...rest] = segments
  if (owner === undefined || id === undefined) return Option.none()
  if (NOT_AN_OWNER.has(owner.toLowerCase())) return Option.none()
  // A third segment is one of the gist's own sub-pages — forks, revisions — and
  // this is the gist itself.
  if (rest.length > 0) return Option.none()

  return Option.some({ owner, id })
}

/**
 * Reads a reader's own gist list out of an address, or nothing where the
 * address is not one.
 */
export const gistListIn = (url: string): Option.Option<GistList> => {
  const address = URL.parse(url)
  if (address === null || address.hostname !== "gist.github.com") return Option.none()

  const segments = address.pathname.split("/").filter((part) => part.length > 0)
  const [owner, ...rest] = segments
  if (owner === undefined) return Option.none()
  if (NOT_AN_OWNER.has(owner.toLowerCase())) return Option.none()
  // A second segment means this is one gist's own address, not the list.
  if (rest.length > 0) return Option.none()

  const asked = address.searchParams.get("page")
  const page = asked === null ? 1 : Number.parseInt(asked, 10)

  return Option.some({ owner, page: Number.isNaN(page) ? 1 : page })
}

/**
 * One file inside a gist, as their own page already rendered it.
 *
 * `rendered` is the difference between a README GitHub turned into HTML and a source
 * file it printed as lines, and the screen draws them differently: the first is prose
 * and the second is code. Reading the text of both and hoping is how a markdown file
 * ends up in a monospace column with its heading markers showing.
 */
export type GistFile = {
  readonly name: string
  /** Off their own `type-…` class, which is the language they highlighted it as. */
  readonly language: string | null
  readonly content: string
  readonly rendered: boolean
  /**
   * What GitHub rendered, for a file they turned into HTML.
   *
   * Their markup rather than their text, because the text of a rendered README is the
   * README with every heading, list and code block flattened into one paragraph — which
   * is what this drew before, and it looked exactly like a wall of prose. The third
   * payload that arrives already rendered; see `GitHubHtml`, which draws the other two.
   *
   * Null for a file they printed as lines, where {@link content} is the whole of it.
   */
  readonly html: string | null
  /** Their raw link, which is the one control on a file row worth keeping. */
  readonly raw: string | null
}

/** One gist, everything their page says about it. */
export type GistSeen = {
  readonly owner: string
  readonly id: string
  readonly title: string
  readonly description: string | null
  readonly secret: boolean
  readonly updatedAt: string
  readonly files: ReadonlyArray<GistFile>
  readonly revisions: number
  readonly forks: number
  readonly stars: number
  readonly comments: number
}

/**
 * Whether an address is one of their two editors: making a gist, or changing one.
 *
 * `gist.github.com/` itself is the new-gist form — their site has no other home — and
 * `/{owner}/{id}/edit` is the one for a gist that exists. Neither is a page this
 * extension draws: they are forms, and a form GitHub already knows how to post is not
 * one worth rebuilding. What they get instead is room. See `gistEditing.css`.
 *
 * Recorded on Reddit in 2024 at 23 points: "I find the edit window is extremely tiny to
 * be usable... To be able to modify a code efficiently the display I would expect it to
 * take the full width least and be much taller." Measured live on 2026-09-02, signed in,
 * in a 1256 by 888 window: their editor is 978 wide and 322 tall. A third of the height
 * of the window it is in.
 */
export const isGistEditing = (url: string): boolean => {
  const address = URL.parse(url)
  if (address === null || address.hostname !== "gist.github.com") return false

  const segments = address.pathname.split("/").filter((part) => part.length > 0)
  if (segments.length === 0) return true

  const [owner, id, last] = segments
  return (
    segments.length === 3 &&
    last === "edit" &&
    owner !== undefined &&
    id !== undefined &&
    !NOT_AN_OWNER.has(owner.toLowerCase())
  )
}
