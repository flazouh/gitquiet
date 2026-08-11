import { Effect } from "effect"
import { useEffect, useState } from "react"
import type { Kept } from "../app/kept"

/**
 * Something being read from GitHub: not here yet, here, or it went wrong.
 *
 * One shape for every panel that waits on a request, so waiting looks the same
 * wherever it happens rather than each place inventing its own three states.
 * Kept apart from the panels that use it for the same reason: a panel that owns
 * the shape of waiting is a panel the next one has to copy.
 */
export type Reading<Value> =
  | { readonly step: "loading" }
  | { readonly step: "ready"; readonly value: Value }
  | { readonly step: "failed" }

/**
 * Something read from GitHub, waited on only when it is not already here.
 *
 * A pointer that passed over the row has usually finished this before the
 * click, in which case there is no waiting at all and no spinner to see.
 */
export const useReading = <Value,>(
  library: Kept<string, ReadonlyArray<Value>> | undefined,
  name: string
): Reading<ReadonlyArray<Value>> => {
  const held = library?.held(name)
  const [reading, setReading] = useState<Reading<ReadonlyArray<Value>>>(
    library === undefined
      ? { step: "ready", value: [] }
      : held === undefined
        ? { step: "loading" }
        : { step: "ready", value: held }
  )

  useEffect(() => {
    if (library === undefined) return

    const asking = Effect.runFork(
      library.ask(name).pipe(
        Effect.match({
          onSuccess: (value) => setReading({ step: "ready", value }),
          onFailure: () => setReading({ step: "failed" })
        })
      )
    )

    return () => asking.interruptUnsafe()
  }, [library, name])

  return reading
}
