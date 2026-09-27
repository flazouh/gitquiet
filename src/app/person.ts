/**
 * Who a person is, for the column all three of their pages draw down the left.
 *
 * Free on a page GitHub served and not free at all on a press this extension answered
 * itself, which is the whole reason this module exists. A press from an issue to the
 * author's profile loads no document: the screen stands on the issue's markup, their card
 * is not in it, and reading it out of the page — which is what `usePerson` does, and what
 * every one of these screens did — answers nothing, forever.
 *
 * So the same column is read over the network here, and the screen prefers whichever of
 * the two arrives. Reading ahead is what makes it quick: the pointer coming near the link
 * starts this, and the press a few hundred milliseconds later finds the answer already in
 * the air. See `warming.ts` and `GitHubGateway.person`.
 */

import { Effect, Option } from "effect"
import type { Person, PersonPage } from "../domain/person"
import { GitHubGateway } from "../ports/GitHubGateway"

/**
 * Their column, reported twice where there is something remembered.
 *
 * Last visit's card at once, then this visit's when the page lands. A face and a bio do
 * not change between two visits on the same day, and a column that waited for the network
 * is a column that arrives after the reader has already looked at where it should be.
 */
export const theirCard = Effect.fn("theirCard")(function* (
  login: string,
  /** The tab's filter, so this asks at the address the list is already fetching. */
  narrowing: string,
  sofar: (who: Person) => void
) {
  const gateway = yield* GitHubGateway

  const remembered = yield* gateway.rememberedPerson(login)
  Option.match(remembered, {
    onNone: () => {},
    onSome: (who) => sofar(who)
  })

  return yield* gateway.person(login, narrowing)
})

/**
 * One of a person's pages, read before the reader asks for it.
 *
 * Two requests, both of which the screen would make: their card, and the first page of
 * their repositories. See `GitHubGateway.person`.
 *
 * Their events are not read here, although the profile leads with them. They come from
 * GitHub's public API, which allows a stranger sixty reads an hour for the whole address,
 * and a pointer passes near far more names than a reader opens: an afternoon of reading
 * lists spent the hour on people nobody opened. The press reads them. See `rateLimit.ts`.
 *
 * Their stars tab never reaches this: `warming.ts` refuses it, because there is no screen
 * for it yet and reading a page ahead that GitHub is going to draw itself is a request
 * spent on nothing.
 */
export const warmPerson = Effect.fn("warmPerson")(function* (page: PersonPage) {
  const gateway = yield* GitHubGateway

  yield* Effect.all(
    [
      // The card itself rather than `theirCard`, which reads the store first to report
      // what is remembered. Nobody is here to be reported to.
      gateway.person(page.login, page.narrowing),
      gateway.personRepositories(page.login, 1, page.narrowing)
    ],
    { concurrency: "unbounded" }
  )
})
