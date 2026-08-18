import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { Wall } from "../github/signOn"
import { SignOn } from "./SignOn"

afterEach(cleanup)

const theWall: Wall = {
  organisation: "octo-org",
  action: "https://github.com/orgs/octo-org/saml/initiate?return_to=%2Focto-org%2Focto-repo%2Fpull%2F7",
  fields: [["authenticity_token", "a-real-token"]],
  backTo: "https://github.com/octo-org/octo-repo/pull/7"
}

const card = (props: Partial<React.ComponentProps<typeof SignOn>> = {}) => (
  <SignOn
    wall={theWall}
    chosen="ask"
    onChoose={() => {}}
    cameRound={false}
    onContinue={() => {}}
    onStepAside={() => {}}
    {...props}
  />
)

describe("the card that stands where their single sign-on wall was", () => {
  test("names the organisation, which is the whole of what a reader has to know", () => {
    render(card())

    expect(screen.getByRole("heading").textContent).toContain("octo-org wants a single sign-on")
  })

  /*
   * The one thing their own wall leaves out. A reader who opened a pull request an
   * hour ago and came back to a wall cannot tell from their page whether it is the
   * page they wanted, and the address bar says the same thing either way.
   */
  test("says which page is behind it, out of their own return address", () => {
    render(card())

    expect(screen.getByText(/octo-org\/octo-repo\/pull\/7/)).toBeTruthy()
  })

  test("still reads as a sentence where they sent no return address", () => {
    render(card({ wall: { ...theWall, backTo: "" } }))

    expect(screen.getByText(/will not serve this page/)).toBeTruthy()
  })

  test("posts their form on the button, which is what their own button does", () => {
    let asked = 0
    render(card({ onContinue: () => (asked += 1) }))

    fireEvent.click(screen.getByRole("button", { name: "Continue to octo-org" }))

    expect(asked).toBe(1)
  })

  test("gives their page back, so their own button is never out of reach", () => {
    // The way out of every mistake this screen can make, and it is a button rather
    // than a link because their wall was hidden and not removed.
    let aside = 0
    render(card({ onStepAside: () => (aside += 1) }))

    fireEvent.click(screen.getByRole("button", { name: "Show GitHub's page" }))

    expect(aside).toBe(1)
  })
})

describe("the offer to stop asking", () => {
  test("starts unticked, because answering for somebody is a thing to be asked for", () => {
    render(card())

    expect(screen.getByRole("checkbox").hasAttribute("checked")).toBe(false)
  })

  test("shows what the reader already chose, rather than the default", () => {
    render(card({ chosen: "always" }))

    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true)
  })

  test("asks for it on a tick, and takes it back on a second one", () => {
    const asked: Array<string> = []
    const { rerender } = render(card({ onChoose: (next) => asked.push(next) }))

    fireEvent.click(screen.getByRole("checkbox"))
    rerender(card({ chosen: "always", onChoose: (next) => asked.push(next) }))
    fireEvent.click(screen.getByRole("checkbox"))

    expect(asked).toEqual(["always", "ask"])
  })

  /*
   * The promise the tick has to keep, and the reason it is worded rather than
   * left as a label: nobody should read this as a way past their employer's
   * second factor, because it is not one.
   */
  test("says plainly that the identity provider still decides", () => {
    render(card())

    expect(screen.getByText(/identity provider still decides/)).toBeTruthy()
  })
})

describe("a wall that came round again", () => {
  test("says nothing about it on an ordinary wall", () => {
    render(card())

    expect(screen.queryByText(/answered for you a moment ago/)).toBeNull()
  })

  /*
   * A reader who switched this on and is looking at the card anyway would read the
   * setting as broken. It is working, and it has something to report.
   */
  test("explains itself where the same organisation is asking again", () => {
    render(card({ chosen: "always", cameRound: true }))

    expect(screen.getByText(/answered for you a moment ago/)).toBeTruthy()
  })

  /*
   * What it says is what it knows. Only their provider knows why the wall is up
   * again, so the sentence offers that as the usual reason and never as a report.
   */
  test("does not claim to know what the provider did", () => {
    render(card({ chosen: "always", cameRound: true }))

    expect(screen.getByText(/Usually that means/)).toBeTruthy()
  })

  test("and leaves the button where it was, so the reader can still get through", () => {
    render(card({ chosen: "always", cameRound: true }))

    expect(screen.getByRole("button", { name: "Continue to octo-org" })).toBeTruthy()
  })
})
