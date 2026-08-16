import { Effect } from "effect"
import { signInThroughBrowser } from "../src/bun/authorize"

/**
 * Does the browser get a page back, or a closed connection?
 *
 * A script rather than a test, and spawned by one, for two reasons. The suite
 * preloads happy-dom, which replaces the global `Response`: `Bun.serve` does not
 * recognise one of those and serves its own "Welcome to Bun!" page instead, so
 * the body — the whole of what is being checked here — cannot be read under
 * `bun test`. And the ordering being checked only happens with a real socket.
 *
 * The fault it guards is worth the subprocess. `signInThroughBrowser` closes the
 * door in a `finally`, which force-closes the connection the reply is still being
 * written to, so resolving the code inside the request handler gave the reader a
 * "site cannot be reached" page on a sign-in that had in fact worked: twenty out
 * of twenty tries, before the settle was moved onto a later turn of the loop.
 *
 *   bun scripts/check-door.ts
 */

const TRIES = 6

let pages = 0
let reset = 0

for (let attempt = 0; attempt < TRIES; attempt++) {
  const knocked = Promise.withResolvers<void>()

  await Effect.runPromise(
    signInThroughBrowser({
      waitMs: 2000,
      /*
       * Returns at once, the way `open` does: it spawns a browser and does not
       * wait for it. That is what puts the reply in flight while the door is
       * being closed, and a pretend browser that fetches before returning would
       * never see the fault.
       */
      open: async (url) => {
        const at = new URL(url)
        const redirect = at.searchParams.get("redirect_uri") ?? ""
        const state = at.searchParams.get("state") ?? ""

        setTimeout(() => {
          void fetch(`${redirect}?code=made-up&state=${state}`)
            .then((back) => back.text())
            .then((text) => {
              if (text.includes("You are signed in")) pages++
              else reset++
            })
            .catch(() => {
              reset++
            })
            .finally(() => knocked.resolve())
        }, 20)
      }
    }).pipe(
      // The code exchange fails: there is no GitHub here, and the code is made
      // up. What is being read is what the browser got, not what GitHub said.
      Effect.orElseSucceed(() => "expected")
    )
  )

  await knocked.promise
}

console.log(`pages delivered: ${pages}/${TRIES}, connections reset: ${reset}/${TRIES}`)

if (pages !== TRIES) {
  console.error("The door closed before the browser read the page.")
  process.exit(1)
}
