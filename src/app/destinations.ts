/**
 * The two Destinations beside the Working Set: Repositories, and Activity.
 *
 * Both are one read each, which is why they are here together rather than in a module
 * apiece. Neither has the Working Set's problem of six routes that have to agree, and
 * neither needs anything the other does: what they share is the shape every read in this
 * codebase has — remembered first so the page appears, live second so it is true.
 */

import { Effect, Option } from "effect"
import { activityIn } from "../domain/activity"
import { ranked } from "../domain/repositories"
import type { RepositoryAtWork } from "../domain/rail"
import { GitHubGateway } from "../ports/GitHubGateway"

/**
 * Every repository, in the order the Repositories Destination shows them.
 *
 * `atWork` is the Working Set's own fold, passed in rather than read again: the Rail
 * already knows which repositories the reader has a pull request in, and those belong at
 * the top. Ordering here rather than in the gateway keeps the rule where it can be tested
 * without a network.
 */
export const loadRepositories = Effect.fn("loadRepositories")(function* (
  atWork: ReadonlyArray<RepositoryAtWork> = []
) {
  const gateway = yield* GitHubGateway
  const repositories = yield* gateway.repositories()

  return ranked(repositories, atWork)
})

/** The same list as it was last time, ordered the same way, or nothing. */
export const rememberedRepositories = Effect.fn("rememberedRepositories")(function* (
  atWork: ReadonlyArray<RepositoryAtWork> = []
) {
  const gateway = yield* GitHubGateway
  const kept = yield* gateway.rememberedRepositories()

  return Option.map(kept, (repositories) => ranked(repositories, atWork))
})

/**
 * Read ahead, for a pointer resting on a link to home.
 *
 * Only the repositories. Activity is a read against `api.github.com`, whose anonymous limit
 * is sixty an hour for the whole address, and spending one of those on a page the reader
 * may not open is the kind of thriftlessness that ends with an empty Destination at four in
 * the afternoon.
 */
export const warmDestinations = Effect.fn("warmDestinations")(function* () {
  const gateway = yield* GitHubGateway

  yield* gateway.repositories()
})

/**
 * What happened elsewhere, grouped by repository, newest first.
 *
 * One request and no ranking. The grouping is what makes it readable — fourteen stars in a
 * row cost one line rather than fourteen — and it is done here rather than in the adapter
 * because it is a rule about reading rather than about GitHub.
 */
export const loadActivity = Effect.fn("loadActivity")(function* (login: string) {
  const gateway = yield* GitHubGateway
  const happenings = yield* gateway.activity(login)

  return activityIn(happenings)
})

/** The same happenings as last time, grouped the same way, or nothing. */
export const rememberedActivity = Effect.fn("rememberedActivity")(function* (login: string) {
  const gateway = yield* GitHubGateway
  const kept = yield* gateway.rememberedActivity(login)

  return Option.map(kept, activityIn)
})
