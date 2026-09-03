/**
 * The other pages of one file, on GitHub's own addresses.
 *
 * This interface draws the file. It does not draw the history of the file, the
 * raw bytes, the blame, or the host that serves those bytes to anything that
 * is not a browser. Those stay theirs, and a reader who came here for one of
 * them used to have no way to reach it: the pane replaced their toolbar and
 * offered nothing in its place.
 *
 * Written here rather than in the pane so the addresses can be asserted without
 * drawing, and so a later screen that opens a file has one answer to copy.
 */

/** Whose file this is, on which ref, and which path from the root. */
export type FileAt = {
  readonly owner: string
  readonly repo: string
  /** The branch, tag or sha the file was read from. */
  readonly on: string
  readonly path: string
}

/**
 * Each segment encoded, slashes left as slashes.
 *
 * A branch named `feat/x` is two segments on their route, and encoding the
 * slash would send the reader to a ref that does not exist. A space or a hash
 * in a path is the reason anything is encoded at all: those are the characters
 * their own links already escape, and a raw one of either cuts the address.
 */
const through = (path: string): string => path.split("/").map(encodeURIComponent).join("/")

/** The commits that landed on this path, which this interface does not draw. */
export const historyAt = ({ owner, repo, on, path }: FileAt): string =>
  `/${owner}/${repo}/commits/${through(on)}/${through(path)}`

/**
 * The file as bytes, on github.com.
 *
 * Their route, not the raw host. A private repository answers this with a
 * signed redirect; the raw host refuses a browser that only has a cookie.
 */
export const rawAt = ({ owner, repo, on, path }: FileAt): string =>
  `/${owner}/${repo}/raw/${through(on)}/${through(path)}`

/**
 * The same bytes on `raw.githubusercontent.com`.
 *
 * The address a README, a script and a `<img>` all want, and the one the
 * report that opened this named: "raw user content url". Public only, because
 * that host does not take a session.
 */
export const rawContentAt = ({ owner, repo, on, path }: FileAt): string =>
  `https://raw.githubusercontent.com/${owner}/${repo}/${through(on)}/${through(path)}`

/** Who last touched each line, which this interface does not draw. */
export const blameAt = ({ owner, repo, on, path }: FileAt): string =>
  `/${owner}/${repo}/blame/${through(on)}/${through(path)}`

/** This file at a sha, which is the permalink their own menu copies. */
export const blobAt = ({ owner, repo, on, path }: FileAt): string =>
  `/${owner}/${repo}/blob/${through(on)}/${through(path)}`

/**
 * This file at a sha, whole, for quoting into something said about the pull
 * request.
 *
 * The one address here that is absolute rather than a path, because it goes
 * inside a comment rather than into a link on our own page. GitHub renders such
 * an address into a box of its own: the file named, the line named, the commit
 * named, and the code itself quoted under them. Read live on
 * `flazouh/ghpro-scratch#14`, 2 September 2026.
 *
 * That is what makes it the answer to
 * [community #9099](https://github.com/orgs/community/discussions/9099), where a
 * reader wants to say something about a file the pull request did not change.
 * GitHub's review route takes such a comment and then draws it in no diff and
 * names no file, so it is worse than useless; this says more, on every page, to
 * everybody. See `docs/plan/comment-anywhere.md`, step 5.
 *
 * A sha rather than a branch is the caller's business and not enforced here,
 * but it is the whole point: a branch moves, and the lines this quotes move
 * with it.
 */
export const quoting = (
  at: FileAt,
  lines?: { readonly from: number; readonly to: number }
): string => {
  const address = `https://github.com${blobAt(at)}`
  if (lines === undefined) return address

  // Sorted, because a reader who dragged upwards meant both numbers, and
  // GitHub reads a backwards run as no run at all.
  const from = Math.min(lines.from, lines.to)
  const to = Math.max(lines.from, lines.to)

  return from === to ? `${address}#L${from}` : `${address}#L${from}-L${to}`
}
