import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, within } from "@testing-library/react"
import { Supplied } from "../Supplied"
import { RUN_VIEW } from "./run"

afterEach(cleanup)

/*
 * Queried inside what this test rendered rather than through `screen`.
 *
 * Nothing clears the document between files here, so by the time these run it holds
 * whatever every other file drew. Asking within this render is the difference between a
 * test that passes on its own and one that passes in the suite.
 */
const drawn = () => within(render(<Supplied>{RUN_VIEW.draw()}</Supplied>).container)

describe("the run view", () => {
  test("is the size the Chrome Web Store asks for", () => {
    expect(RUN_VIEW.name).toBe("run")
    expect([RUN_VIEW.width, RUN_VIEW.height]).toEqual([1280, 800])
  })

  test("names the run and the work it is of", async () => {
    const shot = drawn()

    expect(await shot.findByText("Decode streamed chunks with one decoder")).toBeTruthy()
    expect(shot.getByText("#18742")).toBeTruthy()
    expect(shot.getByText("serve-abort-mid-chunk")).toBeTruthy()
    expect(shot.getByText("#23014")).toBeTruthy()
  })

  /*
   * The whole reason this view is in the listing. Their own page for a red run opens on
   * a graph of job nodes and keeps the assertion three presses away, so a photograph of
   * this screen without the assertion in it would be selling the extension on a graph.
   */
  test("puts the assertion that broke the run in the Fault", async () => {
    const shot = drawn()

    const fault = await shot.findByRole("region", { name: "Fault" })
    expect(within(fault).getByText(/keeps a keep-alive socket when a stream aborts mid-chunk/))
      .toBeTruthy()
  })

  test("names the job that failed above the count of the ones that passed", async () => {
    const shot = drawn()

    const fault = await shot.findByRole("region", { name: "Fault" })
    expect(within(fault).getByText("linux-x64 / test")).toBeTruthy()
    expect(shot.getByText(/11 passed/)).toBeTruthy()
    expect(shot.getByText(/1 skipped/)).toBeTruthy()
  })

  /*
   * The count rather than three rows. Three jobs each printed the same deprecation
   * notice, and a screen that gave each of them a row would push the assertion the
   * reader came for off the frame.
   */
  test("folds a notice three jobs repeated into one row that counts them", async () => {
    const shot = drawn()
    await shot.findByRole("region", { name: "Fault" })

    expect(shot.getByText("3 places")).toBeTruthy()
    expect(shot.getByText(/Node\.js 20 actions are deprecated/)).toBeTruthy()
  })
})
