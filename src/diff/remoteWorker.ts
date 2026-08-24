import { Effect } from "effect"
import {
  DIFF_WORKER_REQUEST,
  isDiffWorkerAnswer,
  type DiffWorkerMessage,
  workerError
} from "./workerProtocol"

type MessageListener = (event: MessageEvent<DiffWorkerMessage>) => void
type ErrorListener = (event: ErrorEvent) => void

/** A Worker-shaped bridge to the extension document that owns the real worker. */
class RemoteDiffWorker {
  readonly #messages = new Set<MessageListener>()
  readonly #errors = new Set<ErrorListener>()
  #live = true

  addEventListener(type: "message" | "error", listener: MessageListener | ErrorListener): void {
    if (type === "message") this.#messages.add(listener as MessageListener)
    else this.#errors.add(listener as ErrorListener)
  }

  postMessage(request: DiffWorkerMessage): void {
    if (!this.#live) return
    Effect.runFork(
      Effect.tryPromise({
        try: () =>
          browser.runtime.sendMessage({
            kind: DIFF_WORKER_REQUEST,
            request
          }),
        catch: (cause) => cause
      }).pipe(
        Effect.tap((answer) =>
          Effect.sync(() => {
            if (!this.#live) return
            const response = isDiffWorkerAnswer(answer)
              ? answer.response
              : workerError(request.id, "Diff worker returned no answer")
            for (const listener of this.#messages) {
              listener(new MessageEvent("message", { data: response }))
            }
          })
        ),
        Effect.tapError((cause) =>
          Effect.sync(() => {
            if (!this.#live) return
            const event = new ErrorEvent("error", { error: cause, message: String(cause) })
            for (const listener of this.#errors) listener(event)
            const response = workerError(request.id, cause)
            for (const listener of this.#messages) {
              listener(new MessageEvent("message", { data: response }))
            }
          })
        )
      )
    )
  }

  terminate(): void {
    this.#live = false
    this.#messages.clear()
    this.#errors.clear()
  }
}

export const remoteDiffWorker = (): Worker => new RemoteDiffWorker() as unknown as Worker
