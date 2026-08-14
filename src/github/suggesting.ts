/**
 * Who can be mentioned here, and what can be referred to by number.
 *
 * One route answers both, told apart by which flag is set:
 *
 * ```
 * GET /suggestions/issue?mention_suggester=1&repository=R&user_id=O
 * GET /suggestions/issue?issue_suggester=1&repository=R&user_id=O
 * ```
 *
 * with `Accept: application/json`. Recorded on 2026-08-06 by typing an at sign into their own
 * box and watching what it asked for. Without that accept the route answers 406, and from a
 * page in another repository it answers 406 as well, which is why this is only ever asked
 * from a page inside the repository being asked about.
 *
 * Neither takes what has been typed. The whole list comes back in one answer, so it is read
 * once per repository and filtered where the box stands. See `suggesting.ts` in the domain
 * for the filtering, and `held.ts` for the other half of a box that does not lose things.
 */

import type { Named, Numbered } from "../domain/suggesting"
import { Mentionable, Referable } from "./wire"
import { whereverItIs } from "./wherever"

export const decodeMentionable = whereverItIs(Mentionable)
export const decodeReferable = whereverItIs(Referable)

/** Everyone their suggester named, as people. */
export const peopleIn = (said: Mentionable): ReadonlyArray<Named> =>
  said.map((one) => ({ login: one.login, name: one.name ?? "" }))

/**
 * Everything their suggester named, as issues.
 *
 * `skip` is their word for the one the reader is looking at, and it stays in the list: a
 * comment on an issue refers to that issue as often as to any other, and dropping it would
 * be an opinion about what somebody is allowed to write.
 */
export const numberedIn = (said: Referable): ReadonlyArray<Numbered> =>
  said.suggestions.map((one) => ({
    number: one.number,
    title: one.title,
    state: one.type === "issue_closed" ? "closed" : "open"
  }))
