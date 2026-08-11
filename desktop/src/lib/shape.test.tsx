import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import { Button } from "../components/ui/button"
import { ShapeProvider } from "./shape-context"

/**
 * What the registry's controls do about their corners, which is nothing on their
 * own: they read a shape from this context, and the fallback when nobody has
 * provided one is the registry's pill.
 *
 * That fallback is what put a twenty-pixel pill in the title bar of a window
 * whose cards are ten and whose rows are eight — a shape nothing else on screen
 * had, arrived at by default rather than by choice. The window says which shape
 * it is now, and these two tests are the difference between saying so and not.
 */

afterEach(cleanup)

const cornersOf = (label: string): string =>
  Array.from(screen.getByRole("button", { name: label }).classList)
    .filter((one) => one.startsWith("rounded"))
    .join(" ")

describe("the shape the window's buttons take", () => {
  test("is the interface's own eight, once the window has said which shape it is", () => {
    render(
      <ShapeProvider defaultShape="rounded">
        <Button>Working Set</Button>
      </ShapeProvider>
    )

    // `rounded-md`, which this window's theme answers with 8px — the radius of
    // every row, menu item and summary the screens below the strip draw.
    expect(cornersOf("Working Set")).toBe("rounded-md")
  })

  test("is the registry's pill when nobody has, which is the fault this guards", () => {
    render(<Button>Working Set</Button>)

    expect(cornersOf("Working Set")).toBe("rounded-[20px]")
  })
})
