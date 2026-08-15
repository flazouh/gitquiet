import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { Option } from "effect"
import type { Person } from "../domain/person"
import { type TheirColumn, usePerson } from "./usePerson"

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
const Probe = ({
  read,
  login = "flazouh",
  elsewhere
}: {
  readonly read: (page: Document) => Option.Option<Person>
  readonly login?: string
  readonly elsewhere?: TheirColumn
}) => {
  const who = usePerson(read, login, elsewhere, document, WATCHING)
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

  /*
   * A press this extension answered itself: no document loaded, so the page under the
   * screen is the issue the reader pressed from and their card is not in it. Reading it
   * again for four seconds finds nothing four seconds later.
   */
  test("takes the column from elsewhere where the page is not theirs", async () => {
    render(
      <Probe
        read={() => Option.none()}
        elsewhere={(found) => found(someone({ followers: Option.some("25") }))}
      />
    )

    await waitFor(() => expect(screen.getByText("25 followers")).toBeTruthy())
  })

  test("keeps the page's own card over one read from elsewhere", async () => {
    render(
      <Probe
        read={() => Option.some(someone({ followers: Option.some("25") }))}
        elsewhere={(found) => found(someone({ followers: Option.some("11") }))}
      />
    )

    await rested()

    expect(screen.getByText("25 followers")).toBeTruthy()
  })

  /*
   * One person's page pressed from another's. No document loads, and the screen redraws
   * in the container it is already standing in — so the card in the markup underneath is
   * still the person the reader left, and reading it would draw their face over the name
   * of somebody else.
   */
  test("declines a card for somebody else, and takes the right one from elsewhere", async () => {
    render(
      <Probe
        login="sindresorhus"
        read={() => Option.some(someone({ login: "flazouh", followers: Option.some("25") }))}
        elsewhere={(found) =>
          found(someone({ login: "sindresorhus", followers: Option.some("11") }))
        }
      />
    )

    await waitFor(() => expect(screen.getByText("11 followers")).toBeTruthy())
    await rested()
    expect(screen.getByText("11 followers")).toBeTruthy()
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
