import { Effect, Fiber } from "effect"
import { useEffect, useRef, useState } from "react"
import type { StackLayer } from "../domain/PullRequest"
import type { PullRequestRef } from "../domain/PullRequestRef"
import type { Size } from "../domain/workingSet"

/**
 * How many lines each layer of a chain changes, by the number of the pull
 * request it is.
 *
 * The number and not GitHub's own id, which is what the lists key their sizes
 * on. A layer is what GitHub says about somebody else's pull request in passing
 * and it carries no id, and every layer of a chain is in one repository, so the
 * number names it without anything else being carried to the row.
 */
export type LayerSizes = ReadonlyMap<number, Size>

/**
 * The way a strip asks how big the layers around it are.
 *
 * Handed each answer as it lands rather than a map at the end, the way the
 * commit sizes are asked for: GitHub has no route that counts two pull requests
 * at once, so the last answer arrives after the first and a row that waited for
 * all of them would fill in after the reader had read past it.
 */
export type AskLayerSizes = (
  references: ReadonlyArray<PullRequestRef>,
  tell: (number: number, size: Size) => void
) => Effect.Effect<void>

/**
 * The counts for the layers on the screen, filling in while they are read.
 *
 * Restarted when the layers change and not when the strip is redrawn, which is
 * what the joined numbers are for: a pull request is read again every time
 * anything about it moves, and each read hands down another chain object saying
 * the same thing. A dependency on that object would cancel the counting and
 * start it over on every one of them.
 *
 * The references are reached through a ref rather than through the dependency,
 * because the numbers are the identity and the owner and the repository come
 * along with them: a chain never leaves one repository, so the same numbers are
 * always the same pull requests.
 */
export const useLayerSizes = (
  layers: ReadonlyArray<StackLayer>,
  ask?: AskLayerSizes
): LayerSizes => {
  const [found, setFound] = useState<LayerSizes>(new Map())
  const held = useRef(layers)
  held.current = layers
  const which = layers.map((layer) => layer.reference.number).join(" ")

  useEffect(() => {
    if (ask === undefined || which === "") return

    let watching = true
    const counting = Effect.runFork(
      ask(
        held.current.map((layer) => layer.reference),
        (number, size) => {
          if (!watching) return
          setFound((was) => new Map(was).set(number, size))
        }
      )
    )

    return () => {
      watching = false
      Effect.runFork(Fiber.interrupt(counting))
    }
  }, [which, ask])

  return found
}
