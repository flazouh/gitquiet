/**
 * The answer GitHub already wrote into the page, for a query they will not name.
 *
 * `persisted.ts` reads this deploy's hash off GitHub's own traffic, which works
 * on any page where their app asks the question. An issue reached without a page
 * load is not such a page: their app asks `IssueViewerSecondaryViewQuery` and
 * nothing else, so the hash for the query that carries the issue itself is never
 * spoken aloud and the read waits three seconds for a request that is not coming.
 * Measured on `react/react` #37178, from their own issue list.
 *
 * Their served HTML holds both halves of the way out. Under `preloadedQueries`
 * are the queries that page was rendered from, each with the hash GitHub minted
 * for it and the whole result beside it. So a page nobody has the hash for can be
 * fetched once and read from directly, and the hash it carries is worth keeping:
 * every issue after it is the cheap GraphQL route again.
 */

import { Option } from "effect"
import { embeddedPayload } from "./embedded"

/** One query GitHub rendered a page from: what it is called, and what it said. */
export type Preloaded = {
  readonly hash: string
  readonly result: unknown
}

type Query = {
  readonly queryId?: unknown
  readonly queryName?: unknown
  readonly result?: unknown
}

const asQueries = (payload: unknown): ReadonlyArray<Query> => {
  if (typeof payload !== "object" || payload === null) return []
  const { payload: inner }: { payload?: unknown } = payload
  if (typeof inner !== "object" || inner === null) return []

  const { preloadedQueries }: { preloadedQueries?: unknown } = inner
  return Array.isArray(preloadedQueries) ? (preloadedQueries as ReadonlyArray<Query>) : []
}

/**
 * What one named query answered on the page this HTML is, and the hash it
 * answered under.
 *
 * The name is looked for twice over: once by {@link embeddedPayload}, to pick the
 * right script out of the several a repository page carries, and once here to
 * pick the right query out of the several that script holds. An issue page is
 * rendered from three of them.
 */
export const preloadedIn = (html: string, name: string): Option.Option<Preloaded> => {
  const payload = embeddedPayload(html, name)
  if (Option.isNone(payload)) return Option.none()

  for (const query of asQueries(payload.value)) {
    if (query.queryName !== name) continue
    if (typeof query.queryId !== "string" || query.result === undefined) continue
    return Option.some({ hash: query.queryId, result: query.result })
  }

  return Option.none()
}
