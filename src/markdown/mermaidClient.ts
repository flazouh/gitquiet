import { Effect } from "effect"
import type { DrawMermaid } from "./loadMermaid"
import {
  isMermaidAnswer,
  MERMAID_REQUEST,
  type MermaidRequest
} from "./mermaidProtocol"

const LOCAL_CHUNK = "/markdown-mermaid-local.js"

export type MermaidRuntime = {
  readonly getURL: (path: string) => string
  readonly sendMessage: (message: unknown) => PromiseLike<unknown>
}

type LoadLocal = Effect.Effect<DrawMermaid, unknown>

/**
 * Asks the extension's hidden document to do Mermaid's DOM layout.
 *
 * Chrome gives the hidden document its own renderer process. A browser without
 * that API uses the old local path, so Firefox and Safari keep drawing diagrams.
 */
export const drawUsing = (
  runtime: MermaidRuntime,
  loadLocal: LoadLocal,
  code: string
): Effect.Effect<string | null> =>
  Effect.tryPromise({
    try: () =>
      runtime.sendMessage({
        kind: MERMAID_REQUEST,
        code
      } satisfies MermaidRequest),
    catch: () => "mermaid-offscreen-unavailable" as const
  }).pipe(
    Effect.flatMap((answer) =>
      isMermaidAnswer(answer)
        ? Effect.succeed(answer.svg)
        : Effect.fail("mermaid-offscreen-unavailable" as const)
    ),
    Effect.catch(() =>
      loadLocal.pipe(
        Effect.flatMap((draw) => draw(code)),
        Effect.orElseSucceed(() => null)
      )
    )
  )

const runtime: MermaidRuntime = {
  getURL: (path) => (browser.runtime.getURL as (path: string) => string)(path),
  sendMessage: (message) => browser.runtime.sendMessage(message)
}

let local: Effect.Effect<DrawMermaid, unknown> | undefined

const loadLocal = (): Effect.Effect<DrawMermaid, unknown> => {
  local ??= Effect.tryPromise({
    try: () => import(/* @vite-ignore */ runtime.getURL(LOCAL_CHUNK)),
    catch: () => "mermaid-unavailable" as const
  }).pipe(
    Effect.map((module) => (module as { draw: DrawMermaid }).draw)
  )
  return local
}

export const draw: DrawMermaid = (code) => drawUsing(runtime, loadLocal(), code)
