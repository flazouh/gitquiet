import { Option } from "effect"
import type { PullRequestRef } from "./PullRequestRef"
import type { PullRequestState } from "./PullRequest"
import { LEADS_TO, type RowDoing } from "./doable"
import { type InvolvedIssue, courtOfIssue } from "./issues"
import { type Sieve, answers, answersIssue } from "./sieve"
import { type Stacked, stacksIn } from "./stacks"
import { type Court, type InvolvedPullRequest, courtOfOne } from "./workingSet"

/**
 * The Working Set arranged for reading: three Courts, each holding stacks.
 *
 * Between the gateway, which answers about pull requests one shelf at a time,
 * and the screen, which draws Courts. Everything here is a decision about what
 * belongs where, which is why none of it needs a browser to test.
 */

/** Branch names for a pull request, once something has read them. */
export type Branches = {
  readonly baseBranch: string
  readonly headBranch: string
}

/**
 * A pull request and whatever is stacked on top of it.
 *
 * Its own shape rather than {@link Stacked} because a row whose branches nobody
 * has read yet still has to be drawn, and `Stacked` exists only for pull
 * requests both of whose branches are known. On the first paint that is all of
 * them: the rows arrive from one request and the branches from another.
 */
export type Piled = {
  readonly one: InvolvedPullRequest
  /**
   * Where this pull request itself sits, which is not always its pile's Court.
   *
   * GitHub answers about a pull request in isolation, and `ready-to-merge` read
   * as part of a stack is simply wrong: nothing above the foundation can land
   * until the foundation does.
   */
  readonly court: Court
  readonly above: ReadonlyArray<Piled>
}

/** One Court and what is in it. */
export type Sitting = {
  readonly court: Court
  /** Foundations only. Everything stacked above one is inside it. */
  readonly piles: ReadonlyArray<Piled>
  /**
   * The Involved Issues this Court holds.
   *
   * Beside the piles rather than among them, because an issue is not a pull
   * request and nothing stacks on one: there are no branches to fold it into
   * anything. A Court is what is owed to somebody, and half of what a reader is
   * owed arriving as issues is the complaint this answers.
   */
  readonly issues: ReadonlyArray<InvolvedIssue>
  /**
   * How much is in this Court, counting the ones inside piles.
   *
   * A heading saying "2" over a stack of five would be counting piles, which is
   * a number about the drawing rather than about the work.
   */
  readonly count: number
}

/**
 * Needs You first, always: it is the only one of the four that is a request.
 *
 * Waiting before Running because a wait on a person can be shortened by asking
 * them, and a run cannot be shortened at all.
 */
const READING_ORDER: ReadonlyArray<Court> = ["needs-you", "waiting", "running", "settled"]

/**
 * The same order, for deciding which of two shelves to believe.
 *
 * The shelves overlap — a pull request can be waiting for review and ready to
 * merge at once — and a row drawn twice is a row acted on twice. Keeping the
 * more urgent of the two is the safe direction to be wrong in: it costs a
 * glance, where the other way round costs the reader their turn.
 */
export const urgencyOf = (court: Court): number => READING_ORDER.indexOf(court)

const repoOf = (reference: PullRequestRef): string => `${reference.owner}/${reference.repo}`

const changedFirst = (left: InvolvedPullRequest, right: InvolvedPullRequest): number =>
  right.changedAt.localeCompare(left.changedAt)

/**
 * One row per pull request, keeping the one whose shelf puts it in more urgent
 * company.
 */
const deduped = (involved: ReadonlyArray<InvolvedPullRequest>): ReadonlyArray<InvolvedPullRequest> => {
  const best = new Map<string, InvolvedPullRequest>()

  for (const one of involved) {
    const already = best.get(one.id)
    if (already === undefined) {
      best.set(one.id, one)
      continue
    }

    const better = urgencyOf(courtOfOne(one)) < urgencyOf(courtOfOne(already))

    if (better) best.set(one.id, one)
  }

  return [...best.values()]
}

/**
 * One row per issue, keeping the involvement that puts it in more urgent
 * company.
 *
 * The same rule as the one above it and for the same reason: an issue the reader
 * raised and was then assigned comes back on two of the three reads, and a row
 * drawn twice is a row acted on twice. Keyed on GitHub's own id rather than on
 * the address, since that is the one thing a row cannot have two of.
 */
const dedupedIssues = (issues: ReadonlyArray<InvolvedIssue>): ReadonlyArray<InvolvedIssue> => {
  const best = new Map<string, InvolvedIssue>()

  for (const one of issues) {
    const already = best.get(one.id)
    if (already === undefined || urgencyOf(courtOfIssue(one)) < urgencyOf(courtOfIssue(already))) {
      best.set(one.id, one)
    }
  }

  return [...best.values()]
}

/**
 * Newest first, which is the only order this read can be put in honestly.
 *
 * Their issue search sends no time of last change, so a list sorted by activity
 * would be sorted by a field nobody has. When it was raised is a fact, and the
 * pull requests above are in the same direction.
 */
const raisedFirst = (left: InvolvedIssue, right: InvolvedIssue): number =>
  right.raisedAt.localeCompare(left.raisedAt)

type Located = InvolvedPullRequest & Branches

/**
 * A stack as a pile, deciding each member's Court on the way up.
 *
 * `standsOnUnlanded` is the whole reason this recurses with an argument: it is
 * not a property of a pull request but of where it sits, and only the walk down
 * from the foundation knows it.
 */
const pileOf = (stacked: Stacked<Located>, standsOnUnlanded: boolean): Piled => ({
  one: stacked.member,
  court: courtOfOne(stacked.member, standsOnUnlanded),
  above: stacked.above.map((higher) =>
    // Landed, and the ones above it are no longer held up by it.
    pileOf(higher, stacked.member.state !== "merged")
  )
})

const alone = (one: InvolvedPullRequest): Piled => ({
  one,
  court: courtOfOne(one),
  above: []
})

const countIn = (pile: Piled): number =>
  1 + pile.above.reduce((total, higher) => total + countIn(higher), 0)

/**
 * The Working Set as Courts of piles.
 *
 * Branches are asked for rather than carried because they arrive later and from
 * somewhere else: GitHub's list routes do not send them at all, and reading
 * them costs a request per pull request. A Working Set with none is a Working
 * Set of flat rows, which is worth drawing immediately and is what the reader
 * sees for the first moment either way.
 */
export const sittingsIn = (
  involved: ReadonlyArray<InvolvedPullRequest>,
  branchesOf: (one: InvolvedPullRequest) => Option.Option<Branches>,
  issues: ReadonlyArray<InvolvedIssue> = []
): ReadonlyArray<Sitting> => {
  const once = deduped(involved)

  const located: Array<Located> = []
  const adrift: Array<InvolvedPullRequest> = []

  for (const one of once) {
    Option.match(branchesOf(one), {
      onNone: () => adrift.push(one),
      onSome: (branches) => located.push({ ...one, ...branches })
    })
  }

  return filedIn(
    [...stacksIn(located).map((stacked) => pileOf(stacked, false)), ...adrift.map(alone)],
    dedupedIssues(issues)
  )
}

/**
 * Piles and issues put into Courts, in reading order, counted.
 *
 * A pile sits where its foundation sits. Nothing above it can land first, so
 * filing the higher ones separately would tear one piece of work into three and
 * ask the reader to act on the parts that cannot move.
 *
 * A Court with nothing but issues in it is still a Court. The reader with no
 * pull request to move and three issues assigned to them has a move to make, and
 * a heading that appears only when a pull request is under it would be answering
 * a question about pull requests rather than about their day.
 */
const filedIn = (
  piles: ReadonlyArray<Piled>,
  issues: ReadonlyArray<InvolvedIssue>
): ReadonlyArray<Sitting> =>
  READING_ORDER.flatMap((court) => {
    const mine = piles
      .filter((pile) => pile.court === court)
      .toSorted((left, right) => changedFirst(left.one, right.one))

    const theirs = issues.filter((one) => courtOfIssue(one) === court).toSorted(raisedFirst)

    if (mine.length === 0 && theirs.length === 0) return []

    return [
      {
        court,
        piles: mine,
        issues: theirs,
        count: mine.reduce((total, pile) => total + countIn(pile), theirs.length)
      }
    ]
  })

const isSameOne = (pile: Piled, reference: PullRequestRef): boolean =>
  pile.one.reference.owner === reference.owner &&
  pile.one.reference.repo === reference.repo &&
  pile.one.reference.number === reference.number

/**
 * The pull request as the verb leaves it: the state, and a run that verb ended.
 *
 * The state is not a guess — closing a pull request is exactly what makes it
 * closed — and the shelf still is, which is why the shelf is left alone: it is
 * GitHub's answer about what they think the reader should do next, and inventing
 * one is how a row lands under a heading the next read disagrees with.
 *
 * A run in flight is the third thing, and it is neither. Nothing goes on being
 * checked once a pull request is settled, so a row saying "CI running" under a
 * closed pull request is not lag or a guess but a sentence about a machine that
 * has stopped. It was on the screen: a stacked pull request closed from its row
 * kept the running badge it had a second earlier, which is what made the close
 * look as though it had not happened at all.
 *
 * Only a run still going. A rollup that passed or failed is what it was when the
 * work stopped, which is worth keeping and is the answer to why it was closed
 * about as often as not.
 */
const asSettled = (one: InvolvedPullRequest, state: PullRequestState): InvolvedPullRequest => ({
  ...one,
  state,
  checks:
    state === "open" || state === "draft"
      ? one.checks
      : Option.filter(one.checks, (rollup) => rollup.state !== "running")
})

/**
 * Every pile with one pull request's verb worn, wherever in them it sits.
 */
const wearing = (
  piles: ReadonlyArray<Piled>,
  reference: PullRequestRef,
  state: PullRequestState
): { readonly piles: ReadonlyArray<Piled>; readonly found: boolean } => {
  let found = false

  const changed = piles.map((pile): Piled => {
    const above = wearing(pile.above, reference, state)
    if (above.found) found = true

    if (!isSameOne(pile, reference)) return { ...pile, above: above.piles }

    found = true
    return { ...pile, one: asSettled(pile.one, state), above: above.piles }
  })

  return { piles: changed, found }
}

/**
 * Where each pile's members sit, worked out again from the top.
 *
 * The Court of a row is not a property of the pull request: it is read from the
 * shelf, the state, and whether what it stands on has landed. That last one is
 * why this walks rather than maps — a merge frees everything above it, and the
 * only thing that knows a row is above something is the walk down to it.
 */
const recourted = (pile: Piled, standsOnUnlanded: boolean): Piled => ({
  ...pile,
  court: courtOfOne(pile.one, standsOnUnlanded),
  above: pile.above.map((higher) => recourted(higher, pile.one.state !== "merged"))
})

/**
 * The Working Set as it will be, the moment a verb is asked for.
 *
 * Not a patch to the row that was pressed. Every verb here changes which Court a
 * pull request belongs to, a Court that empties disappears, the heading over one
 * counts what is under it, and a merge frees whatever was standing on it — so
 * what a press changes is the arrangement, and the arrangement is derived. This
 * puts the new state on the one row and derives it all again, by exactly the
 * path a read from GitHub takes.
 *
 * Handed straight back where the row is not here to be found, so a screen can
 * tell that nothing happened without comparing two lists.
 */
export const afterDoing = (
  sittings: ReadonlyArray<Sitting>,
  doing: RowDoing,
  reference: PullRequestRef
): ReadonlyArray<Sitting> => {
  const held = sittings.flatMap((sitting) => sitting.piles)
  const changed = wearing(held, reference, LEADS_TO[doing])
  if (!changed.found) return sittings

  return filedIn(
    changed.piles.map((pile) => recourted(pile, false)),
    // Carried across untouched. Every verb a row offers is a verb about a pull
    // request, and an issue that moved Court because somebody merged something
    // would be the arrangement inventing news.
    sittings.flatMap((sitting) => sitting.issues)
  )
}

/**
 * Whether the Working Set already says this pull request is in this state.
 *
 * The question a surface asks of the read that follows one of its own writes:
 * has GitHub caught up? Their search index is behind a write by seconds to
 * minutes, so a list arriving straight after a close routinely still calls the
 * pull request open, and something has to be able to tell that apart from a list
 * that has genuinely caught up.
 *
 * A row that is no longer in the Working Set at all counts as agreement. Closing
 * a pull request is exactly the sort of thing that takes it off every shelf the
 * reader is on, and a list it has left is not a list still disagreeing about it.
 */
export const saysItIs = (
  sittings: ReadonlyArray<Sitting>,
  reference: PullRequestRef,
  state: PullRequestState
): boolean => {
  const looking = (pile: Piled): boolean | undefined => {
    if (isSameOne(pile, reference)) return pile.one.state === state

    for (const higher of pile.above) {
      const found = looking(higher)
      if (found !== undefined) return found
    }

    return undefined
  }

  for (const sitting of sittings) {
    for (const pile of sitting.piles) {
      const found = looking(pile)
      if (found !== undefined) return found
    }
  }

  return true
}

const anyIn = (pile: Piled, sieve: Sieve, now: number): boolean =>
  answers(pile.one, sieve, now) || pile.above.some((higher) => anyIn(higher, sieve, now))

/**
 * The Working Set narrowed to what the reader asked for.
 *
 * A pile survives whole if any one of its members answers. A stack is one piece
 * of work landing in one order, and half of it on the screen would misrepresent
 * what lands with what — so the choice is to show all of it or none of it.
 *
 * `now` is carried through rather than read where it is used, because one term —
 * `is:stale` — is a question about the clock, and a list that answered it from
 * two different readings of the clock could keep half a stack.
 */
export const sifted = (
  sittings: ReadonlyArray<Sitting>,
  sieve: Sieve,
  now: number = Date.now()
): ReadonlyArray<Sitting> =>
  sittings.flatMap((sitting) => {
    const piles = sitting.piles.filter((pile) => anyIn(pile, sieve, now))
    const issues = sitting.issues.filter((one) => answersIssue(one, sieve))
    if (piles.length === 0 && issues.length === 0) return []

    return [
      {
        court: sitting.court,
        piles,
        issues,
        // Counted after sifting, so the heading agrees with what is under it.
        count: piles.reduce((total, pile) => total + countIn(pile), issues.length)
      }
    ]
  })

/**
 * The Courts without their issues, and every issue that was in one.
 *
 * For the reader who asked for the two apart. The rule that decides an issue's
 * Court is the same either way and runs before this: what is being chosen here
 * is where the row is drawn, not what it means, so a reader switching the setting
 * back and forth sees the same issues in the same order under different headings
 * rather than a different answer.
 */
export const setAside = (
  sittings: ReadonlyArray<Sitting>
): {
  readonly sittings: ReadonlyArray<Sitting>
  readonly issues: ReadonlyArray<InvolvedIssue>
} => ({
  sittings: sittings.flatMap((sitting) => {
    if (sitting.piles.length === 0) return []

    return [
      {
        ...sitting,
        issues: [],
        count: sitting.piles.reduce((total, pile) => total + countIn(pile), 0)
      }
    ]
  }),
  issues: READING_ORDER.flatMap((court) =>
    sittings.filter((sitting) => sitting.court === court).flatMap((sitting) => sitting.issues)
  )
})

/**
 * One row on the screen: the pull request, its own Court, and the heading it is
 * drawn under.
 *
 * The last two are the same on nearly every row and differ on exactly one kind:
 * a member of a stack. A pile sits where its foundation sits, so a pull request
 * closed in the middle of one goes on being drawn under Needs You — which is the
 * right place for the pile and the wrong word for the row.
 */
export type Walked = {
  readonly one: InvolvedPullRequest
  readonly court: Court
  readonly heading: Court
}

/**
 * Every row on the screen with both its Courts, in the order the eye moves down
 * them.
 */
export const walkThroughCourts = (sittings: ReadonlyArray<Sitting>): ReadonlyArray<Walked> => {
  const stepping = (pile: Piled, heading: Court): ReadonlyArray<Walked> => [
    { one: pile.one, court: pile.court, heading },
    ...pile.above.flatMap((higher) => stepping(higher, heading))
  ]

  return sittings.flatMap((sitting) =>
    sitting.piles.flatMap((pile) => stepping(pile, sitting.court))
  )
}

/** Every pull request on the screen, in the order the eye moves down them. */
export const walkThrough = (
  sittings: ReadonlyArray<Sitting>
): ReadonlyArray<InvolvedPullRequest> => walkThroughCourts(sittings).map((walked) => walked.one)

/**
 * The pull requests whose branches are worth a request.
 *
 * A stack needs two pull requests in the same repository, so a repository
 * holding one row cannot show a stack however much is read about it. On a
 * Working Set spread thinly across many repositories this asks for nothing at
 * all, which is the common case and the reason to check.
 */
export const worthAskingForBranches = (
  involved: ReadonlyArray<InvolvedPullRequest>
): ReadonlyArray<PullRequestRef> => {
  const once = deduped(involved)

  const crowd = new Map<string, number>()
  for (const one of once) {
    crowd.set(repoOf(one.reference), (crowd.get(repoOf(one.reference)) ?? 0) + 1)
  }

  return once
    .filter((one) => (crowd.get(repoOf(one.reference)) ?? 0) > 1)
    .map((one) => one.reference)
}