import { Duration, Effect } from "effect"
import type { Pending } from "../shared/wire"
import { GitHubUnreachable } from "./api"
import {
  canSignInWithACode,
  CLIENT_ID,
  NO_OAUTH_APP,
  postForm,
  SCOPE,
  SignInRefused,
  TOKEN
} from "./oauth"

/**
 * Signing in on a machine with no browser to open.
 *
 * GitHub's device flow: we ask for a pair of codes, the reader types the short
 * one into github.com on whatever device they like, and we poll until GitHub
 * says they did. No embedded login form — an app that draws its own GitHub
 * password field is an app teaching its readers to type their password into
 * anything that looks the part — and no client secret, because their own
 * documentation says the secret "is not needed for the device flow".
 *
 * The second way rather than the first. `authorize.ts` is what the panel offers,
 * because GitHub asks a windowed application to use the authorization code flow
 * and warns that a device code is a code somebody can be talked into typing.
 * This stays for the case their warning excepts: a machine over SSH, a machine
 * with no browser, a build with an id and no secret.
 */

const CODE = "https://github.com/login/device/code"

/**
 * Asks GitHub for a code pair.
 *
 * The interval GitHub sends back is honoured rather than replaced with a number
 * of our own: polling faster than they ask is how an app earns a `slow_down`
 * and then a refusal.
 */
export const beginSignIn = Effect.fn("beginSignIn")(function* () {
  // Guarded here as well as on the panel, which asks `wayIn` and offers no
  // button this build cannot honour. Without this, a caller that did not ask
  // sends GitHub an empty client id and gets their wording rather than ours.
  if (!canSignInWithACode) return yield* Effect.fail(new SignInRefused(NO_OAUTH_APP))

  const it = yield* postForm<{
    device_code?: string
    user_code?: string
    verification_uri?: string
    interval?: number
    expires_in?: number
    error_description?: string
  }>(CODE, { client_id: CLIENT_ID, scope: SCOPE })

  if (it.device_code === undefined || it.user_code === undefined) {
    return yield* Effect.fail(
      new GitHubUnreachable(it.error_description ?? "GitHub would not start a sign-in")
    )
  }

  return {
    code: it.user_code,
    url: it.verification_uri ?? "https://github.com/login/device",
    deviceCode: it.device_code,
    interval: it.interval ?? 5,
    expiresIn: it.expires_in ?? 900
  } satisfies Pending
})

/** GitHub's way of saying "they have not typed it yet". */
class StillWaiting extends Error {
  readonly _tag = "StillWaiting"
}

/**
 * Waits for the reader to finish, however long that takes them.
 *
 * Written as a loop with a deadline rather than a fixed number of attempts,
 * because the thing being waited on is a person: they may be finding their
 * phone, or their password manager, or the tab they opened four minutes ago.
 * The deadline is GitHub's own `expires_in`, so this stops asking at the moment
 * the code stops working and not before.
 *
 * `slow_down` adds five seconds to the interval and is not an error, which is
 * what GitHub's documentation asks for and what stops a patient reader being
 * refused for our impatience.
 */
export const finishSignIn = Effect.fn("finishSignIn")(function* (pending: Pending) {
  const deadline = Date.now() + pending.expiresIn * 1000
  let wait = pending.interval

  while (true) {
    if (Date.now() >= deadline) {
      return yield* Effect.fail(new StillWaiting("the code expired before it was entered"))
    }

    yield* Effect.sleep(Duration.seconds(wait))

    const it = yield* postForm<{ access_token?: string; error?: string; error_description?: string }>(
      TOKEN,
      {
        client_id: CLIENT_ID,
        device_code: pending.deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code"
      }
    )

    if (it.access_token !== undefined) return it.access_token

    if (it.error === "authorization_pending") continue
    if (it.error === "slow_down") {
      wait = wait + 5
      continue
    }

    // Anything else is a real no: they pressed cancel, the code expired, the
    // OAuth app has device flow turned off. Said once, with GitHub's own words.
    return yield* Effect.fail(
      new GitHubUnreachable(it.error_description ?? it.error ?? "GitHub refused the sign-in")
    )
  }
})
