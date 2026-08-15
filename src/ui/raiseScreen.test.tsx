import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect } from "effect"
import { NOTHING_YET, type Raised, type Raising } from "../domain/raising"
import { RaiseScreen } from "./RaiseScreen"

afterEach(cleanup)

const REPO = { owner: "octo-org", repo: "octo-repo" }

const LANDED: Raised = { owner: REPO.owner, repo: REPO.repo, number: 412 }

const TITLE = "What happened, in one line"

type Answered = {
  readonly raise?: (draft: Raising) => Effect.Effect<Raised, unknown>
  readonly seed?: Raising
  readonly onRaised?: (raised: Raised) => void
  readonly onStepAside?: () => void
}

/*
 * Queried inside what this test rendered, rather than through `screen`.
 *
 * Nothing clears the document between files here, so by the time these run it
 * holds every box every other test opened — and "the textbox" would be several of
 * them. Asking within this render is the difference between a test that passes on
 * its own and one that passes in the suite.
 */
const drawn = ({
  raise = () => Effect.succeed(LANDED),
  seed = NOTHING_YET,
  onRaised = () => {},
  onStepAside = () => {}
}: Answered = {}) =>
  within(
    render(
      <RaiseScreen
        repo={REPO}
        seed={seed}
        onRaise={raise}
        onRaised={onRaised}
        onStepAside={onStepAside}
      />
    ).container
  )

const title = (form: ReturnType<typeof drawn>): HTMLInputElement =>
  form.getByLabelText(TITLE) as HTMLInputElement

const body = (form: ReturnType<typeof drawn>): HTMLTextAreaElement =>
  form.getByPlaceholderText(/reproduce it/) as HTMLTextAreaElement

describe("the form for raising an issue", () => {
  test("says which repository the issue is being raised in", () => {
    // A form that does not say where it writes is a form that can write to the
    // wrong repository without anybody noticing.
    expect(drawn().getByText("octo-org/octo-repo")).toBeTruthy()
  })

  test("sends the title and the description, once", async () => {
    const asked: Array<Raising> = []
    const form = drawn({
      raise: (draft) =>
        Effect.sync(() => {
          asked.push(draft)
          return LANDED
        })
    })

    await userEvent.type(title(form), "octo-repo login loops on an expired token")
    await userEvent.type(body(form), "Every second run, on a cold keychain.")
    await userEvent.click(form.getByText("Raise it"))

    await waitFor(() =>
      expect(asked).toEqual([
        {
          title: "octo-repo login loops on an expired token",
          body: "Every second run, on a cold keychain."
        }
      ])
    )
    /*
     * Seventy-seven keystrokes, against a five second default.
     *
     * `userEvent.type` sends a key at a time and the form draws again on each
     * one, so the two sentences above cost seventy-seven renders. That is the
     * point — the draft has to survive being typed rather than assigned — but on
     * two slow cores under `--parallel` it crosses five seconds, and a killed
     * test reads as the form failing to send.
     */
  }, 20_000)

  test("goes to the issue GitHub gave a number to", async () => {
    const went: Array<Raised> = []
    const form = drawn({ onRaised: (raised) => went.push(raised) })

    await userEvent.type(title(form), "a thing that happened")
    await userEvent.click(form.getByText("Raise it"))

    await waitFor(() => expect(went).toEqual([LANDED]))
  })

  test("turns a circle on the button while GitHub has not answered", async () => {
    /*
     * The button is left saying "Raising…" on purpose — the next thing that
     * happens is the issue's own page, and a button that un-presses itself first
     * reads as a press that did not take — which made it the one control here that
     * says a wait and then says nothing else for as long as the wait lasts.
     */
    const form = drawn({ raise: () => Effect.never })

    await userEvent.type(title(form), "something to report")
    await userEvent.click(form.getByText("Raise it"))

    await waitFor(() =>
      expect(form.getByRole("button", { name: "Raising…" }).querySelector(".t-rotate")).not.toBeNull()
    )
  })

  test("opens with what the address seeded it with, so a report link is not thrown away", () => {
    const form = drawn({
      seed: { title: "Crash on paste", body: "```\nTypeError\n```" }
    })

    expect(title(form).value).toBe("Crash on paste")
    expect(body(form).value).toBe("```\nTypeError\n```")
  })

  test("will not send without a title, which is what their own form requires", async () => {
    let asked = 0
    const form = drawn({
      raise: () =>
        Effect.sync(() => {
          asked += 1
          return LANDED
        })
    })

    await userEvent.type(body(form), "a description and nothing else")
    await userEvent.click(form.getByText("Raise it"))

    expect(asked).toBe(0)
  })

  /*
   * The words stay. Whatever GitHub objected to, what was typed is the one thing
   * on this screen that cannot be fetched again.
   */
  test("keeps what was typed and says what was refused", async () => {
    const form = drawn({ raise: () => Effect.fail(new Error("Title can't be blank")) })

    await userEvent.type(title(form), "worth keeping")
    await userEvent.type(body(form), "and this too")
    await userEvent.click(form.getByText("Raise it"))

    await waitFor(() => expect(form.getByText(/would not take that/)).toBeTruthy())
    expect(form.getByText(/Title can't be blank/)).toBeTruthy()
    expect(title(form).value).toBe("worth keeping")
    expect(body(form).value).toBe("and this too")
  })

  test("can be sent from the title box, which is where the caret starts", async () => {
    const asked: Array<Raising> = []
    const form = drawn({
      raise: (draft) =>
        Effect.sync(() => {
          asked.push(draft)
          return LANDED
        })
    })

    await userEvent.type(title(form), "sent without leaving the title{Meta>}{Enter}{/Meta}")

    await waitFor(() => expect(asked).toHaveLength(1))
    expect(asked[0]?.title).toBe("sent without leaving the title")
  })

  test("hands the page back to GitHub's own form when asked", async () => {
    let aside = 0
    const form = drawn({
      onStepAside: () => {
        aside += 1
      }
    })

    await userEvent.click(form.getByText("Show GitHub's form"))

    expect(aside).toBe(1)
  })
})
