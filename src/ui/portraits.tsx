import { Effect, Option } from "effect"
import { createContext, useContext, type ReactNode } from "react"
import type { Portrait } from "../domain/portrait"

/** Reads who somebody is, for the card behind their face. */
export type Look = (login: string) => Effect.Effect<Option.Option<Portrait>>

/** Reads how much somebody has done, for the last line of that card. */
export type Count = (login: string) => Effect.Effect<Option.Option<number>>

/** The two reads a face needs, handed in from outside. */
export type Portraits = {
  readonly look: Look
  readonly count: Count
}

/**
 * Nobody, which is what a face falls back to when nothing has been provided.
 *
 * The same answer a failed read gives, and it has to be an answer rather than a
 * throw: every field of a portrait is already optional, so a card with none of
 * them is a card that draws the login and the avatar and stops. Which is what a
 * face outside a provider should do — an interface built against a platform with
 * no hovercards is not an interface that should crash on hover.
 */
const NOBODY: Portraits = {
  look: () => Effect.succeed(Option.none()),
  count: () => Effect.succeed(Option.none())
}

const Reads = createContext<Portraits>(NOBODY)

/**
 * Says how faces on this screen are looked up.
 *
 * Context rather than a prop threaded down, because a face appears nine levels
 * from the screen in a commit's author line and in a merge card's avatars, and
 * every component between them would otherwise carry two functions it has no
 * use for.
 *
 * Provided by whatever is running the interface, never by anything in here. On
 * GitHub's own page the reads are their hovercard routes; anywhere else they are
 * whatever that platform can answer. This file is the seam between the two and
 * knows about neither.
 */
export const PortraitsProvider = ({
  reads,
  children
}: {
  readonly reads: Portraits
  readonly children: ReactNode
}) => <Reads.Provider value={reads}>{children}</Reads.Provider>

export const usePortraits = (): Portraits => useContext(Reads)
