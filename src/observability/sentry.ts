import { Effect } from "effect"

export type Surface = "content-script" | "service-worker" | "prefetch" | "working-set"
  | "repo-pulls"
  | "repo-home"
  | "commits"
  | "repo-issues"
  | "issues"
  | "blame"
  | "actions"
  | "releases"
  | "discussions"
  | "raise"
  | "notifications"
  | "person-repos"
  | "profile"
  | "sign-on"
  /** `gist.github.com`, which is its own content script and its own host. */
  | "gist-list"
  | "compare"

const readEnvironmentValue = (key: string): string | undefined => {
  const environment: unknown = import.meta.env
  if (typeof environment !== "object" || environment === null) return undefined
  const value: unknown = Reflect.get(environment, key)
  return typeof value === "string" && value.length > 0 ? value : undefined
}

/**
 * Sentry is fetched, not bundled.
 *
 * `@sentry/browser` is a hundred and fifty kilobytes of minified code, and it
 * was reaching the reader through a static import in every screen and in the
 * content script — which put it in the chunk they all share, on GitHub's page,
 * on every navigation, in a build with no DSN where the whole thing was a no-op.
 * Behind the DSN check it is a chunk that a development build never asks for.
 */
type Reporter = typeof import("./reporter")

let held: Reporter | undefined
/** Anything reported between the first error and the module arriving. */
const waiting: Array<unknown> = []

export const initialiseErrorReporting = (surface: Surface): void => {
  const dsn = readEnvironmentValue("VITE_SENTRY_DSN")
  if (dsn === undefined) return

  /*
   * Forked rather than awaited, in the shape everything asynchronous here takes.
   *
   * A chunk that fails to arrive is a build with no error reporting, which is where this
   * started: the caller is a surface booting up, and nothing it could do with a rejection
   * is better than carrying on without Sentry.
   */
  Effect.runFork(
    Effect.gen(function* () {
      const sentry = yield* Effect.promise(() => import("./reporter"))

      sentry.init({
        dsn,
        tracesSampleRate: 0,
        initialScope: { tags: { surface } }
      })
      held = sentry
      for (const error of waiting.splice(0)) sentry.captureException(error)
    }).pipe(Effect.catchCause(() => Effect.void))
  )
}

/**
 * Reports, or remembers until there is somewhere to report to.
 *
 * Without a DSN nothing is ever initialised, so the queue holds what it holds
 * and is never read — which is the same silence the static version had, minus
 * the download.
 */
export const reportError = (error: unknown): void => {
  if (held === undefined) {
    if (waiting.length < 20) waiting.push(error)
    return
  }
  held.captureException(error)
}
