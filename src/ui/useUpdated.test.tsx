import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { Toasts } from "./Toasts"
import { useUpdated } from "./useUpdated"

afterEach(cleanup)

const SAID = "Pull requests updated"

const Screen = ({
  catchingUp,
  content
}: {
  readonly catchingUp: boolean
  readonly content: ReadonlyArray<string> | undefined
}) => {
  useUpdated(catchingUp, content, SAID)
  return <p>{content?.join(",")}</p>
}

const showing = (catchingUp: boolean, content: ReadonlyArray<string> | undefined) => (
  <Toasts>
    <Screen catchingUp={catchingUp} content={content} />
  </Toasts>
)

describe("what a screen says after checking known content", () => {
  test("stays silent when the content is unchanged", async () => {
    const shown = render(showing(true, ["known"]))

    shown.rerender(showing(false, ["known"]))

    await waitFor(() => expect(screen.queryByText(SAID)).toBeNull())
  })

  test("says when the content changed", async () => {
    const shown = render(showing(true, ["known"]))

    shown.rerender(showing(false, ["new"]))

    await waitFor(() => expect(screen.getByText(SAID)).toBeDefined())
  })

  test("stays silent for content it did not know before", async () => {
    render(showing(false, ["first answer"]))

    await waitFor(() => expect(screen.queryByText(SAID)).toBeNull())
  })
})
