import type { PullRequestRef } from "./PullRequestRef"

/**
 * A pull request reduced to the two branch names a stack is built from.
 *
 * Structural rather than a snapshot, because both things that need stacking
 * carry these and nothing else in common: a snapshot the gateway has already
 * read, and a Working Set row enriched with its refs. Anything with a reference
 * and two branch names can be stacked, and neither caller has to become the
 * other first.
 */
export type Placed = {
  readonly reference: PullRequestRef
  readonly baseBranch: string
  readonly headBranch: string
}

/**
 * One pull request and the ones based on its branch, recursively.
 *
 * `above` rather than `children` because that is the direction a stack is read
 * and drawn in: the pull request nearest trunk is the foundation, and the ones
 * that merge into it sit on top of it and cannot land before it does.
 */
export type Stacked<Member extends Placed> = {
  readonly member: Member
  readonly above: ReadonlyArray<Stacked<Member>>
}

const repoOf = (member: Placed): string => `${member.reference.owner}/${member.reference.repo}`

/**
 * A branch, scoped to its repository.
 *
 * The scoping is the whole of it. Every repository has a `main` and most have a
 * `develop`, so matching branch names across repositories would file an entire
 * Working Set into one stack that does not exist.
 */
const branchKey = (member: Placed, branch: string): string => `${repoOf(member)}@${branch}`

/** Repository, then number: a stable order, so the same set always draws the same. */
const inOrder = (left: Placed, right: Placed): number => {
  const leftRepo = repoOf(left)
  const rightRepo = repoOf(right)
  return leftRepo === rightRepo
    ? left.reference.number - right.reference.number
    : leftRepo.localeCompare(rightRepo)
}

/**
 * The stacks among a set of pull requests, as a forest of roots.
 *
 * GitHub serves no stack identifier. Its rows carry `stackPosition` and
 * `stackSize`, which look like the answer and are not: measured against a real
 * three-deep chain both come back null, so they describe some stacking of
 * GitHub's own rather than the ordinary kind made by basing one branch on
 * another. `stackedBaseRefName` is no better — on the middle of that chain it
 * equals `baseRefName` rather than naming the trunk, so it cannot pick out a
 * root either.
 *
 * What is left is each pull request's base and head branch, and that is enough,
 * because a stack is exactly the chain those two facts describe: a pull request
 * whose base is another's head merges into that one, so it sits above it and
 * cannot land until it has.
 *
 * A root is a pull request whose base belongs to no pull request in the set.
 * That covers both the ordinary cases: based directly on trunk, or based on a
 * branch whose own pull request has already merged and left the Working Set.
 *
 * Total by construction. Every member comes back exactly once however tangled
 * the input — which matters more here than it looks, because a row drawn twice
 * is a pull request somebody reviews twice, and a row dropped is one they never
 * see. The guard earns itself against a cycle: two pull requests each based on
 * the other cannot happen in git, but they can happen in two payloads read at
 * different moments, and an unguarded walk recurses until the stack runs out.
 */
export const stacksIn = <Member extends Placed>(
  members: ReadonlyArray<Member>
): ReadonlyArray<Stacked<Member>> => {
  const ordered = [...members].sort(inOrder)

  // First one wins where two pull requests share a head branch. GitHub allows
  // that — the same branch may be proposed into two bases at once — and the
  // alternative is a member with two parents, which is not a tree.
  const byHead = new Map<string, Member>()
  for (const member of ordered) {
    const key = branchKey(member, member.headBranch)
    if (!byHead.has(key)) byHead.set(key, member)
  }

  const parentOf = (member: Member): Member | undefined => {
    const found = byHead.get(branchKey(member, member.baseBranch))
    // A pull request based on its own branch is nobody's child. GitHub will not
    // open one, but a decoder fed a bad payload would, and it would be a cycle
    // of length one.
    return found === member ? undefined : found
  }

  const above = new Map<Member, Array<Member>>()
  const rooted: Array<Member> = []
  for (const member of ordered) {
    const parent = parentOf(member)
    if (parent === undefined) {
      rooted.push(member)
      continue
    }
    const kin = above.get(parent)
    if (kin === undefined) above.set(parent, [member])
    else kin.push(member)
  }

  const placed = new Set<Member>()
  const grow = (member: Member): Stacked<Member> => {
    placed.add(member)
    return {
      member,
      // Tested at the moment of descent rather than filtered in advance, so a
      // member reached twice is dropped the second time rather than recursed
      // into. This is the line that makes a cycle terminate.
      above: (above.get(member) ?? []).flatMap((child) =>
        placed.has(child) ? [] : [grow(child)]
      )
    }
  }

  const stacks: Array<Stacked<Member>> = []
  for (const member of rooted) {
    if (!placed.has(member)) stacks.push(grow(member))
  }

  // Whatever a cycle kept out of the forest. Every member of one has a parent,
  // so none of them is rooted and none would otherwise be drawn at all. The
  // lowest-numbered becomes the foundation, which is arbitrary but stable.
  for (const member of ordered) {
    if (!placed.has(member)) stacks.push(grow(member))
  }

  return stacks
}
