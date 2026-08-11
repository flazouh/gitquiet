import { Effect } from "effect"
import type { PullRequestRef } from "../domain/PullRequestRef"
import type { InvolvedPullRequest, Size, Sizes } from "../domain/workingSet"
import { GitHubGateway } from "../ports/GitHubGateway"

/**
 * How many size reads run at once.
 *
 * The same eight a repository's branch reads get, and cheaper by three orders of
 * magnitude: a whole page of twenty-five answered in about a second and weighed
 * under two kilobytes altogether. The limit is for GitHub's sake rather than the
 * reader's — twenty-five connections opened at one moment on somebody's own
 * session is the kind of thing that gets an extension noticed.
 */
const AT_ONCE = 8

/**
 * What each of these pull requests changes, in lines, as far as it can be found
 * out.
 *
 * One read per row, because GitHub offers no batch for it. Afforded because the
 * route is seventy bytes: the same two counts arrive with the diff itself, which
 * is three quarters of a megabyte for one large pull request and the reason a
 * list has never shown a size before.
 *
 * A row whose read failed keeps no size rather than a zero. Both lists draw a row
 * without one — every row looks like that for the first second — and a four
 * thousand line change labelled `+0 −0` would be worse than an unlabelled one.
 */
export const sizesOf = Effect.fn("sizesOf")(function* (
  rows: ReadonlyArray<InvolvedPullRequest>
) {
  const gateway = yield* GitHubGateway

  const found = yield* Effect.all(
    rows.map((one) =>
      gateway.sizeOf(one.reference).pipe(
        Effect.map((size): ReadonlyArray<readonly [number, Size]> => [[one.id, size]]),
        Effect.orElseSucceed((): ReadonlyArray<readonly [number, Size]> => [])
      )
    ),
    { concurrency: AT_ONCE }
  )

  return new Map(found.flat()) as Sizes
})

/**
 * The same two counts for the layers of a chain, said one at a time as each lands.
 *
 * Named by the pull request's own number rather than by GitHub's id, which is
 * what {@link sizesOf} keys its answers on. A layer arrives inside another pull
 * request's payload and carries no id at all, and every layer of a chain is in
 * one repository, so the number names it and nothing else has to be carried
 * down to the row that draws it.
 *
 * Reported through `tell` as each answer arrives rather than gathered into a map
 * at the end. The rows this is for are already on the screen and linking up, and
 * the first count is worth drawing on the row it belongs to whether or not the
 * last one ever comes.
 *
 * A layer whose read failed keeps no count, for the reason above: the row
 * without one is what every row looks like for the first second, and `+0 −0`
 * would call a four thousand line change nothing.
 */
export const layerSizes = Effect.fn("layerSizes")(function* (
  references: ReadonlyArray<PullRequestRef>,
  tell: (number: number, size: Size) => void
) {
  const gateway = yield* GitHubGateway

  yield* Effect.forEach(
    references,
    (reference) =>
      gateway.sizeOf(reference).pipe(
        Effect.map((size) => tell(reference.number, size)),
        Effect.orElseSucceed(() => {})
      ),
    { concurrency: AT_ONCE, discard: true }
  )
})
