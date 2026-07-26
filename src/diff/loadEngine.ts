import { Data, Effect } from "effect"
import { lendCustomElements } from "../ui/customElements"
import type { DiffHandle, DiffRequest } from "./engine"

/**
 * What the separately-built renderer offers, named here so the interface can be
 * written against it without the four and a half megabytes behind it.
 */
export type DiffEngine = {
  readonly renderDiff: (container: HTMLElement, request: DiffRequest) => DiffHandle
}

export class DiffEngineUnavailable extends Data.TaggedError("DiffEngineUnavailable")<{
  readonly cause: unknown
}> {}

/** Where the manifest publishes it. */
const ENGINE = "/diff-engine.js"

let loading: Promise<DiffEngine> | undefined

/**
 * Fetches the renderer, once.
 *
 * The import is by extension URL rather than by path: a content script's
 * relative imports resolve against github.com, where this file does not exist
 * and would not be allowed to. The result is held so the second file someone
 * opens costs nothing, and a failure is not held, so a flaky first load can be
 * tried again.
 *
 * Failure is a real possibility rather than a formality — the resource has to
 * be web-accessible, and a browser that declines leaves the interface to say so
 * rather than to hang on a spinner.
 */
export const loadDiffEngine = Effect.suspend(() =>
  Effect.tryPromise({
    try: () => {
      lendCustomElements()
      loading ??= import(/* @vite-ignore */ browser.runtime.getURL(ENGINE)).then(
        (module: DiffEngine) => module,
        (cause: unknown) => {
          loading = undefined
          throw cause
        }
      )
      return loading
    },
    catch: (cause) => new DiffEngineUnavailable({ cause })
  })
)
