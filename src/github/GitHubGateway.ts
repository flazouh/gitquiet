import { Context, Data, Effect, Layer } from "effect"
import type { PullRequestSnapshot } from "../domain/PullRequest"
import type { PullRequestRef } from "../domain/PullRequestRef"
import { type RawPayloads, toSnapshot } from "./snapshot"

export type GatewayFailure = "unreachable" | "rejected" | "undecodable" | "not-recorded"

export class GatewayError extends Data.TaggedError("GatewayError")<{
  readonly reference: PullRequestRef
  readonly route: string
  readonly reason: GatewayFailure
  readonly detail: string
}> {}

/**
 * The only adapter to GitHub, and the system's single seam. It speaks the
 * vocabulary in CONTEXT.md rather than GitHub's field names, so everything
 * above it is insulated from both GitHub's schema and the choice of transport.
 */
export class GitHubGateway extends Context.Service<
  GitHubGateway,
  {
    readonly snapshot: (
      reference: PullRequestRef
    ) => Effect.Effect<PullRequestSnapshot, GatewayError>
  }
>()("GitHubGateway") {}

const CHANGES = "/changes"
const STATUS_CHECKS = "/page_data/status_checks"
const MERGE_BOX = "/page_data/merge_box?merge_method=MERGE&bypass_requirements=false"

// GitHub answers 406 to these routes without the XMLHttpRequest header.
const REQUIRED_HEADERS = {
  Accept: "application/json",
  "X-Requested-With": "XMLHttpRequest"
}

const decodeInto = (reference: PullRequestRef, raw: RawPayloads) =>
  toSnapshot(reference, raw).pipe(
    Effect.catch((cause) =>
      Effect.fail(
        new GatewayError({
          reference,
          route: CHANGES,
          reason: "undecodable",
          detail: String(cause)
        })
      )
    )
  )

const fetchRoute = Effect.fn("fetchRoute")(function* (
  reference: PullRequestRef,
  route: string
) {
  const url = `https://github.com/${reference.owner}/${reference.repo}/pull/${reference.number}${route}`

  const response = yield* Effect.tryPromise({
    try: (): Promise<Response> =>
      fetch(url, { headers: REQUIRED_HEADERS, credentials: "include" }),
    catch: (cause) =>
      new GatewayError({ reference, route, reason: "unreachable", detail: String(cause) })
  })

  if (!response.ok) {
    return yield* new GatewayError({
      reference,
      route,
      reason: "rejected",
      detail: `HTTP ${response.status}`
    })
  }

  return yield* Effect.tryPromise({
    try: (): Promise<unknown> => response.json(),
    catch: (cause) =>
      new GatewayError({ reference, route, reason: "undecodable", detail: String(cause) })
  })
})

export const layer = Layer.succeed(GitHubGateway, {
  snapshot: Effect.fn("GitHubGateway.snapshot")(function* (reference: PullRequestRef) {
    const raw = yield* Effect.all(
      {
        changes: fetchRoute(reference, CHANGES),
        statusChecks: fetchRoute(reference, STATUS_CHECKS),
        mergeBox: fetchRoute(reference, MERGE_BOX)
      },
      { concurrency: "unbounded" }
    )

    return yield* decodeInto(reference, raw)
  })
})

export type Recording = {
  readonly reference: PullRequestRef
  readonly payloads: RawPayloads
}

const sameReference = (left: PullRequestRef, right: PullRequestRef): boolean =>
  left.owner === right.owner && left.repo === right.repo && left.number === right.number

/**
 * The same decoding path as the live gateway, fed from recorded payloads
 * instead of the network, so tests exercise real decoding rather than a
 * hand-written stand-in that cannot drift with GitHub.
 */
export const layerFromRecordings = (recordings: ReadonlyArray<Recording>) =>
  Layer.succeed(GitHubGateway, {
    snapshot: (reference: PullRequestRef) => {
      const recording = recordings.find((candidate) =>
        sameReference(candidate.reference, reference)
      )
      if (recording === undefined) {
        return Effect.fail(
          new GatewayError({
            reference,
            route: CHANGES,
            reason: "not-recorded",
            detail: `No recording for ${reference.owner}/${reference.repo}#${reference.number}`
          })
        )
      }
      return decodeInto(reference, recording.payloads)
    }
  })
