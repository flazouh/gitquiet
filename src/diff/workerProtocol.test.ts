import { describe, expect, test } from "bun:test"
import {
  DIFF_WORKER_ANSWER,
  DIFF_WORKER_REQUEST,
  DIFF_WORKER_WORK,
  isDiffWorkerAnswer,
  isDiffWorkerRequest,
  isDiffWorkerWork,
  workerError
} from "./workerProtocol"

const request = { id: "request-1", type: "initialize" }

describe("diff worker messages", () => {
  test("accepts each envelope with a string request id", () => {
    expect(isDiffWorkerRequest({ kind: DIFF_WORKER_REQUEST, request })).toBe(true)
    expect(isDiffWorkerWork({ kind: DIFF_WORKER_WORK, request })).toBe(true)
    expect(isDiffWorkerAnswer({ kind: DIFF_WORKER_ANSWER, response: request })).toBe(true)
  })

  test("rejects malformed and cross-wired envelopes", () => {
    expect(isDiffWorkerRequest(null)).toBe(false)
    expect(isDiffWorkerRequest({ kind: DIFF_WORKER_REQUEST, request: { id: 1 } })).toBe(false)
    expect(isDiffWorkerWork({ kind: DIFF_WORKER_REQUEST, request })).toBe(false)
    expect(isDiffWorkerAnswer({ kind: DIFF_WORKER_ANSWER, response: {} })).toBe(false)
  })

  test("returns a worker-shaped error with the matching id", () => {
    expect(workerError("request-2", new Error("worker stopped"))).toEqual({
      type: "error",
      id: "request-2",
      error: "worker stopped"
    })
  })
})
