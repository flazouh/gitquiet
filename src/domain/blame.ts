import { Option } from "effect"
import { NOT_AN_OWNER, unescaped } from "./repoHome"

/**
 * A file's blame — `/owner/repo/blame/BRANCH/PATH`.
 *
 * The one address of the code view's three this extension has no place for yet.
 * `/tree` and `/blob` are `REPO_HOME`, drawn through the same renderer a pull
 * request's diff is drawn through; blame answers a different question with a
 * different shape of data — a commit per line rather than a tree beside a file
 * — so it is a screen of its own. See `docs/spec/blame.md`.
 */
export type BlameAt = {
  readonly repo: { readonly owner: string; readonly repo: string }
  readonly branch: string
  readonly path: string
}

/**
 * One commit named on a blame page.
 *
 * A subset of GitHub's own payload: the fields a Span needs to tell its story
 * once, and no more. See `blame.md`'s Implementation Decisions for the payload
 * this is read out of.
 */
export type Commit = {
  readonly oid: string
  readonly message: string
  readonly authorAvatarUrl: string
  readonly committerName: string
  /** ISO 8601, as GitHub sends it. */
  readonly committedDate: string
}

/** One contiguous run of lines GitHub's own payload says one commit touched. */
export type Range = {
  readonly start: number
  readonly end: number
  readonly commitOid: string
}

/**
 * Every consecutive {@link Range} naming the same commit, banded into one strip.
 *
 * The unit this screen draws, in place of GitHub's Range: a commit told once at
 * the top of a Span rather than once per Range, which on the worked example in
 * `blame.md` is the difference between 157 strips and 30 distinct stories.
 */
export type Span = {
  readonly start: number
  readonly end: number
  readonly commit: Commit
  /**
   * True where this Span's commit already told its story higher on the page.
   * Drawn thin rather than as a full card — see `blame.md`'s Solution.
   */
  readonly repeat: boolean
}

/**
 * One page of blame, once every range, every commit and the file's own lines
 * have been read.
 */
export type Blamed = {
  readonly ranges: ReadonlyArray<Range>
  readonly commits: ReadonlyMap<string, Commit>
  /** True on a repository that keeps a `.git-blame-ignore-revs` file. */
  readonly ignoreRevsPresent: boolean
  /** The file, a line per entry, exactly as GitHub sent it. */
  readonly lines: ReadonlyArray<string>
}

/**
 * Reads a file's blame out of an address, or nothing where the address is not
 * one.
 *
 * The same host gate, the same reserved-word refusal and the same per-segment
 * decoding as `repoHomeIn`, because this is the fourth page of the one code
 * view application and a reader typing this address deserves the same
 * tolerance for a trailing slash or an escaped character that the other three
 * already have.
 */
export const blameIn = (url: string): Option.Option<BlameAt> => {
  const address = URL.parse(url)
  if (address === null || address.hostname !== "github.com") return Option.none()

  const segments = address.pathname.split("/").filter((part) => part.length > 0)
  const [owner, repo, kind, branch, ...rest] = segments
  if (owner === undefined || repo === undefined) return Option.none()
  if (NOT_AN_OWNER.has(owner.toLowerCase())) return Option.none()
  if (kind !== "blame") return Option.none()

  // A branchless blame, or a branch with nothing after it, is an address GitHub
  // itself does not serve.
  if (branch === undefined || rest.length === 0) return Option.none()

  const path = rest.map(unescaped).join("/")

  return Option.some({ repo: { owner, repo }, branch, path })
}

/**
 * Every {@link Range} of a blame page, banded into {@link Span}s.
 *
 * A pure fold, in line order: a new Span starts wherever the commit changes
 * from the range before it, and a Span whose commit has already opened a Span
 * higher up the page is marked a Repeat rather than told in full a second
 * time. This is the whole of the domain logic blame needs; everything else is
 * a read already shaped to answer it.
 *
 * A range naming a commit absent from the map is skipped rather than thrown on
 * — the map is read out of the same payload the ranges are, and a payload that
 * ever disagreed with itself should draw less rather than crash the page.
 */
export const spansOf = (
  ranges: ReadonlyArray<Range>,
  commits: ReadonlyMap<string, Commit>
): ReadonlyArray<Span> => {
  const spans: Array<Span> = []
  const seen = new Set<string>()

  for (const range of ranges) {
    const commit = commits.get(range.commitOid)
    if (commit === undefined) continue

    const last = spans[spans.length - 1]
    if (last !== undefined && last.commit.oid === commit.oid && last.end === range.start - 1) {
      spans[spans.length - 1] = { ...last, end: range.end }
      continue
    }

    spans.push({ start: range.start, end: range.end, commit, repeat: seen.has(commit.oid) })
    seen.add(commit.oid)
  }

  return spans
}
