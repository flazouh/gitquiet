/**
 * Every repository the reader has, as the last read left it.
 *
 * The switcher behind the name in the bar is drawn only where there is a list to
 * switch to, and the list itself comes out of the extension store — which is an
 * asynchronous read. Every screen this extension draws is its own bundle, so
 * arriving at one builds a new bar from nothing, and that bar drew no chevron for
 * as long as the read took: a control vanishing and returning under the pointer
 * on every press of a row.
 *
 * So the list is mirrored here, in `localStorage`, for the one property that store
 * cannot offer: it is read synchronously, in the same turn the bar first renders.
 * The same reason `visited.ts` keeps the recent names here, and the same reason
 * the launch keeps its last rows. See `keeping.ts` for what is kept where.
 *
 * A copy of what GitHub said rather than a list built out of the names in
 * `visited`, because a row says "Private" off a field only the read knows. A row
 * assembled from a name would call a private repository public until the read
 * landed, which is a claim worth more than a tenth of a second of chevron.
 */

import { Option, UndefinedOr } from "effect"
import type { Repository } from "../domain/repositories"
import { KEPT_REPOSITORIES as KEY } from "./keeping"

/**
 * One repository as it goes into a flat string.
 *
 * `faceUrl` is the reason this shape exists rather than the domain's. An `Option`
 * is a tagged object, and JSON of one read back by a later version of `effect` is
 * a shape this file would be promising to keep. A string or nothing says the same
 * thing and will still mean it.
 */
type Said = {
  readonly owner: string
  readonly repo: string
  readonly name: string
  readonly face: string | null
  readonly org: boolean
  readonly private: boolean
  readonly empty: boolean
}

/**
 * Storage that cannot throw.
 *
 * A private window, a profile with storage turned off, and a quota already spent
 * all reach here, and all three mean the same thing from the bar's side: nothing
 * is kept, so the chevron waits for the read as it did before. None of them is a
 * reason to fail to draw the bar.
 */
const held = UndefinedOr.liftThrowable((): Storage => localStorage)
const read = UndefinedOr.liftThrowable((store: Storage, key: string) => store.getItem(key))
const write = UndefinedOr.liftThrowable((store: Storage, key: string, value: string) => {
  store.setItem(key, value)
})
const parse = UndefinedOr.liftThrowable((said: string): unknown => JSON.parse(said))

const asSaid = (one: Repository): Said => ({
  owner: one.owner,
  repo: one.repo,
  name: one.nameWithOwner,
  face: Option.getOrNull(one.faceUrl),
  org: one.ofAnOrganisation,
  private: one.isPrivate,
  empty: one.isEmpty
})

/**
 * One row back out, where it is a row at all.
 *
 * Written by us and still checked, for the reason `visited.ts` checks: this is one
 * flat space that anything on the page can write into, and a bad row is one row
 * fewer in a menu rather than a bar that fails.
 */
const asRepository = (said: unknown): Repository | undefined => {
  if (typeof said !== "object" || said === null) return undefined

  const row = said as Partial<Said>
  const { owner, repo, name } = row
  if (typeof owner !== "string" || typeof repo !== "string" || typeof name !== "string") {
    return undefined
  }

  return {
    owner,
    repo,
    nameWithOwner: name,
    faceUrl: typeof row.face === "string" ? Option.some(row.face) : Option.none(),
    ofAnOrganisation: row.org === true,
    isPrivate: row.private === true,
    isEmpty: row.empty === true
  }
}

/** The list as the last read left it. Empty where nothing has been read yet. */
export const keptRepositories = (): ReadonlyArray<Repository> => {
  const store = held()
  if (store === undefined) return []

  const said = read(store, KEY)
  if (said === undefined || said === null) return []

  const held_ = parse(said)
  if (!Array.isArray(held_)) return []

  return held_
    .map(asRepository)
    .filter((one): one is Repository => one !== undefined)
}

/**
 * Keep what a read answered, in place of whatever the read before it answered.
 *
 * An empty answer is not one of those, and that is the whole of the rule. Every
 * screen offering a switcher reads the store, and the store says nothing whenever
 * its cached list has not been fetched yet or has gone cold — which is a read that
 * has nothing to say, not a reader with no repositories. Written through, that one
 * read threw away the list from ten minutes earlier, nothing but a visit to Home
 * fills this again, and so the chevron went and stayed gone.
 *
 * What it costs is a reader who signs out keeping a switcher until they next open
 * Home. That is worth less than a control that disappears for good.
 */
export const keepRepositories = (list: ReadonlyArray<Repository>): void => {
  if (list.length === 0) return

  const store = held()
  if (store === undefined) return

  write(store, KEY, JSON.stringify(list.map(asSaid)))
}
