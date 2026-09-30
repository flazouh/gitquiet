import { describe, expect, test } from "bun:test"
import { Effect, Layer, Option } from "effect"
import { layerFromRecordings } from "../github/GitHubGateway"
import { GitHubGateway } from "../ports/GitHubGateway"
import { warmPerson } from "./person"

/*
 * Reading a person ahead is what a pointer near their name does, and their events come
 * from GitHub's public API, which allows a stranger sixty an hour for the whole address.
 * Measured: an afternoon of reading lists spent it on people nobody opened, and the one
 * profile that was opened said it could not read what they did.
 */
describe("reading a person ahead", () => {
  test("does not spend the hourly allowance on their events", async () => {
    let asked = 0
    const gateway = Layer.effect(
      GitHubGateway,
      Effect.map(GitHubGateway, (whole) => ({
        ...whole,
        person: () => Effect.succeed(Option.none()),
        personRepositories: () => Effect.fail(new Error("not read here") as never),
        activity: () => {
          asked += 1
          return Effect.succeed([])
        }
      }))
    ).pipe(Layer.provide(layerFromRecordings([])))

    await Effect.runPromise(
      warmPerson({ login: "flazouh", tab: "profile", page: 1, find: "", narrowing: "" }).pipe(
        Effect.provide(gateway),
        Effect.ignore
      )
    )

    expect(asked).toBe(0)
  })
})
