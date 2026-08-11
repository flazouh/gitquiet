import { afterEach, describe, expect, test } from "bun:test"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect, Option } from "effect"
import type { Starring } from "../domain/repoHome"
import { Star } from "./Star"

afterEach(() => {
  document.body.innerHTML = ""
})

const showing = (
  starring: Starring,
  over: { count?: Option.Option<number>; onStar?: (to: Starring) => Effect.Effect<void, unknown> } = {}
) =>
  render(
    <Star starring={starring} count={over.count ?? Option.some(1204)} onStar={over.onStar} />
  )

describe("the star", () => {
  test("asks GitHub for the star, and says so before GitHub answers", async () => {
    /*
     * The order is the point. A star is a gesture, and one that waits for a
     * round trip before it moves is a gesture the reader has stopped believing
     * in by the time it lands.
     */
    const asked: Array<Starring> = []
    let answer = (): void => {}
    showing("unstarred", {
      onStar: (to) => {
        asked.push(to)
        return Effect.callback<void>(() => {
          answer = () => {}
        })
      }
    })

    await userEvent.click(screen.getByRole("button"))

    expect(asked).toEqual(["starred"])
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("true")
    answer()
  })

  test("moves the count by one in the direction of the press", async () => {
    showing("unstarred", { count: Option.some(1204), onStar: () => Effect.void })

    expect(screen.getByText("1,204")).toBeTruthy()
    await userEvent.click(screen.getByRole("button"))

    expect(screen.getByText("1,205")).toBeTruthy()
  })

  test("takes the star back on a second press, count and all", async () => {
    const asked: Array<Starring> = []
    showing("starred", {
      count: Option.some(9),
      onStar: (to) => {
        asked.push(to)
        return Effect.void
      }
    })

    await userEvent.click(screen.getByRole("button"))

    expect(asked).toEqual(["unstarred"])
    expect(screen.getByText("8")).toBeTruthy()
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("false")
  })

  test("puts the star back where GitHub refuses it", async () => {
    // Otherwise the reader is left looking at a star they did not give, and
    // finds out on the next page load that it was never there.
    showing("unstarred", { onStar: () => Effect.fail("no") })

    await userEvent.click(screen.getByRole("button"))
    await Effect.runPromise(Effect.sleep("10 millis"))

    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("false")
  })

  test("throws the sparks on the way in and not on the way out", async () => {
    const { container } = showing("unstarred", { onStar: () => Effect.void })

    await userEvent.click(screen.getByRole("button"))
    expect(container.querySelectorAll(".t-star-spark")).toHaveLength(6)

    // A star taken back is a correction, and a correction that throws sparks is
    // celebrating the wrong thing.
    await userEvent.click(screen.getByRole("button"))
    expect(container.querySelectorAll(".t-star-spark")).toHaveLength(0)
  })

  test("is not there at all for a reader who may not star", async () => {
    showing("barred")

    expect(screen.queryByRole("button")).toBeNull()
  })
})
