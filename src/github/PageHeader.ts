import { Data, Effect, Schema } from "effect"
import { whereverItIs } from "./wherever"

export const PullRequestHeader = Schema.Struct({
  number: Schema.Number,
  title: Schema.String
})

export type PullRequestHeader = typeof PullRequestHeader["Type"]

/**
 * The header, wherever in the document's own data it sits.
 *
 * Their layout route carries it on every sub-page and their changes route carries it on
 * the pages that render without the layout. One shape reads both, and reads whatever
 * they rename either to.
 */
const Held = Schema.Struct({ pullRequest: PullRequestHeader })

export class EmbeddedPayloadUnavailable extends Data.TaggedError(
  "EmbeddedPayloadUnavailable"
)<{
  readonly reason: "no-embedded-script" | "not-json"
}> {}

const EMBEDDED_SELECTOR = 'script[data-target="react-app.embeddedData"]'

const decodeHeader = whereverItIs(Held)

/**
 * GitHub's pull request pages ship their own data as JSON in the document, and the
 * header is in it wherever this week's route names put it.
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

    return yield* decodeHeader(parsed).pipe(Effect.map((held) => held.pullRequest))
  }
)
