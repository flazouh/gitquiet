import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { highlightUsing } from "./highlighterClient"
import { HIGHLIGHT_ANSWER, HIGHLIGHT_REQUEST } from "./highlighterProtocol"

describe("syntax highlighting away from the page", () => {
  test("sends the code to the extension worker and returns its HTML", async () => {
    const sent: Array<unknown> = []
    const html = await Effect.runPromise(
      highlightUsing(
        {
          sendMessage: async (message) => {
            sent.push(message)
            return { kind: HIGHLIGHT_ANSWER, html: "<span>const</span>" }
          }
        },
        "const answer = 42",
        "ts",
        "github-light-default"
      )
    )

    expect(sent).toEqual([
      {
        kind: HIGHLIGHT_REQUEST,
        code: "const answer = 42",
        language: "ts",
        theme: "github-light-default"
      }
    ])
    expect(html).toBe("<span>const</span>")
  })

  test("keeps code readable when the worker cannot answer", async () => {
    const html = await Effect.runPromise(
      highlightUsing(
        { sendMessage: async () => ({ kind: "unknown" }) },
        "echo ready",
        "sh",
        "github-dark-default"
      )
    )

    expect(html).toBeNull()
  })
})
