import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { numberInNodeId, numbersInNodeIds } from "./nodeIds"

/**
 * Real ids, off a live dashboard on 2026-09-02, with the numbers the deferred
 * route answered for them. Invented ones would only prove the decoder decodes
 * what this file encoded.
 */
const REAL: ReadonlyArray<readonly [string, number]> = [
  ["PR_kwDOSqzG5M8AAAABB4wjtw", 4421591991],
  ["PR_kwDOQbgJEc8AAAABBwT2OA", 4412732984],
  ["PR_kwDOT1slMM8AAAABB0ZjQA", 4417020736],
  ["PR_kwDOQbgJEc8AAAABBzSDHg", 4415849246],
  ["PR_kwDOSqzG5M8AAAABBocYug", 4404484282]
]

describe("the number inside one of GitHub's node ids", () => {
  for (const [nodeId, number] of REAL) {
    test(`reads ${number} out of ${nodeId}`, () => {
      expect(numberInNodeId(nodeId)).toEqual(Option.some(number))
    })
  }

  test("reads nothing from the number itself, which is what the rows used to carry", () => {
    // A build that half-migrated would hand this the old field. Answering none
    // asks the deferred route about nothing, which shows no checks; answering a
    // number read out of the wrong bytes shows somebody else's.
    expect(numberInNodeId("4421591991")).toEqual(Option.none())
  })

  test("reads nothing from an id of another kind, or of another shape", () => {
    // An issue's id is the same encoding and a different length, and a row this
    // cannot read is a row without its checks rather than a wrong row.
    expect(numberInNodeId("I_kwDOAn8RLM6Yg1lK")).toEqual(Option.none())
    expect(numberInNodeId("PR_")).toEqual(Option.none())
    expect(numberInNodeId("PR")).toEqual(Option.none())
    expect(numberInNodeId("")).toEqual(Option.none())
  })

  test("keeps the whole body when base64url put an underscore inside it", () => {
    // `_` is what `/` becomes in base64url, so a body can carry one. Splitting on
    // every underscore kept the first half and dropped the row's checks in silence.
    expect(numberInNodeId("PR_kwDOAn8RLM8AAAABB4_xTA")).toEqual(Option.some(4421841228))
  })

  test("does not throw on something that is not base64 at all", () => {
    // `atob` throws on a character it does not know, and this is fed whatever
    // GitHub put in the field.
    expect(numberInNodeId("PR_!!!!not base64!!!!")).toEqual(Option.none())
  })

  test("keeps the rows it can read and drops the ones it cannot", () => {
    const some = numbersInNodeIds([REAL[0]![0], "PR_nonsense", REAL[1]![0]])
    expect(some).toEqual([REAL[0]![1], REAL[1]![1]])
  })

  test("asks about nothing where it could read nothing", () => {
    expect(numbersInNodeIds(["PR_nonsense", "1234"])).toEqual([])
  })
})
