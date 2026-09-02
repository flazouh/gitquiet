import { describe, expect, test } from "bun:test"
import { halvesToReveal } from "./revealing"

describe("which halves of a file are needed to reveal the lines between its hunks", () => {
  test("wants both halves of a file that was edited", () => {
    expect(halvesToReveal("modified")).toBe("both")
  })

  test("wants both of a file that moved, since its lines are on both sides", () => {
    expect(halvesToReveal("renamed")).toBe("both")
    expect(halvesToReveal("copied")).toBe("both")
    expect(halvesToReveal("changed")).toBe("both")
  })

  test("wants only the new half of a file the pull request added", () => {
    expect(halvesToReveal("added")).toBe("after")
  })

  /*
   * The sharp one. A file the pull request deleted has no new half to reveal
   * into, and handing the renderer a half it did not ask for is how a deletion
   * gets redrawn as something else.
   */
  test("wants nothing for a file the pull request deleted", () => {
    expect(halvesToReveal("deleted")).toBe("nothing")
  })
})
