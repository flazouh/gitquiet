import { Effect } from "effect"
import type { WayIn } from "../shared/wire"
import { GitHubUnreachable } from "./api"

/**
 * The OAuth app both sign-ins ask on behalf of, and the endpoints they share.
 *
 * Two flows sit on top of this file. `authorize.ts` sends the reader to their
 * own browser and catches them coming back, which is what GitHub asks a windowed
 * app to do. `device.ts` shows a code to type somewhere else, which is what a
 * machine with no browser is left with. Both post a form to the same address and
 * both name the same app, so that lives here rather than twice.
 */

/** Where a reader approves, and where a code becomes a token. */
export const AUTHORIZE = "https://github.com/login/oauth/authorize"
export const TOKEN = "https://github.com/login/oauth/access_token"

/**
 * What the token is allowed to do.
 *
 * `repo` because a Working Set that silently omitted private pull requests would
 * be worse than no Working Set: the reader cannot see what is missing. Nothing
 * else — no `write`, no `delete_repo`, no organisation administration — and the
 * scope stays this short until a screen needs more.
 */
export const SCOPE = "repo"

/**
 * The app's credentials, put here by the build rather than read at runtime.
 *
 * `electrobun.config.ts` hands both names to Bun's `define`, so in a packaged
 * app the bundler has already replaced each of these expressions with a string
 * literal. That is the fix for the sign-in panel every release shipped with: an
 * app opened from Finder inherits launchd's environment, which holds neither of
 * these, so a value read at runtime was always empty and the button had nothing
 * to ask with. Outside a bundle — a test, a script in `scripts/` — these are
 * ordinary environment reads, which is what lets a contributor point the app at
 * an OAuth app of their own.
 *
 * Neither value is a secret, and the second one is called one by GitHub only
 * because their token endpoint was written for web servers. Anything shipped
 * inside a downloadable app can be read out of it, which is why GitHub's own
 * command line tool commits both and their MCP server bakes both in with linker
 * flags. What keeps the flow safe is PKCE, not this: see `authorize.ts`.
 */
export const CLIENT_ID = process.env.GITHUB_CLIENT_ID ?? ""
export const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET ?? ""

/**
 * The best sign-in this build can offer, which is one fact and not two.
 *
 * The browser flow needs both credentials, because GitHub asks for the secret
 * when a code is exchanged even though PKCE is what secures the exchange. The
 * device flow needs only the id — their own documentation says the secret "is
 * not needed for the device flow" — so a build with half the pair still signs
 * somebody in rather than refusing to try. With neither there is no way in.
 *
 * Ordered, so it crosses the wire as one word: a build that can open a browser
 * can also show a code, and the panel offers that as the second way.
 */
export const WAY_IN: WayIn = CLIENT_ID === "" ? "none" : CLIENT_SECRET === "" ? "code" : "browser"

export const canSignInThroughBrowser = WAY_IN === "browser"
export const canSignInWithACode = WAY_IN !== "none"

/**
 * What a caller that did not ask `wayIn` first is told.
 *
 * Written for whoever reads a log or a script's output, not for the reader
 * looking at the panel — the panel has its own sentence, because it can say
 * what to do about it and this cannot.
 */
export const NO_OAUTH_APP = "This build carries no OAuth app: nothing was baked in when it was built."

/**
 * A sign-in that did not happen for a reason worth repeating to the reader.
 *
 * Its own error rather than `GitHubUnreachable`, because none of these is a
 * network fault: a reader pressed cancel, a reply arrived for a sign-in this
 * window did not start, nobody came back in time, this build has no OAuth app.
 * Every message it carries is meant to be read.
 */
export class SignInRefused extends Error {
  readonly _tag = "SignInRefused"
}

const form = (fields: Record<string, string>) =>
  Object.entries(fields)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&")

/** A form post to GitHub's OAuth endpoints, which answer JSON when asked to. */
export const postForm = <A>(url: string, fields: Record<string, string>) =>
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
