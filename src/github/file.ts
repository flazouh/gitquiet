import { Effect, Option } from "effect"
import type { Opened } from "../domain/repoHome"
import { FileLines, FileRendering } from "./wire"
import { maybeAmong, whereverAmong } from "./wherever"

const findLines = whereverAmong(FileLines)
const findRendering = maybeAmong(FileRendering)

/**
 * One file, out of the payloads of the page GitHub renders for it.
 *
 * The path comes from the address rather than from the payload. GitHub says the
 * file's own name in three places and none of them is the path from the root of
 * the repository, which is what the tree beside the pane marks its rows by.
 *
 * Two searches, because the lines and the rendering are two payloads of theirs sitting
 * in one document. The lines are the file and are required. The rendering is missing on
 * every file they do not render, so it is looked for and done without.
 */
export const openedFrom = (
  payloads: ReadonlyArray<unknown>,
  path: string
): Effect.Effect<Opened, unknown> =>
  findLines(payloads).pipe(
    Effect.map((lines) => ({
      path,
      lines: lines.rawLines ?? [],
      // An empty rendering is nothing rendered. Their field is null for a file
      // they do not render and an empty string for one that renders to nothing,
      // and a pane switched to an empty article is a pane that looks broken.
      rendered: findRendering(payloads).pipe(
        Option.flatMap((held) =>
          held.richText === null || held.richText === "" ? Option.none() : Option.some(held.richText)
        )
      )
    }))
  )
