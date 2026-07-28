import { beforeEach, describe, expect, it } from "bun:test"
import { Effect, Option } from "effect"
import { draftWithBotFindings } from "../../tests/fixtures"
import { forgetEverything, installStorage, place, stored } from "../../tests/storage"
import { rememberedPullRequest } from "../app/pullRequest"
import type { PullRequestRef } from "../domain/PullRequestRef"
import { recall, remember } from "./cache"
import { layer } from "./GitHubGateway"
import type { RawPayloads } from "./snapshot"

installStorage()
beforeEach(forgetEverything)

const ref = (number: number): PullRequestRef => ({ owner: "microsoft", repo: "vscode", number })

const payloadsFor = (number: number): RawPayloads => ({
  changes: { pull: number },
  statusChecks: {},
  mergeBox: {},
  description: {}
})

const recalled = (reference: PullRequestRef) => Effect.runPromise(recall(reference))

const kept = (reference: PullRequestRef, payloads: RawPayloads) =>
  Effect.runPromise(remember(reference, payloads))

/**
 * Reading through the gateway, which is the only seam: what the interface asks
 * for and what it gets back, with the store where it actually is.
 */
const readAgain = (reference: PullRequestRef) =>
  Effect.runPromise(rememberedPullRequest(reference).pipe(Effect.provide(layer)))

describe("keeping a pull request to open again", () => {
  it("has nothing to say about one never read", async () => {
    expect(await recalled(ref(1))).toEqual(Option.none())
  })

  it("gives GitHub's payloads back exactly as they arrived", async () => {
    await kept(ref(1), payloadsFor(1))

    expect(await recalled(ref(1))).toEqual(Option.some(payloadsFor(1)))
  })

  it("keeps pull requests apart", async () => {
    await kept(ref(1), payloadsFor(1))
    await kept(ref(2), payloadsFor(2))

    expect(await recalled(ref(1))).toEqual(Option.some(payloadsFor(1)))
    expect(await recalled(ref(2))).toEqual(Option.some(payloadsFor(2)))
  })

  it("replaces what it held when the same pull request is read again", async () => {
    await kept(ref(1), payloadsFor(1))
    await kept(ref(1), { ...payloadsFor(1), changes: { pull: "newer" } })

    expect(await recalled(ref(1))).toEqual(Option.some({ ...payloadsFor(1), changes: { pull: "newer" } }))
  })

  it("forgets the least recently read once it is full, and nothing before that", async () => {
    for (let number = 1; number <= 41; number += 1) await kept(ref(number), payloadsFor(number))

    expect(await recalled(ref(1))).toEqual(Option.none())
    expect(await recalled(ref(2))).toEqual(Option.some(payloadsFor(2)))
    expect(await recalled(ref(41))).toEqual(Option.some(payloadsFor(41)))
  })

  it("counts reading one again as recent, so it is not the one dropped", async () => {
    for (let number = 1; number <= 40; number += 1) await kept(ref(number), payloadsFor(number))
    await kept(ref(1), payloadsFor(1))
    await kept(ref(99), payloadsFor(99))

    expect(await recalled(ref(1))).toEqual(Option.some(payloadsFor(1)))
    expect(await recalled(ref(2))).toEqual(Option.none())
  })
})

describe("reading a remembered pull request back through the gateway", () => {
  it("decodes it the same way a live read would", async () => {
    await kept(ref(1), draftWithBotFindings)

    const read = await readAgain(ref(1))

    expect(Option.isSome(read)).toBe(true)
    // Decoded, not handed back as JSON: a snapshot with the domain on it.
    expect(Option.getOrThrow(read).snapshot.reference).toEqual(ref(1))
    expect(Option.getOrThrow(read).snapshot.files.length).toBeGreaterThan(0)
  })

  it("says nothing about a pull request never read", async () => {
    expect(await readAgain(ref(404))).toEqual(Option.none())
  })

  it("treats a payload it can no longer decode as never having been read", async () => {
    // What a build from before a GitHub schema change leaves behind. Kept the
    // way anything else is; refused by the decoder rather than half-read.
    await kept(ref(1), payloadsFor(1))

    expect(await readAgain(ref(1))).toEqual(Option.none())
  })

  it("treats an entry written in some older shape as never having been read", async () => {
    place("pr:microsoft/vscode/1", { payloads: draftWithBotFindings, written: "no `at` field" })

    expect(await recalled(ref(1))).toEqual(Option.none())
    expect(await readAgain(ref(1))).toEqual(Option.none())
  })

  it("remembers what a live read decoded, so the next visit has it waiting", async () => {
    await kept(ref(1), draftWithBotFindings)

    // The shape the gateway writes, rather than whatever a test felt like
    // putting there: a timestamp beside the payloads GitHub actually sent.
    const entry = stored("pr:microsoft/vscode/1")
    expect(entry).toMatchObject({ payloads: draftWithBotFindings })
    expect(Option.isSome(await readAgain(ref(1)))).toBe(true)
  })
})
