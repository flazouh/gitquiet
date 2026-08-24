import { Effect } from "effect"
import type { DrawMermaid } from "@/markdown/loadMermaid"
import {
  isMermaidWork,
  MERMAID_ANSWER,
  type MermaidAnswer
} from "@/markdown/mermaidProtocol"
import {
  DIFF_WORKER_ANSWER,
  isDiffWorkerWork,
  type DiffWorkerAnswer,
  type DiffWorkerMessage,
  workerError
} from "@/diff/workerProtocol"

const LOCAL_CHUNK = "/markdown-mermaid-local.js"

let loaded: Effect.Effect<DrawMermaid, unknown> | undefined
let diffWorker: Worker | undefined

const diff = (request: DiffWorkerMessage): Effect.Effect<DiffWorkerAnswer> =>
  Effect.callback<DiffWorkerAnswer>((resume) => {
    const worker =
      diffWorker ??=
        new Worker((browser.runtime.getURL as (path: string) => string)("diff-worker.js"))
    const message = (event: MessageEvent<DiffWorkerMessage>) => {
      if (event.data.id !== request.id) return
      worker.removeEventListener("message", message)
      worker.removeEventListener("error", error)
      resume(Effect.succeed({ kind: DIFF_WORKER_ANSWER, response: event.data }))
    }
    const error = (event: ErrorEvent) => {
      worker.removeEventListener("message", message)
      worker.removeEventListener("error", error)
      diffWorker = undefined
      resume(
        Effect.succeed({
          kind: DIFF_WORKER_ANSWER,
          response: workerError(request.id, event.error ?? event.message)
        })
      )
    }
    worker.addEventListener("message", message)
    worker.addEventListener("error", error, { once: true })
    worker.postMessage(request)
    return Effect.sync(() => {
      worker.removeEventListener("message", message)
      worker.removeEventListener("error", error)
    })
  })

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
  if (isDiffWorkerWork(message)) return Effect.runPromise(diff(message.request))
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
