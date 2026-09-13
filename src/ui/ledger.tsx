import { Effect, Option } from "effect"
import { createContext, useContext, type ReactNode } from "react"
import { LedgerUnavailable, type Ledger } from "../ports/Ledger"

/**
 * How this screen finds out where a name is written, or that it cannot.
 *
 * The same shape as `renderer.tsx`, and for the same reason: the interface knows
 * a Ledger by its three questions and not by what answers them. In the extension
 * that is a message to the offscreen document, where a grammar may be compiled;
 * on a desktop build it could be a language server. Both are the shell's
 * business, and this is where the shell says which.
 */
const NOTHING: Ledger = {
  writingAt: () => Effect.succeed(Option.none()),
  writingNamed: () => Effect.succeed(Option.none()),
  usesIn: () => Effect.succeed([]),
  writingsIn: () => Effect.succeed([]),
  warm: () => Effect.succeed({ ready: false }),
  namesLike: () => Effect.succeed({ places: [], ready: false })
}

/**
 * No Ledger, which answers every question with nothing rather than failing.
 *
 * Deliberately not a failure, unlike the renderer's. A screen without a renderer
 * has to say so — the reader asked to see a diff and there is none. A screen
 * without a Ledger has nothing to say: the reader asked for nothing, the file
 * reads exactly as it does today, and no underline appears. Every screen drawn
 * in a test gets this, so the case is exercised everywhere rather than only
 * where a document failed to open.
 */
const Held = createContext<Ledger>(NOTHING)

export const LedgerProvider = ({
  ledger,
  children
}: {
  readonly ledger: Ledger
  readonly children: ReactNode
}) => <Held.Provider value={ledger}>{children}</Held.Provider>

export const useLedger = (): Ledger => useContext(Held)

/** For a screen that wants to know it has nothing, rather than asking and getting none. */
export const noLedger: Ledger = NOTHING

export { LedgerUnavailable }
