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
