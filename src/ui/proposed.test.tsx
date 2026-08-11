import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect, Option } from "effect"
import type { Chain, Seat } from "../domain/PullRequest"
import { Proposed } from "./Proposed"

afterEach(cleanup)

const quiet = await Bun.file(new URL("./quiet.css", import.meta.url)).text()

const layer = (number: number, seat: Seat) => ({
  reference: { owner: "flazouh", repo: "stack-probe", number },
  title: `probe w ${number}`,
  headBranch: `probe-w${number}`,
  state: "open" as const,
  seat
})

/** The pair GitHub offers on `flazouh/stack-probe#16`, read from the top of it. */
const pair: Chain = {
  layers: [layer(15, "below"), layer(16, "here")],
  floor: Option.some("main")
}

/** A second pair, which is what a rerender of the same strip can arrive with. */
const otherPair: Chain = {
  layers: [layer(23, "below"), layer(24, "here")],
  floor: Option.some("main")
}

/**
 * The one sentence the strip says about itself, read as a reader hears it.
 *
 * What the sentence does not say is half of what it is for — the rows below it
 * count themselves and name the branch they land on — and `toContain` cannot
 * check that a sentence stops. Its own `textContent` cannot either: JSX drops
 * the newlines around every word that stands on its own line, so words meant to
 * be apart arrive glued together. Each piece of text on its own, joined by the
 * space a reader sees, is the line.
 */
const said = () => {
  const pieces: string[] = []
  const collect = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) pieces.push((node.textContent ?? "").trim())
    else Array.from(node.childNodes).forEach(collect)
  }

  collect(screen.getByRole("status"))

  return pieces.filter((piece) => piece !== "").join(" ")
}

const card = () => screen.getByRole("region", { name: "Proposed stack" })

describe("the stack this pull request could be a layer of", () => {
  test("says the pull requests can stack, and stops", () => {
    // Neither the count nor the branch, both of which the rows underneath draw:
    // the trunk row names the branch and the rows are the count. A sentence
    // saying either is the reader reading one fact twice on one screen.
    render(<Proposed chain={pair} />)

    expect(said()).toBe("These pull requests can stack.")
  })

  test("leaves the branch the chain would land on to the trunk row", () => {
    render(<Proposed chain={pair} />)

    expect(card().textContent).toContain("main")
    expect(said()).not.toContain("main")
  })

  test("draws every layer, and the trunk they stand on", () => {
    render(<Proposed chain={pair} />)

    expect(screen.getAllByRole("listitem").map((row) => row.textContent ?? "")).toHaveLength(3)
    expect(screen.getByRole("list", { name: "Layer 2 of 2" })).toBeTruthy()
  })

  test("names the stack once for a reader who is being read to", () => {
    // The region says what this is. A list inside it repeating the same two
    // words is the same name announced twice on the way in.
    render(<Proposed chain={pair} />)

    expect(screen.getByRole("list").getAttribute("aria-label")).not.toContain("Proposed stack")
  })

  test("makes every layer but the one being read a way to it", () => {
    render(<Proposed chain={pair} />)

    expect(screen.getByRole("link", { name: /probe w 15/ }).getAttribute("href")).toBe(
      "/flazouh/stack-probe/pull/15"
    )
    expect(screen.queryByRole("link", { name: /probe w 16/ })).toBeNull()
  })

  test("draws nothing for a chain with no links in it", () => {
    // What GitHub answers `null` for, and what both existing drawings of a chain
    // decline: one row over a sentence about one row is the header, repeated.
    render(<Proposed chain={{ layers: [layer(16, "here")], floor: Option.some("main") }} />)

    expect(screen.queryByRole("region")).toBeNull()
  })
})

describe("how the strip is dressed", () => {
  test("wears no border, because nothing on this page would draw one", () => {
    // `quiet.css` takes the border off every named section on the page, so a
    // border class here is a decision that never reached the screen.
    render(<Proposed chain={pair} />)

    expect(card().getAttribute("class")).not.toContain("border")
  })

  test("wears a tone of its own, named where the card fills are decided", () => {
    // The strip is not the pull request the reader came for, and a fill it
    // shares with the header card underneath leaves the two reading as one.
    // `quiet.css` sets that fill at a specificity a class cannot beat, so the
    // exception has to live there as well.
    render(<Proposed chain={pair} />)

    expect(card().getAttribute("class")).toContain("t-proposed")
    expect(quiet).toContain("section.t-proposed[aria-label]")
  })
})

describe("how big each layer of the proposal is", () => {
  /** A count of lines per pull request, said the way the gateway says it. */
  const measured =
    (counts: ReadonlyMap<number, { readonly added: number; readonly deleted: number }>) =>
    (
      references: ReadonlyArray<{ readonly number: number }>,
      tell: (number: number, size: { readonly added: number; readonly deleted: number }) => void
    ) =>
      Effect.sync(() => {
        for (const reference of references) {
          const found = counts.get(reference.number)
          if (found !== undefined) tell(reference.number, found)
        }
      })

  test("puts what it is told on the row of the layer it is about", async () => {
    render(
      <Proposed chain={pair} sizes={measured(new Map([[15, { added: 90, deleted: 4 }]]))} />
    )

    await waitFor(() =>
      expect(screen.getByRole("link", { name: /probe w 15/ }).textContent).toContain("+90")
    )
  })

  test("asks about every layer it draws but the one being read", async () => {
    // The pull request the reader is on was counted by the snapshot the strip
    // was drawn from, so a request for it would buy a number already in hand.
    const asked: Array<number> = []
    render(
      <Proposed
        chain={pair}
        sizes={(references) =>
          Effect.sync(() => {
            for (const reference of references) asked.push(reference.number)
          })
        }
      />
    )

    await waitFor(() => expect(asked).toEqual([15]))
  })

  test("draws the read pull request's own count without asking for it", () => {
    render(<Proposed chain={pair} own={{ added: 12, deleted: 3 }} />)

    const here = screen.getByRole("listitem", { current: true })

    expect(here.textContent).toContain("+12")
    expect(here.textContent).toContain("−3")
  })

  test("counts nothing where nobody wired a way to count", () => {
    render(<Proposed chain={pair} />)

    expect(card().textContent).not.toContain("+")
  })
})

describe("making the stack the strip describes", () => {
  const button = () => screen.getByRole("button", { name: "Make the stack" })
  /**
   * The same button, while GitHub has not answered.
   *
   * It says a different word then, which is what every control in this interface
   * that waits on GitHub does — the merge card's nine included. Found by that word
   * rather than by the resting one, so a test that presses and then reads the
   * button is reading the state it put it in.
   */
  const waiting = () => screen.getByRole("button", { name: "Making…" })
  const press = () => userEvent.click(button())

  test("offers nothing to press where nobody wired a way to make it", () => {
    // The window reads a pull request through a bridge that has no write for
    // this yet, and a button that cannot do what it says is worse than no
    // button at all.
    render(<Proposed chain={pair} />)

    expect(screen.queryByRole("button")).toBeNull()
  })

  test("stands the press at the head of the strip, above the rows it acts on", () => {
    render(<Proposed chain={pair} make={() => Effect.void} />)

    const order = button().compareDocumentPosition(screen.getByRole("list"))

    expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeGreaterThan(0)
    expect(button().parentElement?.contains(screen.getByRole("status"))).toBe(true)
  })

  test("deepens under a pointer, as every other press in this interface does", () => {
    render(<Proposed chain={pair} make={() => Effect.void} />)

    expect(button().getAttribute("class")).toContain("hover:opacity-90")
  })

  test("makes it on the first press, with nothing to confirm", async () => {
    // Unlike merging and closing, which ask twice. Those end the reading; this
    // one is described in full by the rows directly below the button, which is
    // the dialog GitHub asks its own second press in.
    let made = 0
    render(<Proposed chain={pair} make={() => Effect.sync(() => void (made += 1))} />)

    await press()

    await waitFor(() => expect(made).toBe(1))
  })

  test("turns a circle on the button while GitHub has not answered", async () => {
    render(<Proposed chain={pair} make={() => Effect.never} />)

    await press()

    await waitFor(() => expect(waiting().querySelector(".t-rotate")).not.toBeNull())
  })

  test("holds both its words in one cell, so the press does not move under the hand", async () => {
    /*
     * The circle used to be added to a button that said the same thing either
     * way, which is a box eighteen pixels wider than the one the reader aimed at.
     * The word it swaps to is what holds the room for the circle: see `Says`,
     * where the merge card's four words stand in the same one cell.
     */
    render(<Proposed chain={pair} make={() => Effect.never} />)

    const words = () => [...button().querySelectorAll(".t-says > .t-say")]

    expect(words().map((word) => word.textContent)).toEqual(["Make the stack", "Making…"])

    await press()

    await waitFor(() => expect(waiting().querySelectorAll(".t-say")).toHaveLength(2))
  })

  test("says GitHub is being asked, where a reader who is not looking is told", async () => {
    render(<Proposed chain={pair} make={() => Effect.never} />)

    await press()

    await waitFor(() => expect(said()).toBe("Making the stack."))
  })

  test("keeps the reader's place on the button while GitHub answers", async () => {
    // `disabled` on the focused button drops the reader onto the document, and
    // the sentence about what they just pressed is on a strip they are no
    // longer standing in.
    render(<Proposed chain={pair} make={() => Effect.never} />)

    await press()

    await waitFor(() => expect(waiting().getAttribute("aria-disabled")).toBe("true"))
    expect(waiting().hasAttribute("disabled")).toBe(false)
    expect(document.activeElement).toBe(waiting())
  })

  test("refuses a second press while the first is unanswered", async () => {
    let asked = 0
    render(
      <Proposed
        chain={pair}
        make={() =>
          Effect.sync(() => void (asked += 1)).pipe(Effect.andThen(() => Effect.never))
        }
      />
    )

    await press()
    await userEvent.click(waiting())

    expect(asked).toBe(1)
  })

  test("says the pull requests stack, once they do", async () => {
    render(<Proposed chain={pair} make={() => Effect.void} />)

    await press()

    await waitFor(() => expect(said()).toBe("These pull requests stack now."))
    // Nothing left to press: the stack exists, and the strip is waiting to be
    // replaced by the header's own tree of it.
    expect(screen.queryByRole("button")).toBeNull()
  })

  test("hands the reader's place to the strip when the button goes", async () => {
    // The button unmounts on the answer. A reader standing on it would be put
    // back at the top of the document, two cards above the sentence that says
    // what happened.
    render(<Proposed chain={pair} make={() => Effect.void} />)

    await press()

    await waitFor(() => expect(document.activeElement).toBe(card()))
  })

  test("says what GitHub said when it refuses, and offers the press again", async () => {
    render(
      <Proposed
        chain={pair}
        make={() => Effect.fail({ detail: "You can't stack these pull requests" })}
      />
    )

    await press()

    await waitFor(() => expect(said()).toBe("You can't stack these pull requests"))
    // Nothing was made, so the offer stands and the button is still the way to
    // act on it.
    expect(button().getAttribute("aria-disabled")).toBeNull()
  })

  test("drops what GitHub said about a chain it is no longer standing over", async () => {
    // The strip outlives the proposal it was drawn from: a re-read arrives with
    // other pull requests in it, and a refusal about the pair that is gone
    // would sit beside rows it was never about.
    const { rerender } = render(
      <Proposed chain={pair} make={() => Effect.fail({ detail: "GitHub said no" })} />
    )

    await press()
    await waitFor(() => expect(screen.getByText("GitHub said no")).toBeTruthy())

    rerender(<Proposed chain={otherPair} make={() => Effect.fail({ detail: "GitHub said no" })} />)

    expect(screen.queryByText("GitHub said no")).toBeNull()
    expect(said()).toBe("These pull requests can stack.")
  })
})
