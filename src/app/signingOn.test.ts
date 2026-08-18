import { describe, expect, test } from "bun:test"
import { DEFAULTS, type Settings } from "../domain/Settings"
import { inSession, ROUND_AGAIN, whatTheWallGets } from "./signingOn"

/** A tab's storage, and nothing else about a browser. */
const aTab = (): Storage => {
  const held = new Map<string, string>()
  return {
    getItem: (key) => held.get(key) ?? null,
    setItem: (key, value) => {
      held.set(key, value)
    },
    removeItem: (key) => {
      held.delete(key)
    },
    clear: () => held.clear(),
    key: (at) => [...held.keys()][at] ?? null,
    get length() {
      return held.size
    }
  } satisfies Storage
}

/** A tab that will not remember anything, which is a private window. */
const aSealedTab = (): Storage =>
  ({
    getItem: () => {
      throw new Error("no")
    },
    setItem: () => {
      throw new Error("no")
    },
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0
  }) satisfies Storage

const parsed = (html: string): Document => new DOMParser().parseFromString(html, "text/html")

/**
 * Their wall, trimmed to what this decision reads. The same page
 * `src/github/signOn.test.ts` asserts the parsing of, so the two files agree about
 * what a wall is.
 */
const theWall = (organisation = "octo-org"): Document =>
  parsed(`<!DOCTYPE html>
<html lang="en" class="html-auth">
<body><main><div class="org-sso text-center">
  <form action="https://github.com/orgs/${organisation}/saml/initiate?return_to=%2Focto-org%2Focto-repo%2Fpull%2F7" method="post">
    <input type="hidden" name="authenticity_token" value="a-real-token" />
  </form>
</div></main></body></html>`)

/** Their login box, which wears the same class and is not this screen's business. */
const theirLogin = (): Document =>
  parsed(`<!DOCTYPE html>
<html lang="en" class="html-auth">
<body><main><div class="auth-form"><form action="/session" method="post">
  <input type="hidden" name="authenticity_token" value="a-real-token" />
</form></div></main></body></html>`)

const asking: Settings = { ...DEFAULTS, signOn: { byItself: "ask" } }
const byItself: Settings = { ...DEFAULTS, signOn: { byItself: "always" } }

describe("what a page wearing their auth class gets", () => {
  test("hands their login page straight back, which the reader has to be able to use", () => {
    const doing = whatTheWallGets(theirLogin(), byItself, inSession(aTab()), 1_000)

    expect(doing.go).toBe("hand back")
  })

  /*
   * The setting that means "leave their site alone". A wall is still their site,
   * and a reader who turned this extension off on GitHub's pages has not asked for
   * a card on this one.
   */
  test("hands the wall back to a reader who asked for GitHub's own pages", () => {
    const theirs: Settings = { ...byItself, page: { view: "github" } }
    const doing = whatTheWallGets(theWall(), theirs, inSession(aTab()), 1_000)

    expect(doing.go).toBe("hand back")
  })

  test("draws the card on the wall, where the reader never asked for more", () => {
    const doing = whatTheWallGets(theWall(), asking, inSession(aTab()), 1_000)

    expect(doing).toMatchObject({ go: "ask", cameRound: false })
  })

  test("hands the card the wall it is about, so it can name the organisation", () => {
    const doing = whatTheWallGets(theWall("acme"), asking, inSession(aTab()), 1_000)

    expect(doing.go === "ask" ? doing.wall.organisation : null).toBe("acme")
  })
})

describe("answering their single sign-on without being asked", () => {
  test("answers it, where the reader asked for that and the tab is new to it", () => {
    const doing = whatTheWallGets(theWall(), byItself, inSession(aTab()), 1_000)

    expect(doing.go).toBe("answer")
  })

  /*
   * The loop this guard exists for. A provider whose own session has lapsed sends
   * the reader straight back to the wall, so the page that was just answered is
   * the page that comes back — and answering it again is an address that flickers
   * until the tab is closed.
   */
  test("does not answer the same wall twice in a breath, which would be a loop", () => {
    const lately = inSession(aTab())
    lately.note("octo-org", 1_000)

    expect(whatTheWallGets(theWall(), byItself, lately, 2_000)).toMatchObject({
      go: "ask",
      cameRound: true
    })
  })

  test("answers again once the window has passed, so a real lapse is still handled", () => {
    const lately = inSession(aTab())
    lately.note("octo-org", 1_000)

    expect(whatTheWallGets(theWall(), byItself, lately, 1_000 + ROUND_AGAIN).go).toBe("answer")
  })

  test("holds each organisation apart, so one bounce does not stall the others", () => {
    const lately = inSession(aTab())
    lately.note("octo-org", 1_000)

    expect(whatTheWallGets(theWall("other-org"), byItself, lately, 2_000).go).toBe("answer")
  })

  test("asks the reader where the tab will not remember anything", () => {
    // A private window throws rather than answers. The card is the safe half of
    // that trade: it is what breaks the loop this guard is for.
    const lately = inSession(aSealedTab())
    lately.note("octo-org", 1_000)

    expect(whatTheWallGets(theWall(), byItself, lately, 1_000).go).toBe("answer")
  })

  test("and where reaching for the storage threw before there was one", () => {
    // Some managed profiles throw on the property rather than on the call, which
    // is why the absence is a value this is handed rather than an error it traps.
    const lately = inSession(undefined)
    lately.note("octo-org", 1_000)

    expect(whatTheWallGets(theWall(), byItself, lately, 1_000).go).toBe("answer")
  })

  /*
   * The state the two predicates this replaced could describe between them, and
   * that no wall is ever in: a reader who never switched this on, being told why
   * it did not happen. One answer rather than two is what makes it unsayable.
   */
  test("never explains itself to a reader who did not switch it on", () => {
    const lately = inSession(aTab())
    lately.note("octo-org", 1_000)

    expect(whatTheWallGets(theWall(), asking, lately, 2_000)).toMatchObject({
      go: "ask",
      cameRound: false
    })
  })
})
