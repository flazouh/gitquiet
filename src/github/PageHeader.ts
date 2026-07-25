import { Data, Effect, Schema } from "effect"

export const PullRequestHeader = Schema.Struct({
  number: Schema.Number,
  title: Schema.String
})

export type PullRequestHeader = typeof PullRequestHeader["Type"]

const LayoutPayload = Schema.Struct({
  payload: Schema.Struct({
    pullRequestsLayoutRoute: Schema.Struct({
      pullRequest: PullRequestHeader
    })
  })
})

const ChangesPayload = Schema.Struct({
  payload: Schema.Struct({
    pullRequestsChangesRoute: Schema.Struct({
      pullRequest: PullRequestHeader
    })
  })
})

export class EmbeddedPayloadUnavailable extends Data.TaggedError(
  "EmbeddedPayloadUnavailable"
)<{
  readonly reason: "no-embedded-script" | "not-json"
}> {}

const EMBEDDED_SELECTOR = 'script[data-target="react-app.embeddedData"]'

const decodeLayout = Schema.decodeUnknownEffect(LayoutPayload)
const decodeChanges = Schema.decodeUnknownEffect(ChangesPayload)

/**
 * GitHub's pull request pages ship their own data as JSON in the document. The
 * layout route carries the header on every sub-page; the changes route is the
 * fallback for pages that render without it.
 */
export const readPullRequestHeader = Effect.fn("readPullRequestHeader")(
  function* (source: Document) {
    const element = source.querySelector(EMBEDDED_SELECTOR)
    if (element === null) {
      return yield* new EmbeddedPayloadUnavailable({ reason: "no-embedded-script" })
    }

    const parsed = yield* Effect.try({
      try: (): unknown => JSON.parse(element.textContent ?? ""),
      catch: () => new EmbeddedPayloadUnavailable({ reason: "not-json" })
    })

    return yield* decodeLayout(parsed).pipe(
      Effect.map((data) => data.payload.pullRequestsLayoutRoute.pullRequest),
      Effect.catch(() =>
        decodeChanges(parsed).pipe(
          Effect.map((data) => data.payload.pullRequestsChangesRoute.pullRequest)
        )
      )
    )
  }
)
