import { beforeEach, describe, expect, test } from "bun:test"
import { Option } from "effect"
import { forgetDrawn, keepDrawn, lastDrawn, repoNamed } from "./lastDrawn"

const repo = { owner: "OpenRouterIncubator", repo: "ori" }

describe("the repository page kept for Back", () => {
  beforeEach(forgetDrawn)

  test("keeps two branches as two pages", () => {
    const main = repoNamed(repo, "main")
    const feature = repoNamed(repo, "alexdepape/ori-harness-default")

    keepDrawn(main, { branch: "main" })
    keepDrawn(feature, { branch: "alexdepape/ori-harness-default" })

    expect(Option.getOrNull(lastDrawn<{ branch: string }>(main))).toEqual({ branch: "main" })
    expect(Option.getOrNull(lastDrawn<{ branch: string }>(feature))).toEqual({
      branch: "alexdepape/ori-harness-default"
    })
  })
})
