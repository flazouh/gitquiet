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
  sofar: (who: Person) => void = () => {}
) {
  const gateway = yield* GitHubGateway

  const remembered = yield* gateway.rememberedPerson(login)
  Option.match(remembered, {
    onNone: () => {},
    onSome: (who) => sofar(who)
  })

  return yield* gateway.person(login)
})

/**
 * One of a person's pages, read before the reader asks for it.
 *
 * Two requests at most, and on the profile they are the two the screen would make: their
 * page, which carries the column and the first thirty repositories, and their events,
 * which is the question the profile is arranged around. The card and the rows are one
 * fetch — see `GitHubGateway.person` — so what a pointer near a link costs is one document
 * and one small JSON route.
 *
 * Their stars tab never reaches this: `warming.ts` refuses it, because there is no screen
 * for it yet and reading a page ahead that GitHub is going to draw itself is a request
 * spent on nothing.
 */
export const warmPerson = Effect.fn("warmPerson")(function* (page: PersonPage) {
  const gateway = yield* GitHubGateway

  yield* Effect.all(
    [
      theirCard(page.login),
      gateway.personRepositories(page.login, 1, page.narrowing),
      // Their events, for the band the profile leads with. Nothing on the repositories tab
      // reads them, so that tab does not pay for them.
      ...(page.tab === "profile" ? [gateway.activity(page.login, "browsed")] : [])
    ],
    { concurrency: "unbounded" }
  )
})
