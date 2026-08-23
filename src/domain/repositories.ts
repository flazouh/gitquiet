/**
 * Every repository a Participant has, as the Rail and the Repositories Destination need
 * them.
 *
 * Not the same list as {@link RepositoryAtWork}, and the difference is the point. That one
 * is a fold over the Working Set, so it holds the repositories with an Involved Pull
 * Request in them and nothing else — instant, free, and blind to a repository the
 * Participant has not opened a pull request in. This is the whole list, which is what
 * story 5 asks for: "searches every repository I have, not the recent ones, so that
 * finding a repository is typing rather than remembering".
 *
 * Read from GitHub's own filter route. Measured against a live account: 154 repositories
 * in one 44-kilobyte answer, each carrying its owner's face, which is what lets the
 * collapsed Rail keep faces rather than initials.
 */

import { Option } from "effect"
import type { RepositoryAtWork } from "./rail"

/** One repository, in the words this codebase uses for them. */
export type Repository = {
  readonly owner: string
  readonly repo: string
  /** `owner/repo`, which is the only name that is an address. */
  readonly nameWithOwner: string
  /** Their owner's face, where GitHub gave one. */
  readonly faceUrl: Option.Option<string>
  /** Whether the owner is an organisation rather than a person. */
  readonly ofAnOrganisation: boolean
  readonly isPrivate: boolean
  /** Nothing pushed to it yet, which is worth knowing before offering to open it. */
  readonly isEmpty: boolean
}

/**
 * The ones whose name a Participant is part-way through typing.
 *
 * Case-insensitive and against `owner/repo` rather than the repository alone, so typing an
 * organisation's name narrows to its repositories — which is how somebody with 154 of them
 * across four owners actually looks for one. Space-separated words all have to match, in
 * any order, so "octo-repo fla" finds `flazouh/octo-repo`.
 */
export const matching = (
  repositories: ReadonlyArray<Repository>,
  typed: string
): ReadonlyArray<Repository> => {
  const words = typed.toLowerCase().split(/\s+/).filter((word) => word.length > 0)
  if (words.length === 0) return repositories

  return repositories.filter((one) => {
    const against = one.nameWithOwner.toLowerCase()
    return words.every((word) => against.includes(word))
  })
}

/**
 * The whole list, with the repositories the Participant's work is in at the top of it.
 *
 * Deliberately not ranked by when anything last changed. That is the rule that puts a 2016
 * repository at the top of GitHub's own list, and it is also unavailable: their filter
 * route answers with names, owners and faces, and says nothing about pushes. What it can
 * be ranked by is what the Working Set already knows — whose move it is — and after that
 * the only honest order is alphabetical, which at least stays put between reads.
 */
export const ranked = (
  repositories: ReadonlyArray<Repository>,
  atWork: ReadonlyArray<RepositoryAtWork>
): ReadonlyArray<Repository> => {
  const rank = new Map(atWork.map((one, at) => [`${one.owner}/${one.repo}`, at]))
  const place = (one: Repository): number => rank.get(one.nameWithOwner) ?? rank.size

  return [...repositories].sort(
    (left, right) =>
      place(left) - place(right) || left.nameWithOwner.localeCompare(right.nameWithOwner)
  )
}

/**
 * The whole list as the switcher behind the name offers it: four bands, in this order.
 *
 * The one being read, then the ones pinned, then the ones read lately, then the rest.
 * Different to {@link ranked}, which is the Repositories Destination's order, and the
 * difference is what each list is for. That one is browsed, so it leads with the work
 * that is owed. This one is aimed at — it opens over the repository being read and closes
 * on the next press — so it leads with the few a reader moves between, and those few have
 * to still be at the top tomorrow.
 *
 * Bands rather than a score, and each band keeps the order it was given: pins in the
 * order they were pinned, visits with the most recent first, and everything else exactly
 * as GitHub's filter route said. A list whose rows swap places between two openings is a
 * list nobody learns the shape of, and learning the shape is the whole saving.
 *
 * A pin beats a visit because a pin was asked for and a visit was only noticed. Nothing
 * here ranks by when a repository last changed: that is the rule that puts a 2016
 * repository at the top of GitHub's own list, and their route says nothing about pushes.
 */
/**
 * The pinned list with one address toggled: out of it if held, onto its end if
 * not. The one spelling of the toggle, because the Rail and the switcher each
 * had their own and two spellings of one rule is how they drift apart.
 */
export const withPinToggled = (
  pinned: ReadonlyArray<string>,
  address: string
): ReadonlyArray<string> =>
  pinned.includes(address) ? pinned.filter((one) => one !== address) : [...pinned, address]

export const switchable = (
  repositories: ReadonlyArray<Repository>,
  order: {
    /** The repository being read, as `owner/repo`. */
    readonly here?: string
    /** What the reader pinned, in the order they pinned it. See `Settings.pinned`. */
    readonly pinned?: ReadonlyArray<string>
    /** Where the reader has been, most recent first. See `visited`. */
    readonly lately?: ReadonlyArray<string>
  }
): ReadonlyArray<Repository> => {
  const { here, pinned = [], lately = [] } = order

  const band = (one: Repository): number => {
    if (one.nameWithOwner === here) return 0
    if (pinned.includes(one.nameWithOwner)) return 1
    if (lately.includes(one.nameWithOwner)) return 2
    return 3
  }

  // Their own place inside a band, so that a pin keeps its pin order and a visit its
  // recency. The rest share one place and a stable sort leaves them as they arrived.
  const within = (one: Repository, at: number): number => {
    const found = band(one) === 1 ? pinned.indexOf(one.nameWithOwner) : lately.indexOf(one.nameWithOwner)
    return band(one) === 3 || band(one) === 0 ? at : found
  }

  return [...repositories]
    .map((one, at) => ({ one, band: band(one), within: within(one, at) }))
    .sort((left, right) => left.band - right.band || left.within - right.within)
    .map(({ one }) => one)
}

/** Where a press on a repository goes: its pull requests, which we draw. */
export const pullRequestsIn = (one: Repository): string => `/${one.nameWithOwner}/pulls`
