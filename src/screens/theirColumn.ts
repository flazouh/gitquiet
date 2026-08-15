/**
 * Their column, for the arrival where no document is coming.
 *
 * All three of a person's pages carry their card, so on a page GitHub served this is
 * nothing at all: the screen reads it off the markup it is standing in, for free, as it
 * arrives. A press this extension answered itself has no such markup — the screen stands
 * on the issue or the list the reader pressed from — and the column had nowhere to come
 * from at all until this.
 *
 * Here rather than in `shell/screen.tsx`, where it was: that module stands any of eleven
 * screens on any of GitHub's pages and has no business knowing what a person is. Both
 * person screens read this one.
 */

import { Effect, Option } from "effect"
import { theirCard } from "@/app/person"
import type { Person, PersonPage } from "@/domain/person"
import { held } from "@/shell/screen"
import { throughGitHub } from "@/shell/supplied"
import { ourOwnRowsDrawn } from "@/ui/going"
import type { TheirColumn } from "@/ui/usePerson"

/**
 * Started at once and joined when the screen asks, which is the same bargain the other
 * reads on these pages make. See `held`.
 *
 * Nothing where the page GitHub served is theirs: the card is in that page, the screen
 * reads it there, and a request for something already on the screen is a request for
 * nothing.
 *
 * A failure is silence. The column is not what the reader pressed for, and a page that
 * refused to draw their repositories because their face could not be read would be a
 * worse page than one with no face on it.
 */
export const theirColumn = (page: PersonPage): TheirColumn | undefined => {
  if (!ourOwnRowsDrawn(window)) return undefined

  const reading = held<Person | undefined, never>((partly) =>
    theirCard(page.login, page.narrowing, partly).pipe(
      throughGitHub,
      Effect.map(Option.getOrUndefined),
      Effect.catch(() => Effect.succeed(undefined))
    )
  )

  return (found) => {
    const heard = (who: Person | undefined): void => {
      if (who !== undefined) found(who)
    }

    Effect.runFork(reading(heard).pipe(Effect.map(heard)))
  }
}
