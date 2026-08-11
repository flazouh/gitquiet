import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { readPullRequestHeader } from "./PageHeader"

const documentContaining = (embedded: string | null): Document => {
  const source = document.implementation.createHTMLDocument("fixture")
  if (embedded !== null) {
    const script = source.createElement("script")
    script.setAttribute("type", "application/json")
    script.setAttribute("data-target", "react-app.embeddedData")
    script.textContent = embedded
    source.body.appendChild(script)
  }
  return source
}

const layoutPayload = JSON.stringify({
  payload: {
    pullRequestsLayoutRoute: {
      pullRequest: {
        number: 327442,
        title: "Polish multi-file diffs in Agents window",
        author: { login: "romalpani" }
      }
    }
  }
})

const changesPayload = JSON.stringify({
  payload: {
    pullRequestsChangesRoute: {
      pullRequest: { number: 327442, title: "Polish multi-file diffs in Agents window" }
    }
  }
})

const header = (embedded: string | null) =>
  Effect.runPromise(readPullRequestHeader(documentContaining(embedded)))

const failureOf = (embedded: string | null) =>
  Effect.runPromise(Effect.flip(readPullRequestHeader(documentContaining(embedded))))

describe("reading the pull request header from GitHub's own payload", () => {
  test("reads it from the layout route", async () => {
    expect(await header(layoutPayload)).toEqual({
      number: 327442,
      title: "Polish multi-file diffs in Agents window"
    })
  })

  test("falls back to the changes route", async () => {
    expect(await header(changesPayload)).toEqual({
      number: 327442,
      title: "Polish multi-file diffs in Agents window"
    })
  })

  test("fails when the page carries no embedded payload", async () => {
    expect(await failureOf(null)).toMatchObject({ reason: "no-embedded-script" })
  })

  test("fails when the payload is not JSON", async () => {
    expect(await failureOf("<!doctype html>")).toMatchObject({ reason: "not-json" })
  })

  test("fails when GitHub changes the shape rather than rendering half a header", async () => {
    const renamed = JSON.stringify({
      payload: { pullRequestsLayoutRoute: { pullRequest: { number: 1 } } }
    })
    await expect(header(renamed)).rejects.toThrow()
  })
})
