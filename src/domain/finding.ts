import type { Option } from "effect"
import { pullRequestsIn, type Repository } from "./repositories"

/**
 * What the palette searches, and in what order it answers.
 *
 * Two complaints meet here. Their own repository box "only searches for 'recent' repos… you
 * will pull your hair out trying to search for that one repo", and the command palette that
 * did search everything is being taken away — listed at 405 upvotes in their own discussion.
 * So this searches every repository the reader has, all hundred and fifty of them, plus
 * whatever the Working Set is owed, out of the cache rather than over the network.
 *
 * Pure, and a fold over lists that have already arrived: no request, no debounce, nothing to
 * wait for. That is what lets the answers appear inside a keystroke.
 */

/** A thing that can be opened, as the palette draws it. */
export type Found = {
  readonly kind: "repository" | "pull-request" | "issue"
  /** The line a reader reads: a repository's full name, or a title. */
  readonly name: string
  /** The line beneath it, where the name is not the whole story. */
  readonly detail?: string
  readonly where: string
  readonly faceUrl?: Option.Option<string>
}

/** Something the Working Set is owed, thinned to what the palette needs of it. */
export type Owed = {
  readonly kind: "pull-request" | "issue"
  readonly reference: {
    readonly owner: string
    readonly repo: string
    readonly number: number
  }
  readonly title: string
}

/** How many the dialog will ever show. Beyond this a list is a page, and pressing is scrolling. */
const AT_MOST = 20

/**
 * The Courts, flattened into things the palette can find.
 *
 * Piles are a fold for reading rather than a fold for searching: a reader who half-remembers a
 * title has no idea whether that pull request happens to be the foundation of a stack, so the
 * ones above come out too. Order follows the Courts, which puts Needs You first — the same
 * order the screen behind the dialog is in.
 */
export const owedIn = (
  sittings: ReadonlyArray<{
    readonly piles: ReadonlyArray<Piled>
    readonly issues: ReadonlyArray<{
      readonly reference: { readonly owner: string; readonly repo: string; readonly number: number }
      readonly title: string
    }>
  }>
): ReadonlyArray<Owed> =>
  sittings.flatMap((sitting) => [
    ...sitting.piles.flatMap(flattened),
    ...sitting.issues.map((one) => ({
      kind: "issue" as const,
      reference: one.reference,
      title: one.title
    }))
  ])

/**
 * One page of a repository's or a reader's issues, as things the palette can find.
 *
 * A separate fold from {@link owedIn} because the shape it starts from is different: the
 * Courts arrive as piles, and a list arrives as rows. What they have in common is all
 * `Owed` asks for, so the two meet here rather than at the screens.
 *
 * Every row, and no filtering by state. A reader half-remembering a title has no idea
 * whether that issue was closed this morning, which is the same argument the piles fold
 * makes about a stack.
 */
export const owedIssues = (
  rows: ReadonlyArray<{
    readonly reference: { readonly owner: string; readonly repo: string; readonly number: number }
    readonly title: string
  }>
): ReadonlyArray<Owed> =>
  rows.map((one) => ({ kind: "issue" as const, reference: one.reference, title: one.title }))

type Piled = {
  readonly one: {
    readonly reference: { readonly owner: string; readonly repo: string; readonly number: number }
    readonly title: string
  }
  readonly above: ReadonlyArray<Piled>
}

const flattened = (pile: Piled): ReadonlyArray<Owed> => [
  { kind: "pull-request", reference: pile.one.reference, title: pile.one.title },
  ...pile.above.flatMap(flattened)
]

const addressOf = (one: Owed): string =>
  `/${one.reference.owner}/${one.reference.repo}/${
    one.kind === "issue" ? "issues" : "pull"
  }/${one.reference.number}`

const asFound = (one: Owed): Found => ({
  kind: one.kind,
  name: one.title,
  detail: `${one.reference.owner}/${one.reference.repo} #${one.reference.number}`,
  where: addressOf(one)
})

const ofRepository = (one: Repository): Found => ({
  kind: "repository",
  name: one.nameWithOwner,
  where: pullRequestsIn(one),
  faceUrl: one.faceUrl
})

const words = (typed: string): ReadonlyArray<string> =>
  typed
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/^#/, ""))
    .filter((word) => word.length > 0)

/**
 * Where the typing begins, which is what decides the order.
 *
 * Somebody typing "flu" wants the repository called `flowline` before the one called
 * `flowline-forms`, and both before a pull request whose title happens to contain the letters in
 * the middle of a word. Rank rather than filter: everything matching is still offered.
 */
const nearness = (one: Found, asked: ReadonlyArray<string>): number => {
  const against = `${one.name} ${one.detail ?? ""}`.toLowerCase()
  const short = one.kind === "repository" ? one.name.toLowerCase().split("/")[1] ?? "" : ""

  return asked.reduce((score, word) => {
    if (short.startsWith(word)) return score
    if (against.startsWith(word)) return score + 1
    if (new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(against))
      return score + 2
    return score + 3
  }, 0)
}

const holds = (one: Found, asked: ReadonlyArray<string>): boolean => {
  const against = `${one.name} ${one.detail ?? ""} ${one.where}`.toLowerCase()
  return asked.every((word) => against.includes(word))
}

/**
 * What to offer for what was typed.
 *
 * Nothing typed is not nothing to say: the palette opens on what is owed, because a reader who
 * pressed it without knowing what they were looking for is being asked "what needs me", and
 * that answer is already on the screen behind it.
 */
export const finding = (
  typed: string,
  {
    repositories,
    owed,
    inside
  }: {
    readonly repositories: ReadonlyArray<Repository>
    readonly owed: ReadonlyArray<Owed>
    /**
     * The repository the reader is already in, where they are in one.
     *
     * What it buys is a number: somebody reading #1934 who wants #1938 types four digits and
     * presses Enter. Their own way to that is the address bar, and the reason this is worth the
     * three lines is that it is the single most-repeated navigation in a review day.
     */
    readonly inside?: { readonly owner: string; readonly repo: string }
  }
): ReadonlyArray<Found> => {
  const everything = [...owed.map(asFound), ...repositories.map(ofRepository)]
  const asked = words(typed)
  const standing = (one: Found): number => (isIn(one, inside) ? 0 : 1)

  if (asked.length === 0)
    return [...everything].sort((left, right) => standing(left) - standing(right)).slice(0, AT_MOST)

  const numbered = byNumber(asked, inside, everything)

  return [
    ...numbered,
    ...everything
      .filter((one) => holds(one, asked))
      .map((one, at) => ({ one, at, near: nearness(one, asked) }))
      /*
       * Nearness first, and where the reader is standing only after it. The other way round
       * answers "flu" with a pull request from this repository whose title has the letters
       * somewhere in the middle, over the repository actually called `flowline`. Being here
       * is worth a tie; it is not worth the wrong answer.
       */
      .sort(
        (left, right) =>
          left.near - right.near ||
          standing(left.one) - standing(right.one) ||
          left.at - right.at
      )
      .map((ranked) => ranked.one)
  ].slice(0, AT_MOST)
}

/**
 * Whether a row belongs to the repository the reader is already in.
 *
 * By address, because that is the one field every kind of row has and it is the field that
 * makes them different: a repository sits at `/owner/repo/pulls` and a pull request at
 * `/owner/repo/pull/1934`. The trailing slash matters — `/flazouh/ego` is not `/flazouh/ego-browser`.
 */
const isIn = (
  one: Found,
  inside: { readonly owner: string; readonly repo: string } | undefined
): boolean => inside !== undefined && one.where.startsWith(`/${inside.owner}/${inside.repo}/`)

/**
 * The number typed, as a pull request in the repository being read.
 *
 * Nothing when the reader is nowhere in particular, when what they typed is not a number, or
 * when that pull request is already among the things they are owed — the row from the Working
 * Set carries a title, and a row saying only "#1934" beside it would be the same address twice.
 *
 * `/pull/N` rather than a guess between pull and issue: GitHub sends `/pull/N` on to `/issues/N`
 * when the number turns out to be an issue, and does not do the reverse.
 */
const byNumber = (
  asked: ReadonlyArray<string>,
  inside: { readonly owner: string; readonly repo: string } | undefined,
  everything: ReadonlyArray<Found>
): ReadonlyArray<Found> => {
  const [only, ...rest] = asked
  if (inside === undefined || only === undefined || rest.length > 0) return []
  if (!/^\d+$/.test(only)) return []

  const where = `/${inside.owner}/${inside.repo}/pull/${only}`
  if (everything.some((one) => one.where === where)) return []

  return [{ kind: "pull-request", name: `#${only}`, detail: `${inside.owner}/${inside.repo}`, where }]
}
