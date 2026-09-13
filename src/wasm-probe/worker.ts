/**
 * The probe, inside a dedicated worker started from an extension URL.
 *
 * This is the context the whole plan rests on: `src/diff/shiki.ts` records that
 * GitHub's policy refuses WebAssembly in a content script and guesses that a
 * worker at our own origin is held to our policy instead. This file is that
 * guess, run.
 *
 * It takes the three URLs in its first message rather than working them out.
 * Whether `browser.runtime` exists inside a worker is a second question, and a
 * probe that answers two questions at once answers neither.
 */

import { Effect } from "effect"
import { attempt, type Where } from "./attempt"

self.addEventListener("message", (event: MessageEvent) => {
  const at = event.data as Where

  Effect.runPromise(
    attempt("worker", at).pipe(Effect.map((answer) => self.postMessage(answer)))
  )
})
