import { Effect } from "effect"
import { decodeGistLabels, encodeGistLabels, type KeptGists } from "../domain/gistLabels"
import type { KeyValue } from "../ports/KeyValue"

/**
 * One key, so a reader's other synced settings are read and written
 * untouched — this is not the `Settings` store, and does not share its key.
 */
const KEY = "gistLabels"

/** Every gist a reader has marked, as they were last kept. */
export const readKeptGists = (area: KeyValue): Effect.Effect<KeptGists, unknown> =>
  Effect.tryPromise(() => area.get(KEY)).pipe(
    Effect.map((result) => decodeGistLabels(result[KEY] as string | undefined))
  )

/** Every gist a reader has marked, written back whole — there is no partial write. */
export const writeKeptGists = (area: KeyValue, kept: KeptGists): Effect.Effect<void, unknown> =>
  Effect.tryPromise(() => area.set({ [KEY]: encodeGistLabels(kept) }))

/**
 * The real storage, where an extension is running with the permission for
 * it — nothing where either is not true, the same two cases
 * `browserSettings` in `settings/browserStore.ts` folds into one.
 */
export const gistLabelsArea = (): KeyValue | undefined => {
  if (typeof browser === "undefined") return undefined
  return browser.storage?.sync
}
