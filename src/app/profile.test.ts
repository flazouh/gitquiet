import { describe, expect, test } from "bun:test"
import { Effect, Layer, Option } from "effect"
import type { Happening } from "../domain/activity"
import type { Answering } from "../domain/answering"
import { layerFromRecordings } from "../github/GitHubGateway"
import { GitHubGateway } from "../ports/GitHubGateway"
import { theirAnswering } from "./profile"

const now = new Date("2026-08-15T00:00:00Z")

const daysAgo = (days: number): string =>
  new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()

const act = (kind: Happening["kind"], where: string, days: number): Happening => {
  const [owner = "", repo = ""] = where.split("/")

  return {
    kind,
    at: daysAgo(days),
    by: [{ login: "alex", faceUrl: Option.none() }],
    repo: { owner, repo },
    ref: Option.none(),
    howMany: Option.none(),
    howOften: 1,
    number: Option.none(),
    title: Option.none(),
    url: `https://github.com/${where}`
  }
}

/**
 * A gateway that answers the two reads this module makes with what a test says.
 *
 * Built over `layerFromRecordings([])`, which is the whole port with every read answering
 * empty, so the two below are checked against their real signatures: a rename on either
 * one fails this file rather than passing it.
 */
const gateway = (
  remembered: Option.Option<ReadonlyArray<Happening>>,
  fresh: ReadonlyArray<Happening>
) =>
  Layer.effect(
    GitHubGateway,
    Effect.map(GitHubGateway, (whole) => ({
      ...whole,
      rememberedActivity: () => Effect.succeed(remembered),
      activity: () => Effect.succeed(fresh)
    }))
  ).pipe(Layer.provide(layerFromRecordings([])))

describe("how much of an answer they have been", () => {
  test("counts what they did on other people's work in the window", async () => {
    const said = await Effect.runPromise(
      theirAnswering("alex", now).pipe(
        Effect.provide(gateway(Option.none(), [act("reviewed", "facebook/react", 3)]))
      )
    )

    expect(said.reviews).toBe(1)
    expect(said.places).toBe(1)
  })

  /*
   * The band is the first thing on the page and the events are a request away, so last
   * visit's answer goes up while this visit's is being fetched. It is rarely a different
   * number on the same day, and an empty band that fills in is read as a page loading
   * badly.
   */
  test("says what it remembered before the events land", async () => {
    const seen: Array<Answering> = []

    const said = await Effect.runPromise(
      theirAnswering("alex", now, (partly) => seen.push(partly)).pipe(
        Effect.provide(
          gateway(Option.some([act("reviewed", "facebook/react", 3)]), [
            act("reviewed", "facebook/react", 3),
            act("commented", "vercel/next.js", 1)
          ])
        )
      )
    )

    expect(seen.map((one) => one.replies)).toEqual([0])
    expect(said.replies).toBe(1)
  })

  test("says nothing early where nothing was remembered", async () => {
    const seen: Array<Answering> = []

    await Effect.runPromise(
      theirAnswering("alex", now, (partly) => seen.push(partly)).pipe(
        Effect.provide(gateway(Option.none(), []))
      )
    )

    expect(seen).toEqual([])
  })
})
