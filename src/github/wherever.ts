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
    const found: Array<readonly [string, S["Type"]]> = []
    let deep = -1

    for (const [path, value] of placesIn(raw)) {
      const at = path === "" ? 0 : path.split(".").length
      // Everything at one depth is tried, so that two answers at that depth are seen
      // as two rather than resolved by whichever came first.
      if (found.length > 0 && at > deep) break

      const held = attempt(value)
      if (Option.isSome(held)) {
        found.push([path, held.value])
        deep = at
      }
    }

    const [first] = found
    if (first === undefined) return complaining(endOfTheEnvelope(raw))

    if (found.length > 1) {
      const where = found.map(([path]) => (path === "" ? "the payload itself" : path)).join(", ")
      return Effect.fail(new Error(`the answer decodes at ${found.length} places: ${where}`))
    }

    return Effect.succeed(first[1])
  }
}
