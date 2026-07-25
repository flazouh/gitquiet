export type Court = "your-move" | "waiting-on-others" | "settled"

export type AttentionKind =
  | "thread"
  | "finding"
  | "file"
  | "check"
  | "review"
  | "merge-blocker"

export type ViewerRole = "author" | "reviewer"

export type AttentionItem = {
  /** Stable across syncs, so a manual Court correction survives a push. */
  readonly id: string
  readonly kind: AttentionKind
  readonly court: Court
  readonly title: string
  readonly detail: string
}

/**
 * One Control Center line: a group of Attention Items of the same kind sitting
 * in the same Court. Rows rather than individual items are what let a pull
 * request with twenty threads and thirty files fit on a single screen, and each
 * row is the mouth of a Queue.
 */
export type CourtRow = {
  readonly court: Court
  readonly kind: AttentionKind
  readonly items: ReadonlyArray<AttentionItem>
}

export type Attention = {
  readonly role: ViewerRole
  readonly items: ReadonlyArray<AttentionItem>
  readonly rows: ReadonlyArray<CourtRow>
  readonly yourMoveCount: number
}

export type CourtOverride = {
  readonly itemId: string
  readonly court: Court
}

export const COURTS: ReadonlyArray<Court> = ["your-move", "waiting-on-others", "settled"]
