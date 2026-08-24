import { Effect } from "effect"
import type { Highlight } from "./loadHighlight"
import {
  HIGHLIGHT_REQUEST,
  isHighlightAnswer,
  type HighlightRequest
} from "./highlighterProtocol"

export type HighlightRuntime = {
  readonly sendMessage: (message: unknown) => PromiseLike<unknown>
}

/** Asks the extension worker to colour code without blocking the page renderer. */
export const highlightUsing = (
  runtime: HighlightRuntime,
  code: string,
  language: string,
  theme: string
): Effect.Effect<string | null> =>
  Effect.tryPromise({
    try: () =>
      runtime.sendMessage({
        kind: HIGHLIGHT_REQUEST,
        code,
        language,
        theme
      } satisfies HighlightRequest),
    catch: () => "highlighter-worker-unavailable" as const
  }).pipe(
    Effect.flatMap((answer) =>
      isHighlightAnswer(answer)
        ? Effect.succeed(answer.html)
        : Effect.fail("highlighter-worker-unavailable" as const)
    ),
    Effect.orElseSucceed(() => null)
  )

export const highlightThrough = (runtime: HighlightRuntime): Highlight =>
  (code, language, theme) => highlightUsing(runtime, code, language, theme)
