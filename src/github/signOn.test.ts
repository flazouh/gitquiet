import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { mayBeTheWall, signOnPage, signOnWanted, theirFormAgain, wallIn } from "./signOn"

const asked = (html: string) => Option.getOrNull(signOnWanted(html))

/**
 * Trimmed from what `GET /octo-org/octo-repo` actually answered: the class
 * on their `html` element, the heading, and the one form that names the
 * organisation. The links this must not mistake for it are on that page too.
 */
const theirSignOnPage = `<!DOCTYPE html>
<html lang="en" class="html-auth" data-color-mode="auto">
<head><title>Sign in to octo-org</title></head>
<body>
  <h1>Single sign-on to <strong>octo-org</strong></h1>
  <p id="sso-description">Authenticate your account by logging into octo-org's single sign-on provider.</p>
  <form data-turbo="false" action="https://github.com/orgs/octo-org/saml/initiate?return_to=https%3A%2F%2Fgithub.com%2Focto-org%2Focto-repo" method="post">
    <input type="hidden" name="authenticity_token" value="not-ours" />
  </form>
  <a href="/orgs/octo-org/sso_modal">modal</a>
  <a href="/orgs/octo-org/sso_status.json">status</a>
</body>
</html>`

describe("the organisation asking a reader to sign on", () => {
  test("names it, so the card can say where the reader is being sent", () => {
    expect(asked(theirSignOnPage)).toBe("octo-org")
  })

  test("says nothing of an ordinary page, which is every read that works", () => {
    const theirRepoPage = `<html lang="en" data-color-mode="auto"><body>
      <a href="/orgs/octo-org/sso_status.json">status</a>
    </body></html>`

    expect(asked(theirRepoPage)).toBeNull()
  })

  /*
   * The two mentions that are on their sign-on page and on every page of an
   * organisation the reader has already signed on for. Reading either of them as
   * the wall would put a sign-on card in front of a page that loaded.
   */
  test("passes over their modal and status links, which are not the wall", () => {
    const walled = `<html class="html-auth"><body>
      <a href="/orgs/octo-org/sso_modal">modal</a>
      <a href="/orgs/octo-org/sso_status.json">status</a>
    </body></html>`

    expect(asked(walled)).toBeNull()
  })

  test("sends the reader to their own page for it, and back where they were", () => {
    expect(signOnPage("octo-org", "https://github.com/octo-org/octo-repo")).toBe(
      "https://github.com/orgs/octo-org/sso?return_to=https%3A%2F%2Fgithub.com%2Focto-org%2Focto-repo"
    )
  })
})

const parsed = (html: string): Document => new DOMParser().parseFromString(html, "text/html")

/**
 * The wall as it is really served, trimmed to the parts this reads.
 *
 * Measured on `OpenRouterIncubator/ori` rather than written from their docs: the
 * class on the root element, the one child of `main` that says which auth page
 * this is, and the form with its two hidden fields. The token there is 86
 * characters of base64 on the live page and its length is the only thing about
 * it worth keeping.
 */
const theirWall = `<!DOCTYPE html>
<html lang="en" class="html-auth" data-color-mode="auto">
<head><title>Sign in to octo-org</title></head>
<body>
  <main>
    <div class="org-sso text-center">
      <h1>Single sign-on to <strong>octo-org</strong></h1>
      <form data-turbo="false" action="https://github.com/orgs/octo-org/saml/initiate?return_to=https%3A%2F%2Fgithub.com%2Focto-org%2Focto-repo%2Fpull%2F7" method="post">
        <input type="hidden" name="authenticity_token" value="a-real-token" />
        <input type="hidden" name="add_account" value="" />
        <button type="submit">Continue</button>
      </form>
    </div>
  </main>
</body>
</html>`

describe("their wall, read off the page the reader landed on", () => {
  test("names the organisation, which is the whole of what the card says", () => {
    expect(Option.getOrNull(wallIn(parsed(theirWall)))?.organisation).toBe("octo-org")
  })

  /*
   * The claim the whole feature rests on, and the one that was written down wrong
   * for a year: their form posts with a token, and the token is in the page. A
   * content script on this document can read it, so the Continue button is a
   * thing this can press rather than a place to send the reader.
   */
  test("reads the token out of their own form, which is what lets it be posted", () => {
    expect(Option.getOrNull(wallIn(parsed(theirWall)))?.fields).toContainEqual([
      "authenticity_token",
      "a-real-token"
    ])
  })

  /*
   * Their second field, which is empty and is carried anyway. The request being
   * sent is meant to be the one their own button sends, and a field left out is a
   * difference nobody here can predict the answer to.
   */
  test("carries every field of their form, including the empty one", () => {
    expect(Option.getOrNull(wallIn(parsed(theirWall)))?.fields).toEqual([
      ["authenticity_token", "a-real-token"],
      ["add_account", ""]
    ])
  })

  test("keeps their whole address, parameters and all, rather than rebuilding it", () => {
    expect(Option.getOrNull(wallIn(parsed(theirWall)))?.action).toBe(
      "https://github.com/orgs/octo-org/saml/initiate?return_to=https%3A%2F%2Fgithub.com%2Focto-org%2Focto-repo%2Fpull%2F7"
    )
  })

  test("says where the reader was going, so the card can name the page", () => {
    expect(Option.getOrNull(wallIn(parsed(theirWall)))?.backTo).toBe(
      "https://github.com/octo-org/octo-repo/pull/7"
    )
  })

  test("says nothing of an ordinary page, which is every page that loaded", () => {
    const theirRepoPage = `<html lang="en"><body><main><div id="repo-content-pjax-container"></div></main></body></html>`

    expect(Option.isNone(wallIn(parsed(theirRepoPage)))).toBe(true)
  })

  /*
   * Their other auth pages wear the same class: the password box, the second
   * factor, the device check. None of them is an organisation asking to be signed
   * on to, and taking one over would put this interface in front of the page a
   * reader signs in on.
   */
  test("passes over their other auth pages, which wear the same class", () => {
    const theirLogin = `<html class="html-auth"><body><main><div class="auth-form">
      <form action="/session" method="post">
        <input type="hidden" name="authenticity_token" value="a-real-token" />
      </form>
    </div></main></body></html>`

    expect(Option.isNone(wallIn(parsed(theirLogin)))).toBe(true)
  })

  test("passes over a wall whose form has lost its token, rather than posting nothing", () => {
    const tokenless = theirWall.replace('value="a-real-token"', 'value=""')

    expect(Option.isNone(wallIn(parsed(tokenless)))).toBe(true)
  })
})

describe("their form, built again so it can be posted", () => {
  const built = (): HTMLFormElement => {
    const page = parsed(theirWall)
    return theirFormAgain(page, Option.getOrThrow(wallIn(page)))
  }

  test("posts where theirs posts, address and parameters untouched", () => {
    expect(built().getAttribute("action")).toBe(
      "https://github.com/orgs/octo-org/saml/initiate?return_to=https%3A%2F%2Fgithub.com%2Focto-org%2Focto-repo%2Fpull%2F7"
    )
    expect(built().method).toBe("post")
  })

  test("carries their fields verbatim, which is what makes it their request", () => {
    const sent = [...built().querySelectorAll("input")].map((one) => [one.name, one.value])

    expect(sent).toEqual([
      ["authenticity_token", "a-real-token"],
      ["add_account", ""]
    ])
  })

  test("stays out of sight, because the card is what the reader is looking at", () => {
    expect(built().hidden).toBe(true)
  })
})

/**
 * The same question asked a few hundred milliseconds earlier, when the answer has
 * to come from the root element alone.
 */
describe("the guess made before their page has been parsed", () => {
  test("recognises an auth page of theirs by the class on its root", () => {
    expect(mayBeTheWall(parsed(theirWall))).toBe(true)
  })

  test("says no to every ordinary page, which is what keeps the gate off them", () => {
    expect(mayBeTheWall(parsed("<html><body><main></main></body></html>"))).toBe(false)
  })

  /*
   * True here and false in `wallIn` above, deliberately. This is the guess that
   * holds their page back before there is anything to read; the reading is what
   * hands it straight back where the guess was wrong.
   */
  test("is only a guess, so their login page passes it and fails the reading", () => {
    const theirLogin = parsed(`<html class="html-auth"><body><main></main></body></html>`)

    expect(mayBeTheWall(theirLogin)).toBe(true)
    expect(Option.isNone(wallIn(theirLogin))).toBe(true)
  })
})
