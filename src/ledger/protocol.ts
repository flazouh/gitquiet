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
import type { Found } from "./uses"
import type { Borrowed, Use } from "./writings"

export const LEDGER_ASK = "gitquiet/ledger-ask" as const
export const LEDGER_READY = "gitquiet/ledger-ready" as const
export const LEDGER_READY_WORK = "gitquiet/ledger-ready-work" as const
export const LEDGER_WARM = "gitquiet/ledger-warm" as const
export const LEDGER_WARM_WORK = "gitquiet/ledger-warm-work" as const
export const LEDGER_NAMES = "gitquiet/ledger-names" as const
export const LEDGER_NAMES_WORK = "gitquiet/ledger-names-work" as const
export const LEDGER_ACROSS = "gitquiet/ledger-across" as const
export const LEDGER_ACROSS_WORK = "gitquiet/ledger-across-work" as const
export const LEDGER_BEYOND = "gitquiet/ledger-beyond" as const
export const LEDGER_BEYOND_WORK = "gitquiet/ledger-beyond-work" as const
export const LEDGER_WORK = "gitquiet/ledger-work" as const
export const LEDGER_ANSWER = "gitquiet/ledger-answer" as const

/** Which of the three questions is being asked. */
export type Question =
  | { readonly of: "writingAt"; readonly at: Spot }
  | { readonly of: "writingNamed"; readonly name: string }
  | { readonly of: "usesIn"; readonly writing: Writing }
  | { readonly of: "writingsIn" }

/**
 * Get ready to be asked about a file, without asking anything about it.
 *
 * A reader who holds Command waits, once, for a worker to wake, a document to
 * open, a runtime to compile and a megabyte and a half of grammar to arrive.
 * None of that is a question about a name and none of it needs the key to be
 * down: a pane that has drawn a file already knows what language it is in.
 *
 * Nothing is parsed and nothing is answered. It is a door opened before anybody
 * walks through it.
 */
export type LedgerReady = {
  readonly kind: typeof LEDGER_READY
  readonly path: string
}

export type LedgerReadyWork = Omit<LedgerReady, "kind"> & {
  readonly kind: typeof LEDGER_READY_WORK
}

export type LedgerAsk = {
  readonly kind: typeof LEDGER_ASK
  readonly path: string
  readonly text: string
  readonly key?: string
  /** Which repository at which commit, for the tier that keeps a program per one. */
  readonly owner?: string
  readonly repo?: string
  readonly sha?: string
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
  /**
   * Whether to build the exact tier behind this reading.
   *
   * Absent or false and the Ledger is what it has always been: fast, every
   * language, and honest about what it is guessing. True and a compiler is
   * fetched and a program built, after the answer rather than before it.
   */
  readonly exact?: boolean
}

export type LedgerWarmWork = Omit<LedgerWarm, "kind"> & {
  readonly kind: typeof LEDGER_WARM_WORK
}

/** What a warm Ledger came to, or why it did not. */
export type LedgerWarmth = {
  readonly ready: boolean
  readonly read?: number
  readonly skipped?: number
  /** How many files had to be parsed, which on a second visit should be none. */
  readonly parsed?: number
  /** True where nothing was fetched, because this commit was already known. */
  readonly kept?: boolean
  /**
   * Whether a compiler is ready for this repository.
   *
   * Asked for rather than assumed: the tier is built after the answer, so a
   * warm that returns saying it was wanted is not a warm that has one. A screen
   * that wants to say "these answers are exact now" reads this, and so does
   * anything measuring what one costs.
   */
  readonly exactReady?: boolean
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

/** Everywhere in a repository that means one Writing. */
export type LedgerAcross = {
  readonly kind?: undefined
  readonly uses: ReadonlyArray<Found>
  readonly ready: boolean
  /** True where a compiler answered, which is when every Use is Sure. */
  readonly exact?: boolean
}

export type LedgerAcrossAsk = {
  readonly kind: typeof LEDGER_ACROSS
  readonly owner: string
  readonly repo: string
  readonly sha: string
  /** The Writing being asked about: its name, its file, and the line it is on. */
  readonly name: string
  readonly path: string
  readonly line: number
  /** The column the name starts at, which the exact tier needs and the other does not. */
  readonly column?: number
  readonly most?: number
}

export type LedgerAcrossWork = Omit<LedgerAcrossAsk, "kind"> & {
  readonly kind: typeof LEDGER_ACROSS_WORK
}

/**
 * A name borrowed from a package rather than from a path.
 *
 * `import { one } from "@yourorg/thing"` — which is not a path, and resolves
 * against a folder an archive does not carry. Where it does resolve is a
 * repository, and `src/ledger/packages.ts` is how one is guessed at and checked.
 */
export type LedgerBeyond = {
  readonly kind: typeof LEDGER_BEYOND
  /** The repository doing the importing, for a guess about whose package this is. */
  readonly owner: string
  readonly repo: string
  readonly sha: string
  /** As written: `@yourorg/thing`, `thing/deep`. */
  readonly specifier: string
  /** The name that file borrowed under it. */
  readonly name: string
  /** Whether a registry may be asked about a package nothing here holds. */
  readonly registry?: boolean
}

export type LedgerBeyondWork = Omit<LedgerBeyond, "kind"> & {
  readonly kind: typeof LEDGER_BEYOND_WORK
}

/** Where a borrowed name turned out to be written, and in whose repository. */
export type LedgerFound = {
  readonly owner?: string
  readonly repo?: string
  /** The branch or commit the answer is at, for an address that means it. */
  readonly ref?: string
  readonly path?: string
  readonly line?: number
  readonly name?: string
  readonly signature?: string
  /** True where the package turned out to be one this repository holds itself. */
  readonly here?: boolean
  readonly why?: string
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

export const isLedgerReady = (message: unknown): message is LedgerReady =>
  kindIs(message, LEDGER_READY)

export const isLedgerReadyWork = (message: unknown): message is LedgerReadyWork =>
  kindIs(message, LEDGER_READY_WORK)

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

export const isLedgerAcross = (message: unknown): message is LedgerAcrossAsk =>
  kindIs(message, LEDGER_ACROSS)

export const isLedgerAcrossWork = (message: unknown): message is LedgerAcrossWork =>
  kindIs(message, LEDGER_ACROSS_WORK)

export const isLedgerBeyond = (message: unknown): message is LedgerBeyond =>
  kindIs(message, LEDGER_BEYOND)

export const isLedgerBeyondWork = (message: unknown): message is LedgerBeyondWork =>
  kindIs(message, LEDGER_BEYOND_WORK)
