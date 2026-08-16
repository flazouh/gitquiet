import { Effect } from "effect"
import { signInThroughBrowser } from "../src/bun/authorize"
import { CLIENT_ID, CLIENT_SECRET } from "../src/bun/oauth"

/**
 * The browser sign-in, without building the app around it.
 *
 * What it checks is the OAuth app: whether the client id exists, whether the
 * callback URL registered on it accepts a loopback port, and whether the secret
 * is the one that goes with the id. Every one of those fails as the same
 * sentence under the same button in the window, half a minute later.
 *
 *   GITHUB_CLIENT_ID=Ov23li… GITHUB_CLIENT_SECRET=… bun desktop/scripts/try-sign-in.ts
 *
 * With `--pretend` nothing opens and this plays the reader's browser itself:
 * it reads the redirect and the state out of the URL the app would have opened
 * and comes back with a made-up code, which GitHub then refuses. That is the
 * whole loop except the one leg that needs a person, so it is the way to check
 * the loopback door on a machine with no browser.
 *
 * With `--show` it prints the URL and waits, rather than opening a browser of its
 * own. That is the whole loop including the person, when the person is an agent
 * driving a browser it can see: the authorize page, the approval, the redirect
 * back, and a real token at the end.
 */

const pretending = process.argv.includes("--pretend")
const showing = process.argv.includes("--show")

// The id is published in every request this app makes. The secret is not, and
// four characters of it in a terminal is four characters of it in a transcript,
// a CI log, or a screen recording — so it is counted rather than shown.
console.log(`client id     ${CLIENT_ID === "" ? "(none set)" : CLIENT_ID}`)
console.log(`client secret ${CLIENT_SECRET === "" ? "(none set)" : `${CLIENT_SECRET.length} characters`}`)

const pretendBrowser = async (url: string) => {
  const asked = new URL(url)
  const redirect = asked.searchParams.get("redirect_uri") ?? ""
  const state = asked.searchParams.get("state") ?? ""

  console.log(`opened        ${asked.origin}${asked.pathname}`)
  console.log(`challenge     ${asked.searchParams.get("code_challenge_method")}`)
  console.log(`redirect      ${redirect}`)

  const back = await fetch(`${redirect}?code=a-made-up-code&state=${state}`)
  const shown = await back.text()
  console.log(
    `the door said ${back.status}, ${shown.includes("You are signed in") ? "the signed-in page" : "something else"}`
  )
}

/** Hands the URL over and waits, for whoever is driving a browser themselves. */
const showTheUrl = async (url: string) => {
  console.log(`approve this  ${url}`)
}

const browser = pretending ? { open: pretendBrowser } : showing ? { open: showTheUrl } : {}

const said = await Effect.runPromise(
  signInThroughBrowser(browser).pipe(
    Effect.map((token) => `signed in, token ${token.slice(0, 7)}…`),
    Effect.catch((cause) =>
      Effect.succeed(`refused: ${cause instanceof Error ? cause.message : String(cause)}`)
    )
  )
)

console.log(said)
