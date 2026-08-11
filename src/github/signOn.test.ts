import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { signOnPage, signOnWanted } from "./signOn"

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
