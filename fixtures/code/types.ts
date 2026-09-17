/**
 * A type worth following, and the one this fixture is about.
 *
 * Every shape a type is written in below is a shape a reader presses in a real
 * file: an annotation, a return, a type argument, a member, a union, and the
 * name in an `extends`. What they have in common is that none of them is a
 * value — a resolver that reads only `identifier` and never `type_identifier`
 * answers every one of them with nothing, and a reader is told a type nobody
 * could compile without is used nowhere.
 */
export type Secret = { readonly id: string }

export interface Vault {
  /** A member's annotation, which is inside a body and still a use. */
  readonly held: Secret
}

/** An `extends` clause, where the name is neither a call nor an annotation. */
export interface Locked extends Vault {
  readonly at: number
}

/** A parameter's annotation and a return, on one line. */
export const take = (vault: Vault): Secret => vault.held

/** A type argument, which is a name inside a name. */
export const every: ReadonlyArray<Secret> = []

/** A union, where the name sits beside something that is not one. */
export type Maybe = Secret | null

/**
 * A scope of its own that binds the spelling declared at the top of this file.
 *
 * The generic is a different thing with the same name, exactly as a local
 * shadowing an outer value is, and a list of the type's uses that counted it
 * would be a list of a word rather than of a name.
 */
export const hides = <Secret,>(one: Secret): Secret => one

/**
 * A signature with no body, which is what a `.d.ts` is made of.
 *
 * It binds a name and opens a scope exactly as a declaration with a body does.
 * Neither was true before: the name was bound nowhere, so it could not be
 * followed at all, and the scope was the whole file, so the generic here and
 * the generic in the signature below were read as a single thing.
 */
export function unbodied<Held>(kept: Held): Held

export function alsoUnbodied<Held>(kept: Held): Held

/** An interface's members, whose parameters used to leak into the file. */
export interface Signatures {
  first<Held>(kept: Held): Held
  second(kept: string): void
}

/** What this file passes on from beside it, which is a borrow and not a Writing. */
export { alsoUnbodied as passedAlong } from "./whole"
export * from "./whole"
