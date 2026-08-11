import { Effect } from "effect"
import type { Viewer } from "../shared/wire"

/**
 * GitHub as a desktop app is allowed to ask.
 *
 * The extension reads GitHub's own private page routes, which works because a
 * request made from their page carries the reader's session with it. Nothing
 * here has a session, so nothing here can do that: this talks to the documented
 * API with a token, from a process with no browser around it and therefore no
 * cross-origin rule to satisfy and no cookie jar to leak.
 *
 * What that costs is fidelity — no signed socket channels, no `page_data`
 * payload with everything already assembled — and what it buys is an app that
 * still works the morning after GitHub redecorates their front end.
 */

const REST = "https://api.github.com"
const GRAPHQL = "https://api.github.com/graphql"

export class GitHubRefused extends Error {
  readonly _tag = "GitHubRefused"
  constructor(
    readonly status: number,
    readonly detail: string
  ) {
    super(`GitHub refused with ${status}: ${detail}`)
  }
}

export class GitHubUnreachable extends Error {
  readonly _tag = "GitHubUnreachable"
}

const asked = (token: string) => ({
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": "2022-11-28",
  // Their own guidance, and the string a rate limit complaint will name.
  "User-Agent": "working-set-desktop"
})

/** A documented REST read, with the token attached and nothing else assumed. */
export const restRead = Effect.fn("restRead")(function* <A>(token: string, route: string) {
  const response = yield* Effect.tryPromise({
    try: () => fetch(`${REST}${route}`, { headers: asked(token) }),
    catch: (cause) => new GitHubUnreachable(String(cause))
  })

  if (!response.ok) {
    const detail = yield* Effect.promise(() => response.text())
    return yield* Effect.fail(new GitHubRefused(response.status, detail.slice(0, 300)))
  }

  return (yield* Effect.tryPromise({
    try: () => response.json(),
    catch: (cause) => new GitHubUnreachable(String(cause))
  })) as A
})

/**
 * A documented REST write, which is a read with a body and a verb.
 *
 * Kept beside `restRead` rather than folded into it: they answer the same way and
 * fail the same way, and a single function with an optional body reads as though
 * a read and a write were the same kind of thing. They are not — one of them is
 * undoable.
 */
export const restWrite = Effect.fn("restWrite")(function* <A>(
  token: string,
  route: string,
  body: unknown,
  method: "POST" | "PATCH" | "PUT" = "POST"
) {
  const response = yield* Effect.tryPromise({
    try: () =>
      fetch(`${REST}${route}`, {
        method,
        headers: { ...asked(token), "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }),
    catch: (cause) => new GitHubUnreachable(String(cause))
  })

  if (!response.ok) {
    const detail = yield* Effect.promise(() => response.text())
    return yield* Effect.fail(new GitHubRefused(response.status, detail.slice(0, 300)))
  }

  return (yield* Effect.tryPromise({
    try: () => response.json(),
    catch: (cause) => new GitHubUnreachable(String(cause))
  })) as A
})

/**
 * One GraphQL query, which for this app is usually the whole of a screen.
 *
 * GraphQL rather than REST wherever a row needs more than one fact, because the
 * REST version of a Working Set row is a pull request, then its checks, then its
 * reviews, then its diff size — four requests to draw one line. The query below
 * asks for all of it once, which is the same shape the extension gets from
 * GitHub's own page and the reason both feel equally quick.
 *
 * A GraphQL error is an ordinary 200 with an `errors` array, so a response that
 * looks fine and is not gets turned into a refusal here rather than surfacing as
 * an undefined three layers up.
 */
export const graphRead = Effect.fn("graphRead")(function* <A>(
  token: string,
  query: string,
  variables: Record<string, unknown> = {}
) {
  const response = yield* Effect.tryPromise({
    try: () =>
      fetch(GRAPHQL, {
        method: "POST",
        headers: { ...asked(token), "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables })
      }),
    catch: (cause) => new GitHubUnreachable(String(cause))
  })

  if (!response.ok) {
    const detail = yield* Effect.promise(() => response.text())
    return yield* Effect.fail(new GitHubRefused(response.status, detail.slice(0, 300)))
  }

  const body = (yield* Effect.tryPromise({
    try: () => response.json(),
    catch: (cause) => new GitHubUnreachable(String(cause))
  })) as { data?: A; errors?: ReadonlyArray<{ message: string }> }

  if (body.errors !== undefined && body.errors.length > 0) {
    const said = body.errors.map((one) => one.message).join("; ")
    return yield* Effect.fail(new GitHubRefused(200, said.slice(0, 300)))
  }

  if (body.data === undefined) {
    return yield* Effect.fail(new GitHubRefused(200, "an answer with no data in it"))
  }

  return body.data
})

/**
 * Who the token belongs to.
 *
 * Also the one call that says whether a token kept from a previous run is still
 * any good: a revoked token is a 401 here, which is cheaper to find out on
 * launch than in the middle of drawing a list.
 */
export const whoAmI = Effect.fn("whoAmI")(function* (token: string) {
  const it = yield* restRead<{ login: string; name: string | null; avatar_url: string }>(
    token,
    "/user"
  )

  return { login: it.login, name: it.name, avatar: it.avatar_url } satisfies Viewer
})
