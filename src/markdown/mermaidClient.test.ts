import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { drawUsing } from "./mermaidClient"

describe("drawing Mermaid outside the page", () => {
  test("uses the offscreen answer without loading Mermaid into the page", async () => {
    let localLoads = 0

    const drawn = await Effect.runPromise(
      drawUsing(
        {
          getURL: (path) => `chrome-extension://gitquiet${path}`,
          sendMessage: async () => ({ kind: "gitquiet:mermaid:answer", svg: "<svg>remote</svg>" })
        },
        Effect.sync(() => {
          localLoads += 1
          return () => Effect.succeed("<svg>local</svg>")
        }),
        "flowchart LR; A --> B"
      )
    )

    expect(drawn).toBe("<svg>remote</svg>")
    expect(localLoads).toBe(0)
  })

  test("uses the local renderer when this browser has no offscreen document", async () => {
    const drawn = await Effect.runPromise(
      drawUsing(
        {
          getURL: (path) => `moz-extension://gitquiet${path}`,
          sendMessage: async () => ({ kind: "gitquiet:mermaid:unavailable" })
        },
        Effect.succeed(() => Effect.succeed("<svg>local</svg>")),
        "flowchart LR; A --> B"
      )
    )

    expect(drawn).toBe("<svg>local</svg>")
  })
})
