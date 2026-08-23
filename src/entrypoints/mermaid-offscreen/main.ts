import { Effect } from "effect"
import type { DrawMermaid } from "@/markdown/loadMermaid"
import {
  isMermaidWork,
  MERMAID_ANSWER,
  type MermaidAnswer
} from "@/markdown/mermaidProtocol"

const LOCAL_CHUNK = "/markdown-mermaid-local.js"

let loaded: Effect.Effect<DrawMermaid, unknown> | undefined

const renderer = (): Effect.Effect<DrawMermaid, unknown> => {
  const getURL = browser.runtime.getURL as (path: string) => string
  loaded ??= Effect.tryPromise({
    try: () => import(/* @vite-ignore */ getURL(LOCAL_CHUNK)),
    catch: () => "mermaid-unavailable" as const
  }).pipe(
    Effect.map((module) => (module as { draw: DrawMermaid }).draw)
  )
  return loaded
}

browser.runtime.onMessage.addListener((message: unknown) => {
  if (!isMermaidWork(message)) return undefined

  return Effect.runPromise(
    renderer().pipe(
      Effect.flatMap((draw) => draw(message.code)),
      Effect.map(
        (svg) =>
          ({
            kind: MERMAID_ANSWER,
            svg
          }) satisfies MermaidAnswer
      ),
      Effect.orElseSucceed(
        () => ({ kind: MERMAID_ANSWER, svg: null }) satisfies MermaidAnswer
      )
    )
  )
})
