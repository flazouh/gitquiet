import { Option } from "effect"
import type { RepoRef } from "./PullRequestRef"

/**
 * Comparing two refs — `/{owner}/{repo}/compare/{base}...{head}`.
 *
 * How a pull request starts, and the fourth page in `research/pages-to-replace.md`
 * in the notes repository. The strongest single complaint recorded against it is
 * Community #165765: "GitHub's `/compare` page does not support filtering by path.
 * That means when there a lot of changes in the other projects it gets very hard to
 * read the comparison."
 */

/** One file a comparison changes. */
export type Changed = {
  readonly path: string
  /** Their own anchor for it, so a reader can still reach GitHub's diff of it. */
  readonly anchor: string | null
  readonly added: number
  readonly deleted: number
  readonly kind: "added" | "removed" | "renamed" | "modified"
}

export type Comparing = {
  readonly repo: RepoRef
  /** What is being compared against, on the left of their `...`. */
  readonly base: string
  /** What is being compared, on the right. */
  readonly head: string
}

/**
 * Their own separator, and the one thing about this address worth being careful with.
 *
 * `...` is a three-dot range and `..` is a two-dot one, and GitHub serves both. They
 * mean different things to git — three dots is the merge base, two is a direct diff —
 * but the same thing to this screen, which lists what the fragment says changed and
 * does not compute either itself.
 *
 * A branch may contain dots, which is why this splits on the longest separator first
 * and why the halves are not themselves parsed: `release/1.2...main` has three dots in
 * it and only one of them is the range.
 */
const rangeIn = (said: string): { base: string; head: string } | null => {
  /*
   * The longest separator decides, and having decided it does not fall back.
   *
   * Falling back read `main...` — a range with nothing on its right — as a two-dot
   * range whose head was a single dot, which is a comparison against a branch that
   * cannot exist. An address that names a separator and then does not finish it is
   * not a shorter address; it is an unfinished one, and GitHub's own form is the
   * right thing to leave on the screen.
   */
  const between = said.includes("...") ? "..." : ".."
  const at = said.indexOf(between)
  if (at <= 0) return null

  const base = said.slice(0, at)
  const head = said.slice(at + between.length)
  return base.length === 0 || head.length === 0 ? null : { base, head }
}

/** The site's own words, which are not an owner. */
const NOT_AN_OWNER: ReadonlySet<string> = new Set([
  "orgs",
  "settings",
  "notifications",
  "explore",
  "topics",
  "collections",
  "sponsors",
  "marketplace",
  "pulls",
  "issues",
  "search",
  "new",
  "login",
  "join"
])

/**
 * Reads a comparison out of an address, or nothing where the address is not one.
 *
 * A bare `/compare` with no range is GitHub's own branch picker, and it stays theirs:
 * there is nothing to list until a reader has said what to compare, and a screen that
 * took that page would be an empty list where their form was.
 */
export const compareIn = (url: string): Option.Option<Comparing> => {
  const address = URL.parse(url)
  if (address === null || address.hostname !== "github.com") return Option.none()

  const segments = address.pathname.split("/").filter((part) => part.length > 0)
  const [owner, repo, kind, ...rest] = segments
  if (owner === undefined || repo === undefined || kind !== "compare") return Option.none()
  if (NOT_AN_OWNER.has(owner.toLowerCase())) return Option.none()

  /*
   * Back the way it was written. A branch may carry a slash — `claude/gist-screen` is
   * two segments once a path is split — so the range is rejoined rather than read out
   * of the first segment after `compare`.
   */
  const said = rest.join("/")
  if (said === "") return Option.none()

  const range = rangeIn(decodeURIComponent(said))
  return range === null
    ? Option.none()
    : Option.some({ repo: { owner, repo }, base: range.base, head: range.head })
}

/**
 * The address their own page defers the file list to.
 *
 * Found by watching the network on a signed-in compare: the document itself carries no
 * file list at all — no embedded payload, and no filename anywhere in 271KB of HTML —
 * and this fragment is what fills it in. Reading the page instead of the fragment is
 * reading a shell.
 */
export const fileListRoute = (comparing: Comparing): string =>
  `/${comparing.repo.owner}/${comparing.repo.repo}/compare/file-list?range=${encodeURIComponent(
    `${comparing.base}...${comparing.head}`
  )}`
