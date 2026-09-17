/**
 * Which repository a published package comes from, out of what it says about
 * itself.
 *
 * `src/ledger/packages.ts` answers this without asking anybody: a package this
 * repository holds is a path in the archive already read, and a package whose
 * name looks like a repository is a guess checked against that repository's own
 * `package.json`. Both are free and neither leaves the browser.
 *
 * What they cannot do is an unscoped package nobody named after its owner.
 * `react` is not `yourorg/react`, `zod` is not `yourorg/zod`, and no guess made
 * from the name alone will ever reach `facebook/react` — measured: of the eight
 * commonest imports in one repository, the guesses reach the scoped ones and
 * none of the rest. A registry knows, because a package tells it where it was
 * written when it is published.
 *
 * Asking costs a request to somebody else's server carrying the name of a
 * package this repository depends on, which is why `docs/spec/following.md`
 * ruled it out and why it is a setting rather than a default. This module is
 * the parsing half, and it is pure: what a manifest means, with nothing
 * fetched, so every shape below is a test rather than a hope.
 */

import { Effect } from "effect"

import type { Repo } from "./packages"

/** Where a published package was written, and where in it. */
export type Published = {
  readonly repo: Repo
  /**
   * The folder the package sits in, where its repository holds many.
   *
   * npm's own field, and the reason this is worth having over a guess:
   * `scheduler` is `facebook/react` at `packages/scheduler`, and a Follow that
   * landed on the root of `react` would be a Follow to the wrong place in the
   * right repository.
   */
  readonly directory?: string
}

/**
 * The hosts a repository field can name, and the one this can reach.
 *
 * GitHub only, because this extension draws GitHub. A package written on
 * GitLab resolves to nothing, which is what it resolved to before.
 */
const GITHUB = /(?:^|\/\/|@)github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?(?:[/#?].*)?$/

/** `owner/repo`, which is npm's shorthand for a GitHub repository. */
const SHORTHAND = /^(?:github:)?([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/

/**
 * A repository field as a repository, or nothing.
 *
 * Every form measured in one `node_modules` of 489 manifests that carry the
 * field: an object with a `url`, a bare string, `https://`, `http://`,
 * `git://`, `git+https://`, `git@github.com:`, with and without `.git`, and
 * npm's `owner/repo` shorthand. Nothing is assumed about which of them a
 * package will use, because all of them are in use.
 */
const repoIn = (said: unknown): Repo | null => {
  const url = typeof said === "string" ? said : null
  if (url === null) return null

  const full = GITHUB.exec(url)
  if (full !== null && full[1] !== undefined && full[2] !== undefined) {
    return { owner: full[1], repo: full[2] }
  }

  // A shorthand names no host, so it is only a repository where it could not be
  // anything else: a bare `gitlab:owner/repo` says where it is and it is not
  // here, and a URL with a host this did not match has already been refused.
  if (url.includes("://") || url.includes("@")) return null
  const short = SHORTHAND.exec(url)
  if (short !== null && short[1] !== undefined && short[2] !== undefined) {
    return { owner: short[1], repo: short[2] }
  }

  return null
}

/**
 * Where a package was written, out of the manifest a registry answers with.
 *
 * Given the text rather than the object, like the rest of this side of the
 * Ledger: a manifest that does not parse is the ordinary case rather than the
 * exceptional one, and nothing here should throw because somebody published
 * something odd.
 */
export const publishedAt = (text: string): Published | null => {
  // `Effect.try` rather than a `try` block, which this codebase does not
  // write — see `.oxlintrc.json`, and `parsed` in `packages.ts` for the same
  // shape. A manifest that does not parse is an ordinary answer of nothing.
  const said = Effect.try({
    try: (): unknown => JSON.parse(text),
    catch: () => null
  }).pipe(
    Effect.map((found) =>
      typeof found === "object" && found !== null ? (found as Record<string, unknown>) : null
    ),
    Effect.catch(() => Effect.succeed(null)),
    Effect.runSync
  )
  if (said === null) return null

  const field = said["repository"]
  const url = typeof field === "string" ? field : null
  const held = typeof field === "object" && field !== null ? (field as Record<string, unknown>) : null

  const repo = repoIn(url ?? held?.["url"])
  if (repo === null) return null

  const directory = held?.["directory"]
  return typeof directory === "string" && directory !== ""
    ? { repo, directory: directory.replace(/^\.?\//, "").replace(/\/$/, "") }
    : { repo }
}

/**
 * Where to ask about a package, which is the one address this sends.
 *
 * The version rather than the whole packument: a popular package's full
 * document is megabytes of every version it ever had, and the question is
 * which repository it is written in.
 */
export const asking = (name: string): string =>
  `https://registry.npmjs.org/${name.split("/").map(encodeURIComponent).join("/")}/latest`
