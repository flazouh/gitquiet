import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import { whereverItIs } from "./wherever"

/**
 * A shape with two keys of its own, which is what every route schema here has.
 *
 * Required keys are what makes a search possible: a shape whose every key is
 * optional matches an empty object, and a reader that took the first such match
 * would take the wrapper rather than the answer.
 */
const Answer = Schema.Struct({
  rows: Schema.Array(Schema.Struct({ oid: Schema.String })),
  branch: Schema.String
})

const read = whereverItIs(Answer)
const answered = (raw: unknown) => Effect.runPromise(read(raw))
const refused = (raw: unknown) =>
  Effect.runPromise(
    read(raw).pipe(
      Effect.map(() => "decoded" as const),
      Effect.catch((cause) => Effect.succeed(String(cause)))
    )
  )

const answer = { rows: [{ oid: "3f12934" }], branch: "main" }

describe("reading an answer wherever GitHub has parented it", () => {
  test("takes it at the top, where a route with no wrapper puts it", async () => {
    expect(await answered(answer)).toEqual(answer)
  })

  test("takes it under one wrapper, which is what their rename does", async () => {
    expect(await answered({ payload: answer })).toEqual(answer)
  })

  test("takes it under two, since their rename landed inside a payload", async () => {
    expect(await answered({ meta: { time: 1 }, payload: { commitsRefRoute: answer } })).toEqual(
      answer
    )
  })

  test("takes it under a key with a dot in it, as their file view writes one", async () => {
    expect(await answered({ payload: { "codeViewBlobLayoutRoute.StyledBlob": answer } })).toEqual(
      answer
    )
  })

  test("prefers the shallower of two, which is the answer rather than a copy of it", async () => {
    const shallow = { ...answer, branch: "main" }
    const deep = { ...answer, branch: "release" }

    expect(await answered({ ...shallow, payload: { deep } })).toEqual(shallow)
  })

  test("refuses two at the same depth, rather than guessing which is the answer", async () => {
    // Their `_sidebar` answers with eight lists side by side, and a schema loose
    // enough to match two of them has to be told, not resolved by ordering.
    const said = await refused({ payload: { first: answer, second: answer } })

    expect(said).toContain("first")
    expect(said).toContain("second")
  })

  test("says which key would not decode, when it is nowhere", async () => {
    // The message production already reports: the field, at the top, where a
    // reader looking for what changed will look first.
    const said = await refused({ payload: { rows: [{ oid: "3f12934" }] } })

    expect(said).toContain("branch")
  })

  test("does not search inside the rows of an answer it has already passed", async () => {
    // A depth cap and arrays left alone, so a tree of seventeen thousand paths
    // costs a handful of tries rather than a walk.
    const said = await refused({ list: [{ payload: answer }] })

    expect(said).not.toBe("decoded")
  })

  test("leaves a wrapper it cannot see through alone, rather than reaching deeper", async () => {
    const said = await refused({ a: { b: { c: { d: answer } } } })

    expect(said).not.toBe("decoded")
  })
})
