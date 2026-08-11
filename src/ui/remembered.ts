/**
 * What a list was last filtered to, kept between visits.
 *
 * In `localStorage` rather than in extension settings for two reasons. It is a
 * line of text the reader typed, not one of the fixed choices the settings store
 * exists to hold — and it is read synchronously, which is what lets the box come
 * back already filled in. An asynchronous read would draw the whole list
 * unfiltered for a frame and then take most of it away again, which reads as the
 * page changing its mind.
 *
 * Remembered per list. `author:seawatts` means something in the repository whose
 * rows they are on and nothing anywhere else, so the Working Set and each
 * repository keep their own.
 */

import { UndefinedOr } from "effect"
import { FILTER as KEY } from "./keeping"

/**
 * Storage that cannot throw.
 *
 * A private window, a profile with storage turned off, and a quota already spent
 * all reach here, and all three mean the same thing from a list's side: nothing
 * was remembered. None of them is a reason to fail to draw the rows, so each of
 * the three calls answers with nothing instead of raising.
 */
const held = UndefinedOr.liftThrowable((): Storage => localStorage)
const read = UndefinedOr.liftThrowable((store: Storage, key: string) => store.getItem(key))
const write = UndefinedOr.liftThrowable((store: Storage, key: string, value: string) => {
  store.setItem(key, value)
})
const drop = UndefinedOr.liftThrowable((store: Storage, key: string) => {
  store.removeItem(key)
})

export const rememberedFilter = (scope: string): string => {
  const store = held()
  if (store === undefined) return ""
  return read(store, `${KEY}${scope}`) ?? ""
}

export const rememberFilter = (scope: string, query: string): void => {
  const store = held()
  if (store === undefined) return

  // Nothing asked for is the key removed, so that a reader who filters once and
  // clears it is left exactly as they were before they started.
  if (query.trim().length === 0) drop(store, `${KEY}${scope}`)
  else write(store, `${KEY}${scope}`, query)
}
