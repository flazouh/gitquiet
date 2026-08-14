/**
 * Reading an answer without saying where in the payload it sits.
 *
 * Every shape change GitHub has served us has been the same one: the answer moved
 * under a new key and nothing inside it changed. `payload.blackbirdSearchRoute` on
 * 2026-08-14, `payload.commitsRefRoute` and `payload.commitRoute` on 2026-08-15, and
 * `payload.pullRequestsChangesRoute` before either. Each blanked a screen, each was
 * fixed by naming the new key, and each fix taught this codebase nothing about the
 * next one.
 *
 * So a route's schema describes the answer and not the envelope, and the search below
 * finds it. A rename then costs a reader one extra decode attempt, and costs a
 * maintainer nothing.
 *
 * What this deliberately does not do is guess. Two shapes matching at the same depth
 * is a refusal, because a screen drawn from whichever one sorted first is a screen
 * that can show the wrong facts, and the whole reason this gateway refuses a payload
 * it cannot read is that a wrong fact is worse than a missing page.
 */

import { Effect, Option, Schema } from "effect"

/**
 * How far in to look.
 *
 * Two is what their envelopes cost: `payload` and then the route's own key inside it.
 * Three leaves room for one more without turning a read into a walk, and the cap is
 * what keeps a 1.2MB tree listing to a handful of decode attempts.
 */
const DEEP = 3

/** Their own values, which are objects. An array is an answer's content, not its envelope. */
const wrappersIn = (value: unknown): ReadonlyArray<readonly [string, unknown]> =>
  typeof value !== "object" || value === null || Array.isArray(value)
    ? []
    : Object.entries(value as Record<string, unknown>)

/**
 * Everywhere an answer could be, shallowest first, as a path and a value.
 *
 * Breadth first, because depth first would reach a copy of the answer nested inside
 * the answer before it reached the answer.
 */
const placesIn = (raw: unknown): ReadonlyArray<readonly [string, unknown]> => {
  const places: Array<readonly [string, unknown]> = [["", raw]]
  let edge: ReadonlyArray<readonly [string, unknown]> = [["", raw]]

  for (let deep = 0; deep < DEEP; deep += 1) {
    const next: Array<readonly [string, unknown]> = []
    for (const [path, value] of edge) {
      for (const [key, held] of wrappersIn(value)) {
        next.push([path === "" ? key : `${path}.${key}`, held])
      }
    }
    places.push(...next)
    edge = next
  }

  return places
}

/**
 * Where their envelope ends, which is where a failure is worth reporting from.
 *
 * A read that found nothing has to say what is missing, and saying it about the top of
 * the body names whatever key the envelope holds rather than the field that changed.
 * Their envelope is `payload` and then one key inside it, so following that as far as
 * it goes lands on the answer itself, and the schema's complaint there names the field.
 */
const endOfTheEnvelope = (raw: unknown): unknown => {
  let at = raw

  for (let deep = 0; deep < DEEP; deep += 1) {
    const keys = wrappersIn(at)
    const named = keys.find(([key]) => key === "payload")
    const only = keys.length === 1 ? keys[0] : undefined
    const next = named ?? only
    // An array is content, so a payload holding one row list is the end of the
    // envelope and the place the schema should be asked to complain about.
    if (next === undefined || wrappersIn(next[1]).length === 0) return at
    at = next[1]
  }

  return at
}

/**
 * Every place the schema decodes, at the shallowest depth where anything does.
 *
 * One depth at a time, so that two answers at that depth are seen as two rather than
 * resolved by whichever came first.
 */
const searching = <A>(
  raw: unknown,
  attempt: (value: unknown) => Option.Option<A>
): ReadonlyArray<readonly [string, A]> => {
  const found: Array<readonly [string, A]> = []
  let deep = -1

  for (const [path, value] of placesIn(raw)) {
    const at = path === "" ? 0 : path.split(".").length
    if (found.length > 0 && at > deep) break

    const held = attempt(value)
    if (Option.isSome(held)) {
      found.push([path, held.value])
      deep = at
    }
  }

  return found
}

const ambiguous = (found: ReadonlyArray<readonly [string, unknown]>): Error =>
  new Error(
    `the answer decodes at ${found.length} places: ${
      found.map(([path]) => (path === "" ? "the payload itself" : path)).join(", ")
    }`
  )

/**
 * A read that finds its own answer.
 *
 * The failure where nothing matched is the schema's own complaint, made at the end of
 * their envelope, so it names the field GitHub stopped sending rather than listing the
 * eleven places the answer is not.
 */
export const whereverItIs = <S extends Schema.ConstraintDecoder<unknown>>(schema: S) => {
  const attempt = Schema.decodeUnknownOption(schema)
  const complaining = Schema.decodeUnknownEffect(schema)

  return (raw: unknown): Effect.Effect<S["Type"], unknown> => {
    const found = searching<S["Type"]>(raw, attempt)
    const [first] = found

    if (first === undefined) return complaining(endOfTheEnvelope(raw))
    if (found.length > 1) return Effect.fail(ambiguous(found))

    return Effect.succeed(first[1])
  }
}

/**
 * The same search, for a fact a screen can do without.
 *
 * An Option rather than a failure, because the caller has nothing to report: a file
 * GitHub does not render has no rendering, and a repository with no About panel draws
 * without one. Two matches are none, for the reason the refusal above gives.
 */
export const maybeWherever = <S extends Schema.ConstraintDecoder<unknown>>(schema: S) => {
  const attempt = Schema.decodeUnknownOption(schema)

  return (raw: unknown): Option.Option<S["Type"]> => {
    const found = searching<S["Type"]>(raw, attempt)
    return found.length === 1 && found[0] !== undefined ? Option.some(found[0][1]) : Option.none()
  }
}

/**
 * The same search, across the several payloads one document carries.
 *
 * A repository page holds the code view's own data, the layout around it and the About
 * panel as three payloads in one script, and a file page holds four. Which of them holds
 * what a caller wants is decided by which one the schema decodes in, rather than by a
 * name a reader had to know.
 */
export const whereverAmong = <S extends Schema.ConstraintDecoder<unknown>>(schema: S) => {
  const find = whereverItIs(schema)

  return (payloads: ReadonlyArray<unknown>): Effect.Effect<S["Type"], unknown> =>
    payloads.length === 0
      ? find(undefined)
      : Effect.firstSuccessOf(payloads.map((payload) => find(payload)))
}

/** The same again, for a fact a screen can do without. */
export const maybeAmong = <S extends Schema.ConstraintDecoder<unknown>>(schema: S) => {
  const find = maybeWherever(schema)

  return (payloads: ReadonlyArray<unknown>): Option.Option<S["Type"]> => {
    for (const payload of payloads) {
      const held = find(payload)
      if (Option.isSome(held)) return held
    }
    return Option.none()
  }
}
