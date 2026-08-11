import { Option } from "effect"
import type { StackLayer } from "./PullRequest"

/**
 * The part of a chain every question here is asked of.
 *
 * Structural rather than `Stack`, and for the same reason `stacks.ts` takes a
 * `Placed`: not one of these functions reads GitHub's number for a stack or the
 * branch it lands on, and two things arrive here carrying layers — a stack GitHub
 * holds, and the stack it offers to make out of a branch based on a branch.
 *
 * Which is not to say all four questions suit both. {@link wouldLand} and
 * {@link holdingItUp} are about a press, and nothing presses a chain nobody has
 * made yet; they take this shape because the shape is all they read, and the
 * caller decides which chains have a press to ask about.
 */
type Layered = { readonly layers: ReadonlyArray<StackLayer> }

/**
 * What one press of merge puts into the base branch.
 *
 * The question a stack makes hard and an ordinary pull request never asks. On
 * its own, a pull request is what merging it lands; a layer of a stack is not,
 * because GitHub's rule is that a stack lands from the bottom up in one
 * operation. Pressing merge on the third of three lands all three, and the
 * reader is looking at a card that names one.
 *
 * Everything at or below the seat being read, less whatever has already landed.
 * A stack half merged keeps its merged layers in the list — the base branch has
 * them, so counting them in would say four pull requests are about to land when
 * three of them went in yesterday.
 */
export const wouldLand = (chain: Layered): ReadonlyArray<StackLayer> =>
  chain.layers.filter((layer) => layer.seat !== "above" && layer.state !== "merged")

/**
 * The layers in the way of that press, which GitHub's own answer leaves out.
 *
 * A merge state describes one pull request. Asked about the top of a stack with
 * a draft in the middle of it, GitHub answers `MERGEABLE` and files the stack
 * condition as `PASSED`, both of which are true about that pull request and
 * neither of which is true about the press: the draft below has to land first
 * and a draft cannot land at all. Their own page works this out on the client
 * and disables the button; so does this.
 *
 * Drafts only, because a draft is the one hold-up the payload states outright.
 * The rest of what could stop a layer — a failing check, an unresolved thread,
 * a rule — is not sent for anybody's pull request but the one being read, and
 * inventing it from an absence would put a false reason on the card.
 */
export const holdingItUp = (chain: Layered): ReadonlyArray<StackLayer> =>
  wouldLand(chain).filter((layer) => layer.state === "draft")

/**
 * Where in the chain the pull request being read sits, counted from the floor.
 *
 * The one fact a reader arriving at a layer of a stack does not have. Both
 * branches in the header are feature branches, both look ordinary, and nothing
 * about `feat-c` going into `feat-b` says whether there is one more of these or
 * eleven — which is the complaint GitHub's own preview readers filed about
 * losing their place.
 *
 * Every layer, not only the ones a press would land: a merged foundation is
 * still a layer of the chain, and a reader on the third of four is on the third
 * of four however much of it has already gone in. That is the difference from
 * {@link wouldLand}, which answers about the press instead.
 *
 * Absent when no layer claims the seat. GitHub marks one entry CURRENT every
 * time, so this is a payload that changed shape rather than a state anybody can
 * reach — and "layer 0 of 3" is worse than saying nothing.
 */
export const whichLayer = (
  chain: Layered
): Option.Option<{ readonly at: number; readonly of: number }> => {
  const at = chain.layers.findIndex((layer) => layer.seat === "here")

  return at === -1 ? Option.none() : Option.some({ at: at + 1, of: chain.layers.length })
}

/**
 * The part of a stack worth drawing, and how much is left out at each end.
 *
 * A chain has no natural ceiling. The longest one on record in GitHub's own
 * preview feedback is twenty two pull requests, and twenty two rows above a
 * title is not a header any more — it is a second page pushing the pull request
 * off the screen.
 *
 * The window centres on the layer being read, which is Gerrit's rule and the one
 * thing its relation chain does that nothing else does. Cutting from either end
 * instead would scroll a reader's own row out of the panel that exists to tell
 * them where they are, and at that point drawing it is worse than not.
 *
 * Room the window cannot use at one end goes to the other, so the two seats a
 * stack is usually read from — the foundation and the top, where it is merged —
 * both fill the space rather than leaving half of it blank.
 */
export const aroundHere = (
  chain: Layered,
  /** How many rows there is room for. Below 1 nothing is drawn at all. */
  most: number
): {
  readonly layers: ReadonlyArray<StackLayer>
  /** Layers hidden below the window, between it and the foundation. */
  readonly under: number
  /** Layers hidden above it, between it and the top. */
  readonly over: number
} => {
  const all = chain.layers
  if (all.length <= most) return { layers: all, under: 0, over: 0 }

  const seat = all.findIndex((layer) => layer.seat === "here")
  const here = seat === -1 ? all.length - 1 : seat
  const from = Math.min(Math.max(here - Math.floor((most - 1) / 2), 0), all.length - most)

  return {
    layers: all.slice(from, from + most),
    under: from,
    over: all.length - (from + most)
  }
}
