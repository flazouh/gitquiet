import type { DiffSide, Picked } from "../ports/Renderer"

/**
 * Something written about some lines, and not sent anywhere yet.
 *
 * Nothing here knows how a comment reaches GitHub — that transport is still
 * being worked out — so a draft is the whole of what the interface can promise:
 * it is kept for as long as the page is open, against the lines it is about,
 * and it says on its face that it has not been posted.
 */
export type Draft = {
  readonly path: string
  readonly side: DiffSide
  readonly from: number
  readonly to: number
  readonly body: string
}

/** Where a draft hangs, as a string, so a row can be found again. */
export const draftKey = (at: Pick<Draft, "path" | "side" | "from" | "to">): string =>
  `${at.path}:${at.side}:${at.from}-${at.to}`

export const draftAt = (path: string, picked: Picked): Omit<Draft, "body"> => ({
  path,
  side: picked.side,
  from: picked.from,
  to: picked.to
})

/**
 * The draft written down, replacing whatever was against those lines before.
 *
 * Two drafts on one range would be two boxes in one row, and the second edit of
 * a comment is an edit rather than a second comment.
 */
export const saveDraft = (drafts: ReadonlyArray<Draft>, draft: Draft): ReadonlyArray<Draft> => {
  const key = draftKey(draft)
  const found = drafts.some((held) => draftKey(held) === key)
  return found ? drafts.map((held) => (draftKey(held) === key ? draft : held)) : [...drafts, draft]
}

export const dropDraft = (drafts: ReadonlyArray<Draft>, key: string): ReadonlyArray<Draft> =>
  drafts.filter((held) => draftKey(held) !== key)

export const draftsIn = (drafts: ReadonlyArray<Draft>, path: string): ReadonlyArray<Draft> =>
  drafts.filter((held) => held.path === path)
