import { Effect } from "effect"
import { GitHubUnreachable } from "./api"
import { AUTHORIZE, CLIENT_ID, CLIENT_SECRET, postForm, SCOPE, TOKEN } from "./oauth"

/**
 * Signing in the way GitHub asks a windowed app to.
 *
 * The reader presses one button, their own browser opens on github.com, they
 * approve, and the window is signed in. Nothing is typed and nothing is copied,
 * because the browser is sent back to a server this process started on the
 * loopback interface a moment earlier.
 *
 * This is the authorization code flow with PKCE, and it is here rather than the
 * device flow because GitHub's own guidance for a GUI application says so:
 *
 *   "It is preferable to use the authorization code with PKCE over the device
 *    flow... The device flow does not require redirect URIs at all, which means
 *    that an attacker can use the device flow to remotely impersonate your app
 *    as part of a phishing attack. For this reason, do not enable the device
 *    flow for your application unless you are using the app in a constrained
 *    environment (CLIs, IoT devices, or headless systems)."
 *
 * A code typed into a page is a code somebody else can talk a reader into
 * typing. PKCE closes the other end of the same problem: the code GitHub sends
 * back is worthless without the verifier, which never leaves this process, so a
 * code read off the loopback redirect cannot be redeemed anywhere else.
 *
 * `device.ts` stays for the constrained case GitHub names — a machine with no
 * browser to open — and the panel offers it as the second way rather than the
 * first.
 */

/** The path GitHub is told to come back to, and the one this answers. */
const CALLBACK = "/callback"

const base64url = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url")

/**
 * A verifier, which is the secret the whole exchange rests on.
 *
 * Thirty-two random bytes, because base64url of thirty-two bytes is exactly the
 * forty-three characters RFC 7636 sets as the minimum and GitHub enforces. The
 * alphabet is already the RFC's unreserved set, so nothing here needs escaping
 * on the way out.
 */
export const newVerifier = (): string => base64url(crypto.getRandomValues(new Uint8Array(32)))

/** The verifier, hashed the one way GitHub accepts: SHA-256, base64url, no padding. */
export const challengeFor = (verifier: string): string =>
  base64url(new Bun.CryptoHasher("sha256").update(verifier).digest())

export const authorizeUrl = (it: {
  readonly clientId: string
  readonly redirect: string
  readonly state: string
  readonly challenge: string
}): string => {
  const asked = new URL(AUTHORIZE)
  asked.searchParams.set("client_id", it.clientId)
  asked.searchParams.set("redirect_uri", it.redirect)
  asked.searchParams.set("scope", SCOPE)
  asked.searchParams.set("state", it.state)
  asked.searchParams.set("code_challenge", it.challenge)
  // The only method GitHub takes. `plain` is refused, which is the right way round.
  asked.searchParams.set("code_challenge_method", "S256")
  return asked.toString()
}

/** What the reader's browser is left looking at, so the tab says something. */
const page = (heading: string, sentence: string) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><title>GitQuiet</title>` +
      `<body style="margin:0;display:grid;place-items:center;height:100vh;` +
      `font:15px/1.5 -apple-system,system-ui,sans-serif;color:#e8e8e8;background:#141414">` +
      `<div style="text-align:center"><h1 style="font-size:17px;margin:0 0 6px">${heading}</h1>` +
      `<p style="margin:0;color:#9a9a9a">${sentence}</p></div>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  )

/**
 * What a reply to the door means, which is the whole of what can go wrong.
 *
 * Said as data and decided apart from the server, because this is where the
 * security of the redirect leg lives and a socket is a poor place to read it.
 * `elsewhere` is not an error: a browser sent to a page asks that page for an
 * icon, and a door that treated that as the reader coming back would refuse
 * every sign-in in Safari.
 */
export type Reply =
  | { readonly at: "elsewhere" }
  | { readonly at: "code"; readonly code: string }
  | { readonly at: "refused"; readonly why: string }

export const whatTheReplySays = (url: string, state: string): Reply => {
  const asked = new URL(url)
  if (asked.pathname !== CALLBACK) return { at: "elsewhere" }

  const said = asked.searchParams

  // GitHub's own words. A reader who pressed cancel is not news this app invents.
  const wrong = said.get("error")
  if (wrong !== null) return { at: "refused", why: said.get("error_description") ?? wrong }

  // The reason `state` is sent at all: a reply that carries a different one was
  // not started by this window, so its code is not ours to spend.
  if (said.get("state") !== state) {
    return { at: "refused", why: "That reply did not come from this window's sign-in." }
  }

  const given = said.get("code")
  if (given === null || given === "") {
    return { at: "refused", why: "GitHub sent the reader back without a code." }
  }

  return { at: "code", code: given }
}

export type Door = {
  /** Where GitHub is told to send them, port and all. */
  readonly redirect: string
  /** The code, once a browser arrives carrying one. */
  readonly code: Promise<string>
  readonly close: () => void
}

/**
 * A server that exists for one reply and then stops.
 *
 * Bound to `127.0.0.1` rather than to every interface, and on a port the
 * operating system picks: GitHub matches the callback URL registered on the app
 * by host and path and lets the port vary, which is what their documentation
 * spells out for exactly this case. A fixed port would be one more thing to be
 * already in use.
 *
 * Three replies are told apart, because they are three different sentences on
 * the panel. A reply carrying the state this door was opened with is the reader
 * coming back. A reply carrying a different one did not come from the sign-in
 * this window started, and is the case `state` exists for. A reply carrying an
 * error is GitHub saying the reader pressed cancel, and is not this app's news
 * to invent.
 */
export const doorOnLoopback = (opts: {
  readonly state: string
  /** How long a person gets. GitHub's own code expires after ten minutes. */
  readonly waitMs?: number
}): Door => {
  let settle: (code: string) => void = () => {}
  let refuse: (why: Error) => void = () => {}
  const code = new Promise<string>((resolve, reject) => {
    settle = resolve
    refuse = reject
  })

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: (request) => {
      const said = whatTheReplySays(request.url, opts.state)

      if (said.at === "elsewhere") return new Response("Nothing here.", { status: 404 })

      if (said.at === "refused") {
        refuse(new Error(said.why))
        return page("GitQuiet did not sign you in.", "You can close this tab.")
      }

      settle(said.code)
      return page("You are signed in.", "You can close this tab and go back to GitQuiet.")
    }
  })

  const giveUp = setTimeout(
    () => refuse(new Error("The sign-in did not finish in time.")),
    opts.waitMs ?? 10 * 60 * 1000
  )

  const close = () => {
    clearTimeout(giveUp)
    void server.stop(true)
  }

  // Read once and checked, because the port is the one part of the redirect
  // GitHub cannot be given a wrong answer for: interpolating an absent port
  // would send the reader to `127.0.0.1:undefined` and read as GitHub refusing
  // a callback URL that was never built.
  const port = server.port
  if (port === undefined) {
    close()
    throw new Error("Nothing was listening for the sign-in to come back to.")
  }

  return { redirect: `http://127.0.0.1:${port}${CALLBACK}`, code, close }
}

/** The reader's own browser, which is the only one this app is allowed to use. */
const openOutside = async (url: string): Promise<void> => {
  await Bun.$`open ${url}`.quiet()
}

/**
 * The whole sign-in: open the browser, wait for the reader, exchange the code.
 *
 * `open` is a seam so that a test can watch the URL this hands over without a
 * browser window appearing on somebody's screen.
 *
 * The door is closed in a `finally` rather than after the exchange, because
 * every way out of here leaves a server listening otherwise: a reader who
 * pressed cancel, a state that did not match, a token endpoint that refused.
 */
export const signInThroughBrowser = Effect.fn("signInThroughBrowser")(function* (
  opts: {
    readonly open?: (url: string) => Promise<void>
    readonly waitMs?: number
  } = {}
) {
  const open = opts.open ?? openOutside
  const verifier = newVerifier()
  const state = newVerifier()

  const code = yield* Effect.tryPromise({
    try: async () => {
      const door = doorOnLoopback({ state, waitMs: opts.waitMs })
      try {
        await open(
          authorizeUrl({
            clientId: CLIENT_ID,
            redirect: door.redirect,
            state,
            challenge: challengeFor(verifier)
          })
        )
        return { given: await door.code, redirect: door.redirect }
      } finally {
        door.close()
      }
    },
    // Said in the door's own words where it has any: every one of them is a
    // sentence the panel can put under the button.
    catch: (cause) => (cause instanceof Error ? cause : new GitHubUnreachable(String(cause)))
  })

  const it = yield* postForm<{
    access_token?: string
    error?: string
    error_description?: string
  }>(TOKEN, {
    client_id: CLIENT_ID,
    // Asked for by GitHub even with PKCE, and shipped inside the app because
    // there is nowhere else for it to be. See `oauth.ts`.
    client_secret: CLIENT_SECRET,
    code: code.given,
    redirect_uri: code.redirect,
    code_verifier: verifier
  })

  if (it.access_token === undefined) {
    return yield* Effect.fail(
      new GitHubUnreachable(it.error_description ?? it.error ?? "GitHub refused the sign-in")
    )
  }

  return it.access_token
})
