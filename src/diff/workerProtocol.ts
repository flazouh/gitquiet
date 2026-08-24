export const DIFF_WORKER_REQUEST = "gitquiet-diff-worker-request"
export const DIFF_WORKER_WORK = "gitquiet-diff-worker-work"
export const DIFF_WORKER_ANSWER = "gitquiet-diff-worker-answer"

export type DiffWorkerMessage = { readonly id: string }
export type DiffWorkerError = DiffWorkerMessage & {
  readonly type: "error"
  readonly error: string
}

export type DiffWorkerRequest = {
  readonly kind: typeof DIFF_WORKER_REQUEST
  readonly request: DiffWorkerMessage
}

export type DiffWorkerWork = {
  readonly kind: typeof DIFF_WORKER_WORK
  readonly request: DiffWorkerMessage
}

export type DiffWorkerAnswer = {
  readonly kind: typeof DIFF_WORKER_ANSWER
  readonly response: DiffWorkerMessage
}

const messageIn = (value: unknown): value is DiffWorkerMessage =>
  typeof value === "object" &&
  value !== null &&
  "id" in value &&
  typeof value.id === "string"

export const isDiffWorkerRequest = (value: unknown): value is DiffWorkerRequest =>
  typeof value === "object" &&
  value !== null &&
  "kind" in value &&
  value.kind === DIFF_WORKER_REQUEST &&
  "request" in value &&
  messageIn(value.request)

export const isDiffWorkerWork = (value: unknown): value is DiffWorkerWork =>
  typeof value === "object" &&
  value !== null &&
  "kind" in value &&
  value.kind === DIFF_WORKER_WORK &&
  "request" in value &&
  messageIn(value.request)

export const isDiffWorkerAnswer = (value: unknown): value is DiffWorkerAnswer =>
  typeof value === "object" &&
  value !== null &&
  "kind" in value &&
  value.kind === DIFF_WORKER_ANSWER &&
  "response" in value &&
  messageIn(value.response)

export const workerError = (id: string, cause: unknown): DiffWorkerError => ({
  type: "error",
  id,
  error: cause instanceof Error ? cause.message : String(cause)
})
