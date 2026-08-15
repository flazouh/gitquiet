import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { Option } from "effect"
import type { Person } from "../domain/person"
import { usePerson } from "./usePerson"

afterEach(cleanup)

/** How long the probe watches. Short, because every test here is about the watching. */
const WATCHING = 120

const someone = (over: Partial<Person> = {}): Person => ({
  login: "flazouh",
  name: Option.some("Alex"),
  bio: Option.none(),
  faceUrl: Option.none(),
  company: Option.none(),
  location: Option.none(),
  followers: Option.none(),
  following: Option.none(),
  site: Option.none(),
  ways: [],
  sponsorAt: Option.none(),
  tally: { repositories: Option.none(), stars: Option.none() },
  ...over
})

/**
 * What the hook hands over, as one line of text.
 *
 * The followers stand in for the rest of the card, because they are what a half-parsed
 * page has not written yet: a first read that answers with a name and nothing under it is
 * the fault this hook exists for.
 */
const Probe = ({ read }: { readonly read: (page: Document) => Option.Option<Person> }) => {
  const who = usePerson(read, document, WATCHING)
  return <p>{who === undefined ? "nobody" : `${Option.getOrElse(who.followers, () => "no")} followers`}</p>
}

/** GitHub writing to their half of the page, which is what the hook is watching for. */
const stir = (): void => {
  document.body.append(document.createElement("div"))
}

const rested = (): Promise<void> =>
  new Promise((resume) => setTimeout(resume, WATCHING * 2))

describe("who the served page says they are", () => {
  test("hands over what the first read found", () => {
    render(<Probe read={() => Option.some(someone({ followers: Option.some("25") }))} />)

    expect(screen.getByText("25 followers")).toBeTruthy()
  })

  test("hands over nothing where their card is not there yet", () => {
    render(<Probe read={() => Option.none()} />)

    expect(screen.getByText("nobody")).toBeTruthy()
  })

  test("reads again when GitHub writes to the page", async () => {
    // The fault on the live page: the screen starts at `document_start`, so the first
    // read runs against a document a few kilobytes long and their card arrives after it.
    let parsed = false
    render(
      <Probe
        read={() =>
          Option.some(someone({ followers: parsed ? Option.some("25") : Option.none() }))
        }
      />
    )
    expect(screen.getByText("no followers")).toBeTruthy()

    parsed = true
    stir()

    await waitFor(() => expect(screen.getByText("25 followers")).toBeTruthy())
  })

  test("stops watching, rather than observing the page behind a reader", async () => {
    let parsed = false
    render(
      <Probe
        read={() =>
          Option.some(someone({ followers: parsed ? Option.some("25") : Option.none() }))
        }
      />
    )

    await rested()
    parsed = true
    stir()
    await rested()

    expect(screen.getByText("no followers")).toBeTruthy()
  })
})
