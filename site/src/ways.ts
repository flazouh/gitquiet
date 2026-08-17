import { useRead } from "./read"

/**
 * What the install page reads while a reader is looking at it.
 *
 * Two questions the page cannot answer from its own bundle: which version the
 * releases hold, and whether Apple has finished reviewing. Both change without this
 * site being deployed, and a page that carried its own copy of either would go on
 * saying a version number that is one behind, and go on calling the App Store empty
 * for as long as nobody remembered to edit it.
 *
 * Both reads are public, need no token, and answer with the header that lets a browser
 * read them. Chrome and Firefox are absent from here on purpose: the Chrome store
 * publishes no such address at all, and `addons.mozilla.org` answers a browser's read
 * without the header that would let the page keep it.
 */

const RELEASE_AT = "https://api.github.com/repos/flazouh/gitquiet/releases/latest"

/**
 * Apple's own lookup, by the bundle the Safari app is signed as.
 *
 * It answers `resultCount: 0` for as long as the app is unreleased or in review, and
 * the listing the moment it is on sale. So the App Store row turns into a button on
 * Apple's clock rather than on ours. `onTheAppStore` reads the address out of the one
 * result rather than the count, because an address is what the row needs and a count
 * without one is nothing to draw.
 */
const APPLE_AT =
  "https://itunes.apple.com/lookup?bundleId=dev.gitquiet.GitQuiet-for-Safari&entity=macSoftware"

export type Release = {
  readonly version: string
  /** How big each attached file is, by the name the page links to. */
  readonly sizes: Readonly<Record<string, number>>
}

const said = (body: unknown, key: string): unknown =>
  typeof body === "object" && body !== null ? (body as Record<string, unknown>)[key] : undefined

/** What the releases hold, or nothing at all when the answer cannot be read. */
export const releaseIn = (body: unknown): Release | undefined => {
  const tag = said(body, "tag_name")
  if (typeof tag !== "string" || tag === "") return undefined

  const attached = said(body, "assets")
  const sizes: Record<string, number> = {}
  if (Array.isArray(attached)) {
    for (const one of attached) {
      const name = said(one, "name")
      const size = said(one, "size")
      // A half-read asset is left out rather than written in as a nought, which
      // would put "0.0 MB" beside a download that is twenty megabytes.
      if (typeof name === "string" && typeof size === "number" && size > 0) sizes[name] = size
    }
  }

  return { version: tag.replace(/^v/, ""), sizes }
}

/**
 * A size in millions of bytes, one decimal.
 *
 * Millions rather than mebibytes, because a reader compares this number to the one the
 * Finder shows them afterwards, and the Finder counts in millions.
 */
export const inSize = (bytes: number | undefined): string | undefined =>
  bytes === undefined ? undefined : `${(bytes / 1_000_000).toFixed(1)} MB`

/** Where the App Store holds the app, once it holds it. */
export const onTheAppStore = (body: unknown): string | undefined => {
  const results = said(body, "results")
  const at = said(Array.isArray(results) ? results[0] : undefined, "trackViewUrl")
  return typeof at === "string" && at !== "" ? at : undefined
}

export const useRelease = (): Release | undefined => useRead(RELEASE_AT, releaseIn)

export const useAppStore = (): string | undefined => useRead(APPLE_AT, onTheAppStore)
