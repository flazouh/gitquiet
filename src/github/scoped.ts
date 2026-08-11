/**
 * Which repository GitHub thinks a page is about, by the id their own writes take.
 *
 * Their GraphQL mutations address a repository by node id — `R_kgDOTndREA` — and
 * nothing else: there is no `createIssue` that takes an owner and a name. So a
 * write has to find one, and the two honest places to look are a read that
 * answered with it and the page the reader is standing on. This is the second,
 * because it costs no request at all.
 *
 * GitHub writes it into the payload their React roots are rendered from, under
 * `scoped_repository`, beside the owner and the name. The pair matters as much as
 * the id: a document can outlive the repository it was served for — their app
 * navigates without loading — and a write aimed by a stale id would raise an
 * issue in the wrong repository without anything on the screen saying so. So the
 * id is only ever handed back when the payload agrees about which repository it
 * belongs to.
 *
 * Deliberately not derived from the numeric id. Their new node ids do encode it,
 * and `R_` plus a packed 1316442384 really is `R_kgDOTndREA`, so a page carrying
 * the number could be made to yield the id without reading one. That is an
 * encoding nobody published, in a format they have changed once already, and
 * getting it wrong means writing to whatever repository the wrong id names.
 */

import { Option } from "effect"
import type { RepoRef } from "../domain/PullRequestRef"

/** Their key for it, and the one thing worth searching a payload for. */
const NAMING = "scoped_repository"

/**
 * How far into a payload this will look.
 *
 * Their payloads nest a dozen deep in places and the key sits shallow in all of
 * them. The cap is here so that a payload holding a cycle, or one far larger than
 * anything measured, cannot turn a page into a hung tab.
 */
const DEEPEST = 8

type Scoped = { readonly id: unknown; readonly owner: unknown; readonly name: unknown }

/**
 * The node id under `scoped_repository`, where the payload agrees whose it is.
 *
 * Case-insensitive on the owner and the repository, because GitHub is: `/Facebook/React`
 * and `/facebook/react` are one repository to them, and a reader who typed the
 * first would otherwise be told this interface cannot find it.
 */
const scopedIn = (payload: unknown, reference: RepoRef, depth: number): Option.Option<string> => {
  if (depth > DEEPEST || typeof payload !== "object" || payload === null) return Option.none()

  if (Array.isArray(payload)) {
    for (const one of payload) {
      const found = scopedIn(one, reference, depth + 1)
      if (Option.isSome(found)) return found
    }
    return Option.none()
  }

  const held: Record<string, unknown> = payload as Record<string, unknown>

  const scoped = held[NAMING] as Scoped | undefined
  if (
    typeof scoped?.id === "string" &&
    typeof scoped.owner === "string" &&
    typeof scoped.name === "string" &&
    scoped.owner.toLowerCase() === reference.owner.toLowerCase() &&
    scoped.name.toLowerCase() === reference.repo.toLowerCase()
  ) {
    return Option.some(scoped.id)
  }

  for (const one of Object.values(held)) {
    const found = scopedIn(one, reference, depth + 1)
    if (Option.isSome(found)) return found
  }

  return Option.none()
}

/**
 * The repository's node id, out of the payloads a page was rendered from.
 *
 * Takes the payload texts rather than a document, so that what is being read
 * here — a string of JSON — is the whole of what a test has to produce. Gathering
 * them off the page is one `querySelectorAll` and belongs with the other things
 * the gateway reads off `document`.
 *
 * Nothing where no payload names this repository. Which is an ordinary answer:
 * their page may have been rendered for somewhere else entirely, and a write that
 * refuses to aim is better than one that aims at a guess.
 */
export const scopedRepositoryIn = (
  payloads: Iterable<string>,
  reference: RepoRef
): Option.Option<string> => {
  for (const text of payloads) {
    // Checked before anything is parsed, for the reason `embeddedPayload` checks
    // before it parses: a page carries several of these and most of them are the
    // header and the sidebar.
    if (!text.includes(NAMING)) continue

    const parsed = Option.liftThrowable(JSON.parse)(text)
    if (Option.isNone(parsed)) continue

    const found = scopedIn(parsed.value, reference, 0)
    if (Option.isSome(found)) return found
  }

  return Option.none()
}
