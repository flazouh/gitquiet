import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import { GatewayError, WorkingSetError } from "../ports/GitHubGateway"
import { ReadFailed } from "./ReadFailed"

afterEach(cleanup)

const card = (props: Partial<React.ComponentProps<typeof ReadFailed>> = {}) => (
  <ReadFailed
    signedOut={false}
    what="octo-org/octo-repo"
    onStepAside={() => {}}
    asideLabel="Show GitHub's page"
    {...props}
  />
)

const walled = new GatewayError({
  reference: { owner: "octo-org", repo: "octo-repo" },
  route: "",
  reason: "sign-on",
  detail: "single sign-on to octo-org"
})

describe("what a list shows when GitHub would not answer for it", () => {
  test("blames the payload where the shape is what changed", () => {
    render(
      card({
        why: new GatewayError({
          reference: { owner: "oven-sh", repo: "bun" },
          route: "",
          reason: "undecodable",
          detail: "no embedded payload"
        })
      })
    )

    expect(screen.getByText("Something GitHub sends has changed")).toBeTruthy()
  })

  test("blames the session where nobody is signed in", () => {
    render(card({ signedOut: true }))

    expect(screen.getByText("You are signed out of GitHub")).toBeTruthy()
  })

  /**
   * The case that sent a reader to file a bug during GitHub's incident of
   * 2026-08-17, and went on saying it for the length of the incident.
   *
   * A 503 was filed with the refusals and drawn as "something GitHub sends has
   * changed", which is a report of a fault in this extension about a page that had
   * none. What is on the screen has to name who broke, because that is the only thing
   * it can say that changes what the reader does next.
   */
  describe("GitHub itself being down", () => {
    const down = new GatewayError({
      reference: { owner: "OpenRouterIncubator", repo: "ori" },
      route: "/changes",
      reason: "down",
      detail: "HTTP 503"
    })

    test("says GitHub is having trouble, not that this could not read them", () => {
      render(card({ why: down }))

      expect(screen.getByText("GitHub is having trouble")).toBeTruthy()
      expect(screen.queryByText("Something GitHub sends has changed")).toBeNull()
    })

    test("offers their status page, which is where the answer actually is", () => {
      render(card({ why: down }))

      expect(screen.getByRole("link", { name: "GitHub status" }).getAttribute("href")).toBe(
        "https://www.githubstatus.com"
      )
    })

    /*
     * An incident answers everybody the same way, signed in or not. Reading the
     * session as the fault would send a reader who is already signed in round a login
     * that changes nothing, on the one afternoon they can least afford it.
     */
    test("does not send a signed-out reader to a login that would not help", () => {
      render(card({ signedOut: true, why: down }))

      expect(screen.getByText("GitHub is having trouble")).toBeTruthy()
      expect(screen.queryByText("You are signed out of GitHub")).toBeNull()
    })

    /*
     * A Working Set read has no repository on it, and this card is handed the cause
     * rather than the reason, so the read has to work off whatever arrived.
     */
    test("says the same about a Working Set, which names no repository", () => {
      render(
        card({
          what: "Your pull requests",
          why: new WorkingSetError({ route: "/pulls", reason: "down", detail: "HTTP 502" })
        })
      )

      expect(screen.getByText("GitHub is having trouble")).toBeTruthy()
    })
  })

  /**
   * The case this card used to get wrong, and the reason it is worth its own
   * wording: a reader who has only to press a button was being told GitHub had
   * changed shape, about a repository they could see the name of.
   */
  describe("an organisation waiting to be signed on to", () => {
    test("names the organisation rather than blaming GitHub", () => {
      render(card({ why: walled }))

      expect(screen.getByText("octo-org wants a single sign-on")).toBeTruthy()
      expect(screen.queryByText("Something GitHub sends has changed")).toBeNull()
    })

    test("offers their own page for it, coming back where the reader was", () => {
      render(card({ why: walled }))

      const link = screen.getByRole("link", { name: "Sign on to octo-org" })

      expect(link.getAttribute("href")).toBe(
        `https://github.com/orgs/octo-org/sso?return_to=${encodeURIComponent(location.href)}`
      )
    })

    test("keeps the way back to GitHub's own page, which is still there", () => {
      render(card({ why: walled }))

      expect(screen.getByRole("button", { name: "Show GitHub's page" })).toBeTruthy()
    })

    /*
     * A Working Set read has no repository to take the organisation from, and a
     * card that cannot say where to sign on is better off saying nothing about
     * it than sending the reader to a page that does not exist.
     */
    test("says nothing of a wall it cannot name, having no organisation", () => {
      render(
        card({
          what: "Your pull requests",
          why: new WorkingSetError({ route: "/pulls", reason: "sign-on", detail: "HTTP 401" })
        })
      )

      expect(screen.getByText("Something GitHub sends has changed")).toBeTruthy()
    })
  })
})
