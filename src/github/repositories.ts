/**
 * Their repository filter's answer, in this codebase's words.
 */

import { Effect, Option, Schema } from "effect"
import type { Repository } from "../domain/repositories"
import { FilteredRepositories } from "./wire"

export const decodeRepositories = Schema.decodeUnknownEffect(FilteredRepositories)

/**
 * Every repository they listed, as {@link Repository}.
 *
 * Their `visibility` is a string of which only `private` matters here, and `ownerType` an
 * `Organization`-or-`User` that decides whether a face is a person's. Both are optional in
 * the schema and treated as absent rather than false, because a missing field means GitHub
 * changed their payload and the useful answer is still the list.
 */
export const repositoriesIn = (
  said: FilteredRepositories
): ReadonlyArray<Repository> =>
  said.repositories.map((one) => ({
    owner: one.owner,
    repo: one.name,
    nameWithOwner: one.nameWithOwner,
    faceUrl: Option.fromNullishOr(one.ownerAvatar),
    ofAnOrganisation: one.ownerType === "Organization",
    isPrivate: one.visibility === "private",
    isEmpty: one.isEmpty === true
  }))

/** Decoded and mapped, for a caller that has raw JSON and wants repositories. */
export const repositoriesFrom = (raw: unknown): Effect.Effect<ReadonlyArray<Repository>, unknown> =>
  decodeRepositories(raw).pipe(Effect.map(repositoriesIn))
