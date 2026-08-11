import { Duration, Effect } from "effect"
import type { Pending } from "../shared/wire"
import { GitHubUnreachable } from "./api"

/**
 * Signing in without a password, a redirect, or a browser we control.
 *
 * GitHub's device flow, which exists for exactly this shape of app: we ask for a
 * pair of codes, the reader types the short one into github.com on whatever
 * device they like, and we poll until GitHub says they did. No embedded login
 * form — an app that draws its own GitHub password field is an app teaching its
 * readers to type their password into anything that looks the part — and no
 * client secret, because a secret shipped inside a downloadable app is not one.
 */

const CODE = "https://github.com/login/device/code"
const TOKEN = "https://github.com/login/oauth/access_token"

/**
 * What the token is allowed to do.
 *
 * `repo` because a Working Set that silently omitted private pull requests would
 * be worse than no Working Set: the reader cannot see what is missing. Nothing
 * else — no `write`, no `delete_repo`, no organisation administration — and the
 * scope stays this short until a screen needs more.
 */
const SCOPE = "repo"

/**
 * The OAuth app this asks on behalf of.
 *
 * Not a secret: a device-flow client id is published in the app that uses it,
 * which is why GitHub issues no secret alongside it. It is still yours to
 * create — one OAuth app, "Enable Device Flow" ticked — because an app asking
 * for a reader's private repositories should say whose app it is.
 *
 * The environment wins where it is set, which is how this is run against a
 * throwaway OAuth app without editing tracked code.
 */
export const CLIENT_ID = process.env["GITHUB_CLIENT_ID"] ?? ""

const form = (fields: Record<string, string>) =>
  Object.entries(fields)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&")

const post = <A>(url: string, fields: Record<string, string>) =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body: form(fields)
      })
      return (await response.json()) as A
    },
    catch: (cause) => new GitHubUnreachable(String(cause))
  })

/**
 * Asks GitHub for a code pair.
 *
 * The interval GitHub sends back is honoured rather than replaced with a number
 * of our own: polling faster than they ask is how an app earns a `slow_down`
 * and then a refusal.
 */
export const beginSignIn = Effect.fn("beginSignIn")(function* () {
  const it = yield* post<{
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

    const it = yield* post<{ access_token?: string; error?: string; error_description?: string }>(
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
