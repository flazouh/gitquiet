import { Context, Effect, Layer, Schema } from "effect"
import { storage } from "wxt/utils/storage"
import type { CourtOverride } from "../domain/Attention"
import type { PullRequestRef } from "../domain/PullRequestRef"

/**
 * A Participant's corrections to Court assignment. Court derivation is a
 * heuristic, so it will sometimes be wrong; a correction has to outlive the
 * push that follows it, which means it has to be stored.
 */
export class CourtOverrides extends Context.Service<
  CourtOverrides,
  {
    readonly all: (reference: PullRequestRef) => Effect.Effect<ReadonlyArray<CourtOverride>>
    readonly correct: (
      reference: PullRequestRef,
      override: CourtOverride
    ) => Effect.Effect<void>
  }
>()("CourtOverrides") {}

const Stored = Schema.Array(
  Schema.Struct({
    itemId: Schema.String,
    court: Schema.Literals(["your-move", "waiting-on-others", "settled"])
  })
)

const decodeStored = Schema.decodeUnknownEffect(Stored)

const withoutItem = (
  overrides: ReadonlyArray<CourtOverride>,
  itemId: string
): ReadonlyArray<CourtOverride> => overrides.filter((entry) => entry.itemId !== itemId)

const keyFor = (reference: PullRequestRef): `local:${string}` =>
  `local:courts:${reference.owner}/${reference.repo}/${reference.number}`

/**
 * Keeps corrections in memory for as long as the returned layer is reused,
 * which is what lets a test prove a correction survives a re-render. Each call
 * is a separate store.
 */
export const layerMemory = () => {
  const byPullRequest = new Map<string, ReadonlyArray<CourtOverride>>()

  return Layer.succeed(CourtOverrides, {
    all: (reference) => Effect.succeed(byPullRequest.get(keyFor(reference)) ?? []),
    correct: (reference, override) =>
      Effect.sync(() => {
        const key = keyFor(reference)
        const existing = byPullRequest.get(key) ?? []
        byPullRequest.set(key, [...withoutItem(existing, override.itemId), override])
      })
  })
}

/**
 * Reads and writes extension storage. A store we cannot read is treated as
 * empty rather than fatal: losing a correction is a small harm, refusing to
 * render the Control Center is a large one.
 */
export const layer = Layer.succeed(CourtOverrides, {
  all: Effect.fn("CourtOverrides.all")(function* (reference: PullRequestRef) {
    const raw = yield* Effect.tryPromise({
      try: (): Promise<unknown> => storage.getItem(keyFor(reference)),
      catch: () => new Error("storage unavailable")
    }).pipe(Effect.catch(() => Effect.succeed(null)))

    if (raw === null) return []

    return yield* decodeStored(raw).pipe(Effect.catch(() => Effect.succeed([])))
  }),
  correct: Effect.fn("CourtOverrides.correct")(function* (
    reference: PullRequestRef,
    override: CourtOverride
  ) {
    const key = keyFor(reference)
    const raw = yield* Effect.tryPromise({
      try: (): Promise<unknown> => storage.getItem(key),
      catch: () => new Error("storage unavailable")
    }).pipe(Effect.catch(() => Effect.succeed(null)))

    const existing = yield* decodeStored(raw ?? []).pipe(Effect.catch(() => Effect.succeed([])))
    const next = [...withoutItem(existing, override.itemId), override]

    yield* Effect.tryPromise({
      try: (): Promise<void> => storage.setItem(key, next),
      catch: () => new Error("storage unavailable")
    }).pipe(Effect.catch(() => Effect.void))
  })
})
