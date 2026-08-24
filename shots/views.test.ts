import { describe, expect, test } from "bun:test"
import { WANTED } from "../src/app/screens"
import { VIEWS } from "./views"

describe("the performance stage", () => {
  test("covers every extension view", () => {
    expect(VIEWS.map((view) => view.name).sort()).toEqual([...WANTED].sort())
  })
})
