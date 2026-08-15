/**
 * What a person's profile is made of, which is two reads and one question.
 *
 * The question is whether this person answers anybody, and the whole page is arranged
 * around it: the band that answers it comes first, and their repositories, which every
 * other profile leads with, come under it. See `docs/spec/profile.md`.
 *
 * Both reads are behind the first paint and neither holds the other up. Their events are
 * one request to a route that needs no cookie, and their list is the walk the
 * repositories tab already does — so the page draws its column and its tab row at once
 * and fills the two bands as the answers land.
 */

import { Effect, Option } from "effect"
import { type Answering, answering } from "../domain/answering"
import { GitHubGateway } from "../ports/GitHubGateway"

/**
 * How much of an answer they have been lately, from what they did in public.
 *
 * Reported twice where there is something remembered: last visit's answer at once, then
 * this visit's when the events land. A band that waited would be a band a reader scrolls
 * past before it says anything, and the number rarely moves between two visits on the
 * same day.
 */
export const theirAnswering = Effect.fn("theirAnswering")(function* (
  login: string,
  now: Date,
  sofar: (said: Answering) => void = () => {}
) {
  const gateway = yield* GitHubGateway

  const remembered = yield* gateway.rememberedActivity(login)
  Option.match(remembered, {
    onNone: () => {},
    onSome: (events) => sofar(answering(events, login, now))
  })

  /*
   * Kept as a page somebody went to rather than as one of Home's own reads. A stranger's
   * events in the standing index would evict one of the eleven the Working Set is built
   * from, and the fifth profile a reader opened would cost them a blank Home.
   */
  const events = yield* gateway.activity(login, "browsed")
  return answering(events, login, now)
})

/*
 * Their repositories are read by `theirWholeList` in `./personRepos`, unchanged. The
 * profile document carries no rows — their tab is where GitHub puts them — and that walk
 * already begins with a request when the document it is given has none. The band under
 * this one is the same list as the repositories tab, counted the same way, because two
 * pages that disagree about how many things somebody owns is a pair nobody trusts.
 */
