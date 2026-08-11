/**
 * The repositories most recently read, kept between visits.
 *
 * The switcher behind the name in the bar is offered GitHub's own list, and their filter
 * route answers alphabetically: a reader who moves between three repositories all day was
 * given `Aditechweb3/web3` at the top of a hundred and fifty, and the three they wanted
 * were spread down the scroll. Nothing in that payload says when anything last changed, so
 * the only account of what matters to this reader is the one this file keeps.
 *
 * In `localStorage` rather than in settings, for the same two reasons `remembered.ts`
 * gives. It is a trace of where somebody went rather than one of the fixed choices the
 * settings store exists to hold — and it is read synchronously, which is what lets the
 * switcher open already in the right order. An asynchronous read would open alphabetically
 * and rearrange itself under the pointer.
 *
 * Local rather than synced for a third reason: this changes on every navigation, and
 * `storage.sync` allows a hundred and twenty writes a minute across the whole extension.
 * A reader browsing quickly would spend that on a convenience.
 */

import { UndefinedOr } from "effect"
import { LATELY as KEY } from "./keeping"

/**
 * How many are kept.
 *
 * The band exists to save a reader the scroll, so a band long enough to need scrolling
 * would be the thing it is meant to remove. Eight is a menu's worth without one.
 */
const KEPT = 8

/**
 * Storage that cannot throw.
 *
 * A private window, a profile with storage turned off, and a quota already spent all
 * reach here, and all three mean the same thing from the switcher's side: nowhere has
 * been visited, so GitHub's own order stands. None is a reason to fail to draw the bar.
 */
const held = UndefinedOr.liftThrowable((): Storage => localStorage)
const read = UndefinedOr.liftThrowable((store: Storage, key: string) => store.getItem(key))
const write = UndefinedOr.liftThrowable((store: Storage, key: string, value: string) => {
  store.setItem(key, value)
})

const addresses = UndefinedOr.liftThrowable((said: string): ReadonlyArray<string> => {
  const held = JSON.parse(said) as unknown
  if (!Array.isArray(held)) return []
  return held.filter((one): one is string => typeof one === "string")
})

/** Where the reader has been, the most recent first. `owner/repo`, which is an address. */
export const visited = (): ReadonlyArray<string> => {
  const store = held()
  if (store === undefined) return []

  const said = read(store, KEY)
  if (said === undefined || said === null) return []

  // Written by us and still worth checking: this is one flat space that anything on the
  // page can write into, and a bad line is a switcher in GitHub's order, not a failure.
  return addresses(said) ?? []
}

/** Record that a repository is being read. Moves one already known up rather than repeating it. */
export const visiting = (nameWithOwner: string): void => {
  const store = held()
  if (store === undefined) return

  const kept = [nameWithOwner, ...visited().filter((one) => one !== nameWithOwner)].slice(0, KEPT)
  write(store, KEY, JSON.stringify(kept))
}
