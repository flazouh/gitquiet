/**
 * A person's column as it goes into the store, which is not the shape it has in the
 * domain.
 *
 * `Option` is a class and the storage API clones values structurally, so what comes back
 * out of one is a plain object wearing none of its methods: `Option.isSome` on it answers
 * no whatever is inside. Null and back is the whole conversion, and it lives here because
 * here is the only place the two shapes meet. `cache.ts` does the same for a row's
 * standing, and says the same thing at more length.
 *
 * Kept as the column rather than as the 200 kilobytes of markup it was read from. The
 * two parts of the store that keep GitHub's payloads do it to avoid a second way of
 * reading a pull request; there is no second reading here, because the parse *is* the
 * read — and a quarter of a megabyte per person is not what a store entry should be.
 */

import { Option } from "effect"
import type { Person, Way } from "../domain/person"

type KeptWay = { readonly label: string; readonly href: string }

type KeptPerson = {
  readonly login: string
  readonly name: string | null
  readonly bio: string | null
  readonly faceUrl: string | null
  readonly company: string | null
  readonly location: string | null
  readonly followers: string | null
  readonly following: string | null
  readonly site: KeptWay | null
  readonly ways: ReadonlyArray<KeptWay>
  readonly sponsorAt: string | null
  readonly repositories: string | null
  readonly stars: string | null
}

export const asKept = (who: Person): KeptPerson => ({
  login: who.login,
  name: Option.getOrNull(who.name),
  bio: Option.getOrNull(who.bio),
  faceUrl: Option.getOrNull(who.faceUrl),
  company: Option.getOrNull(who.company),
  location: Option.getOrNull(who.location),
  followers: Option.getOrNull(who.followers),
  following: Option.getOrNull(who.following),
  site: Option.getOrNull(who.site),
  ways: who.ways,
  sponsorAt: Option.getOrNull(who.sponsorAt),
  repositories: Option.getOrNull(who.tally.repositories),
  stars: Option.getOrNull(who.tally.stars)
})

const isWay = (value: unknown): value is Way => {
  if (typeof value !== "object" || value === null) return false
  const candidate: { label?: unknown; href?: unknown } = value
  return typeof candidate.label === "string" && typeof candidate.href === "string"
}

const words = (value: unknown): boolean => value === null || typeof value === "string"

/**
 * Whether what came out of the store is still a person.
 *
 * Asked of the login and of the shape of every field, rather than trusted. An entry
 * written by an older build of this extension is the ordinary case — a reader updates
 * while a tab is open — and the honest answer to one this build cannot read is a miss.
 */
const isKept = (value: unknown): value is KeptPerson => {
  if (typeof value !== "object" || value === null) return false

  const one = value as Record<string, unknown>
  if (typeof one.login !== "string" || one.login === "") return false
  if (!Array.isArray(one.ways) || !one.ways.every(isWay)) return false
  if (one.site !== null && !isWay(one.site)) return false

  return ["name", "bio", "faceUrl", "company", "location", "followers", "following", "sponsorAt", "repositories", "stars"].every(
    (field) => words(one[field])
  )
}

/** The column again, or nothing where the store held something this build cannot read. */
export const personKept = (value: unknown): Option.Option<Person> => {
  if (!isKept(value)) return Option.none()

  return Option.some({
    login: value.login,
    name: Option.fromNullishOr(value.name),
    bio: Option.fromNullishOr(value.bio),
    faceUrl: Option.fromNullishOr(value.faceUrl),
    company: Option.fromNullishOr(value.company),
    location: Option.fromNullishOr(value.location),
    followers: Option.fromNullishOr(value.followers),
    following: Option.fromNullishOr(value.following),
    site: Option.fromNullishOr(value.site),
    ways: value.ways,
    sponsorAt: Option.fromNullishOr(value.sponsorAt),
    tally: {
      repositories: Option.fromNullishOr(value.repositories),
      stars: Option.fromNullishOr(value.stars)
    }
  })
}
