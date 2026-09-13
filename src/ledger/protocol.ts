/**
 * What the page and the offscreen document say to each other about a file.
 *
 * Two words for the one question, as `mermaidProtocol.ts` has: the page asks
 * with the first, the worker relays with the second. One word for both would
 * have the worker hear its own relay and answer itself forever — which is not a
 * guess, it is what plan 009's probe did before it was given a second word.
 */

import type { Spot, Writing } from "../ports/Ledger"
import type { Place } from "./ledger"
import type { Borrowed, Use } from "./writings"

export const LEDGER_ASK = "gitquiet/ledger-ask" as const
export const LEDGER_WARM = "gitquiet/ledger-warm" as const
export const LEDGER_WARM_WORK = "gitquiet/ledger-warm-work" as const
export const LEDGER_NAMES = "gitquiet/ledger-names" as const
export const LEDGER_NAMES_WORK = "gitquiet/ledger-names-work" as const
export const LEDGER_WORK = "gitquiet/ledger-work" as const
export const LEDGER_ANSWER = "gitquiet/ledger-answer" as const

/** Which of the three questions is being asked. */
export type Question =
  | { readonly of: "writingAt"; readonly at: Spot }
  | { readonly of: "writingNamed"; readonly name: string }
  | { readonly of: "usesIn"; readonly writing: Writing }
  | { readonly of: "writingsIn" }

export type LedgerAsk = {
  readonly kind: typeof LEDGER_ASK
  readonly path: string
  readonly text: string
  readonly key?: string
  readonly question: Question
}

export type LedgerWork = Omit<LedgerAsk, "kind"> & { readonly kind: typeof LEDGER_WORK }

/**
 * What came back, with nothing in it that a message cannot carry.
 *
 * `writing` is null where the Name has no Writing, which is the common answer
 * and not a failure. `why` is set only where nothing could be asked at all.
 */
export type LedgerAnswer = {
  readonly kind: typeof LEDGER_ANSWER
  readonly writing?: Writing | null
  /** Where a borrowed name said it came from, when that is the answer. */
  readonly borrowed?: Borrowed
  readonly writings?: ReadonlyArray<Writing>
  readonly uses?: ReadonlyArray<Use>
  readonly why?: string
}

/**
 * Read a repository, once, so the questions one file cannot answer can be.
 *
 * The sha and not the branch: a branch moves, and a Ledger that moved with it
 * would answer about a commit the reader is not looking at.
 */
export type LedgerWarm = {
  readonly kind: typeof LEDGER_WARM
  readonly owner: string
  readonly repo: string
  readonly sha: string
}

export type LedgerWarmWork = Omit<LedgerWarm, "kind"> & {
  readonly kind: typeof LEDGER_WARM_WORK
}

/** What a warm Ledger came to, or why it did not. */
export type LedgerWarmth = {
  readonly ready: boolean
  readonly read?: number
  readonly skipped?: number
  readonly why?: string
}

/** Every name in the repository, for a reader typing at it. */
export type LedgerNames = {
  readonly kind: typeof LEDGER_NAMES
  readonly owner: string
  readonly repo: string
  readonly sha: string
  readonly query: string
  readonly most?: number
}

export type LedgerNamesWork = Omit<LedgerNames, "kind"> & {
  readonly kind: typeof LEDGER_NAMES_WORK
}

export type LedgerPlaces = {
  readonly places: ReadonlyArray<Place>
  /** False where nothing has been read for this commit yet. */
  readonly ready: boolean
}

const kindIs = (message: unknown, kind: string): boolean =>
  typeof message === "object" && message !== null && (message as { kind?: unknown }).kind === kind

export const isLedgerAsk = (message: unknown): message is LedgerAsk =>
  kindIs(message, LEDGER_ASK)

export const isLedgerWork = (message: unknown): message is LedgerWork =>
  kindIs(message, LEDGER_WORK)

export const isLedgerAnswer = (message: unknown): message is LedgerAnswer =>
  kindIs(message, LEDGER_ANSWER)

export const isLedgerWarm = (message: unknown): message is LedgerWarm =>
  kindIs(message, LEDGER_WARM)

export const isLedgerWarmWork = (message: unknown): message is LedgerWarmWork =>
  kindIs(message, LEDGER_WARM_WORK)

export const isLedgerNames = (message: unknown): message is LedgerNames =>
  kindIs(message, LEDGER_NAMES)

export const isLedgerNamesWork = (message: unknown): message is LedgerNamesWork =>
  kindIs(message, LEDGER_NAMES_WORK)
