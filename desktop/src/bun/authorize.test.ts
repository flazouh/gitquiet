import { describe, expect, test } from "bun:test"
import {
  authorizeUrl,
  challengeFor,
  doorOnLoopback,
  newVerifier,
  whatTheReplySays
} from "./authorize"

describe("challengeFor", () => {
  /*
   * The pair from RFC 7636 appendix B, which is the one place a hash like this
   * can be checked against something other than itself. A test that hashed a
   * string and compared it with our own hash of the same string would pass with
   * the wrong encoding, the wrong padding, or the wrong algorithm.
   */
  test("answers the challenge RFC 7636 says it should", () => {
    expect(challengeFor("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
    )
  })
})

describe("newVerifier", () => {
  test("is long enough for GitHub, which refuses anything under 43 characters", () => {
    expect(newVerifier().length).toBeGreaterThanOrEqual(43)
  })

  test("holds only the characters the RFC allows, so nothing needs escaping", () => {
    expect(newVerifier()).toMatch(/^[A-Za-z0-9\-._~]+$/)
  })

  test("is a different one every time", () => {
    expect(newVerifier()).not.toBe(newVerifier())
  })
})

describe("authorizeUrl", () => {
  const url = new URL(
    authorizeUrl({
      clientId: "Ov23liExample",
      redirect: "http://127.0.0.1:49222/callback",
      state: "the-state",
      challenge: "the-challenge"
    })
  )

  test("sends the reader to GitHub", () => {
    expect(`${url.origin}${url.pathname}`).toBe("https://github.com/login/oauth/authorize")
  })

  test("names the app, the scope and where to come back to", () => {
    expect(url.searchParams.get("client_id")).toBe("Ov23liExample")
    expect(url.searchParams.get("scope")).toBe("repo")
    expect(url.searchParams.get("redirect_uri")).toBe("http://127.0.0.1:49222/callback")
  })

  test("carries the challenge, and says S256 because GitHub takes nothing else", () => {
    expect(url.searchParams.get("code_challenge")).toBe("the-challenge")
    expect(url.searchParams.get("code_challenge_method")).toBe("S256")
    expect(url.searchParams.get("state")).toBe("the-state")
  })
})

describe("whatTheReplySays", () => {
  const at = (query: string) => `http://127.0.0.1:49222/callback?${query}`

  test("reads the code out of a reply that came from this sign-in", () => {
    expect(whatTheReplySays(at("code=the-code&state=the-state"), "the-state")).toEqual({
      at: "code",
      code: "the-code"
    })
  })

  test("refuses a reply carrying somebody else's state", () => {
    expect(whatTheReplySays(at("code=the-code&state=another"), "the-state")).toEqual({
      at: "refused",
      why: "That reply did not come from this window's sign-in."
    })
  })

  test("says what GitHub said when the reader pressed cancel", () => {
    expect(
      whatTheReplySays(
        at("error=access_denied&error_description=The+reader+said+no&state=the-state"),
        "the-state"
      )
    ).toEqual({ at: "refused", why: "The reader said no" })
  })

  test("falls back to GitHub's error code when they sent no sentence", () => {
    expect(whatTheReplySays(at("error=access_denied"), "the-state")).toEqual({
      at: "refused",
      why: "access_denied"
    })
  })

  test("refuses a reply with the right state and no code", () => {
    expect(whatTheReplySays(at("state=the-state"), "the-state")).toEqual({
      at: "refused",
      why: "GitHub sent the reader back without a code."
    })
  })

  test("lets everything else past, which is a browser asking for an icon", () => {
    expect(whatTheReplySays("http://127.0.0.1:49222/favicon.ico", "the-state")).toEqual({
      at: "elsewhere"
    })
  })
})

describe("doorOnLoopback", () => {
  /*
   * The two facts about the server itself. What it does with a reply is
   * `whatTheReplySays` above, decided apart from the socket — which is also
   * what makes it testable here: `tests/setup.ts` registers happy-dom, whose
   * `Response` is not the class `Bun.serve` accepts, so a request made from
   * inside a test is answered by Bun's own welcome page rather than by ours.
   */
  test("listens on the loopback interface, on a port it chose", () => {
    const door = doorOnLoopback({ state: "s" })
    try {
      expect(door.redirect).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/callback$/)
    } finally {
      door.close()
    }
  })

  test("gives up on its own, so a reader who wandered off leaves nothing listening", async () => {
    const door = doorOnLoopback({ state: "the-state", waitMs: 10 })
    try {
      await expect(door.code).rejects.toThrow(/did not finish/)
    } finally {
      door.close()
    }
  })

  /*
   * The third fact, which cannot be read from in here: whether the browser gets
   * the page before the door is closed on it. Settling the code resumes
   * `signInThroughBrowser`, whose `finally` force-closes this server, and the
   * reply is still being written when it does — twenty tries out of twenty gave
   * the browser a reset connection on a sign-in that had worked.
   *
   * Spawned rather than written here because reading the body is the whole check
   * and happy-dom's `Response`, which this file runs under, never reaches the
   * socket. The script exits non-zero on its own; this is the run.
   */
  test("hands the browser the page before it closes the door", async () => {
    const ran = Bun.spawnSync(["bun", `${import.meta.dir}/../../scripts/check-door.ts`], {
      env: { ...process.env, GITHUB_CLIENT_ID: "checking", GITHUB_CLIENT_SECRET: "checking" }
    })

    expect(ran.stdout.toString().trim()).toEndWith("connections reset: 0/6")
    expect(ran.exitCode).toBe(0)
  }, 20_000)
})
