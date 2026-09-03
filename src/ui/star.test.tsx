import { afterEach, describe, expect, test } from "bun:test"
import { render, screen, waitFor } from "@testing-library/react"
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

    // Awaited rather than given ten milliseconds: what is being waited for is a
    // state change and a render, and a machine under load takes longer than any
    // figure written here.
    await waitFor(() =>
      expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("false")
    )
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

  test("lets the page say the star is gone once it has agreed about it", async () => {
    /*
     * The press stands over the page's answer only until the answer agrees. It
     * used to stand over it for as long as the document lived, so a star given
     * here went on being drawn over a repository the reader had since unstarred
     * somewhere else — a control that could not be corrected by the page it is
     * drawn on.
     */
    const { rerender } = showing("unstarred", { onStar: () => Effect.void })

    await userEvent.click(screen.getByRole("button"))
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("true")

    // The page catches up, and then it is unstarred from another tab.
    rerender(<Star starring="starred" count={Option.some(1205)} onStar={() => Effect.void} />)
    await waitFor(() =>
      expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("true")
    )

    rerender(<Star starring="unstarred" count={Option.some(1204)} onStar={() => Effect.void} />)
    await waitFor(() =>
      expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("false")
    )
  })

  test("is not there at all for a reader who may not star", async () => {
    showing("barred")

    expect(screen.queryByRole("button")).toBeNull()
  })
})
