import { Effect, Fiber } from "effect"
import { useEffect, useState } from "react"
import type { History as Read, Stat, Stats } from "../domain/commitList"
import { commitsOf } from "../domain/commitList"

/**
 * The way a screen asks how big a page of commits is.
 *
 * Handed the shas and a way to say each answer as it lands, rather than
 * returning a map at the end. There is no route that gives forty sizes at once,
 * so the last of them arrives seconds after the first, and a column that waits
 * for all of them is a column that appears when nobody is looking at it any
 * more.
 */
export type AskSizes = (
  shas: ReadonlyArray<string>,
  tell: (sha: string, stat: Stat) => void
) => Effect.Effect<void>

/**
 * The sizes for the page on the screen, filling in while it is read.
 *
 * Restarted when the page changes and not when it is redrawn, which is what the
 * joined shas are for: the history is a new object on every read — the marks
 * arriving rebuild it — and a dependency on the object itself would cancel the
 * sizes read and start it again every time one arrives.
 *
 * What has already been found survives that restart, because a size cannot go
 * out of date: the sha is a hash of the diff. Paging to the older commits keeps
 * the sizes of any commit both pages hold, and asks only about the rest.
 */
export const useSizes = (history: Read | undefined, ask?: AskSizes): Stats => {
  const [found, setFound] = useState<Stats>(new Map())
  const shas = history === undefined ? [] : commitsOf(history).map((commit) => commit.sha)
  const page = shas.join(" ")

  useEffect(() => {
    if (ask === undefined || page === "") return

    let watching = true
    const reading = Effect.runFork(
      ask(page.split(" "), (sha, stat) => {
        if (!watching) return
        setFound((was) => new Map(was).set(sha, stat))
      })
    )

    return () => {
      watching = false
      Effect.runFork(Fiber.interrupt(reading))
    }
  }, [page, ask])

  return found
}
