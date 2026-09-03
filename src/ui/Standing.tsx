import { Effect, Option } from "effect"
import { type ReactNode, useEffect, useState } from "react"
import type { Hand, Standing as Stands } from "../domain/repoHome"
import { ASIDE, CARD } from "./dress"
export type StandingProps = {
  /** Nothing until `/owner/repo/_sidebar` lands. Nothing ever, where it fails. */
  readonly stands: Stands | undefined
}

/**
 * How many faces fit before a row of them stops being readable.
 *
 * GitHub sends fourteen. Eight and a count reads as a sample of the people who
 * wrote this, which is what it is; fourteen reads as a list that has been cut
 * off, and on a narrow card it wraps to a second row of nothing but faces.
 */
const FACES = 8

/**
 * What the repository is written in, over the tree it is written in.
 *
 * Its own card, above the files. The bar is the same object GitHub has drawn on
 * every repository page for a decade — a reader takes the shape of a
 * mostly-TypeScript repository at a glance without reading a word of it — and
 * the names under it are the legend that makes the shape mean something. Both
 * were squeezed into a strip sixty-four pixels wide when they shared a line with
 * everything else, which threw away the recognition the bar exists for.
 */
export const Languages = ({ stands }: { readonly stands: Stands | undefined }) => {
  const tongues = stands?.tongues ?? []
  if (tongues.length === 0) return null

  return (
    <section
      aria-label="Languages"
      className={`shrink-0 px-3 py-2.5 ${CARD}`}
    >
      <div className="flex h-1.5 overflow-hidden rounded-full">
        {tongues.map((tongue) => (
          <span
            key={tongue.name}
            title={`${tongue.name} ${tongue.share}%`}
            style={{ width: `${tongue.share}%`, background: tongue.colour }}
          />
        ))}
      </div>
      <p className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 ${ASIDE}`}>
        {tongues.map((tongue) => (
          <a key={tongue.name} href={tongue.url} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-2 w-2 rounded-full"
              style={{ background: tongue.colour }}
            />
            <span className="text-ink">{tongue.name}</span>
            <span>{tongue.share}%</span>
          </a>
        ))}
      </p>
    </section>
  )
}

/**
 * The people, as faces.
 *
 * A face is the one thing on this card that says a repository has people behind
 * it rather than a number of them. The name is on the title and on the image's
 * alt text, so the row is still a list of names to anything that does not paint.
 */
const Hands = ({
  hands,
  many,
  url
}: {
  readonly hands: ReadonlyArray<Hand>
  readonly many: Option.Option<number>
  readonly url: Option.Option<string>
}) => {
  if (hands.length === 0) return null

  const shown = hands.slice(0, FACES)

  return (
    <div className="flex shrink-0 items-center gap-2">
      <div className="flex -space-x-1.5">
        {shown.map((hand) => (
          <a key={hand.login} href={hand.url} title={hand.called}>
            <img
              src={hand.face}
              alt={hand.called}
              width={20}
              height={20}
              loading="lazy"
              className="h-5 w-5 rounded-full border border-canvas bg-surface"
            />
          </a>
        ))}
      </div>
      {Option.match(many, {
        onNone: () => null,
        onSome: (count) =>
          Option.match(url, {
            onNone: () => <span className={ASIDE}>{count.toLocaleString()}</span>,
            onSome: (where) => (
              <a href={where} className={ASIDE}>
                {count.toLocaleString()} {count === 1 ? "contributor" : "contributors"}
              </a>
            )
          })
      })}
    </div>
  )
}

const Fact = ({
  url,
  children
}: {
  readonly url: Option.Option<string>
  readonly children: ReactNode
}) =>
  Option.match(url, {
    onNone: () => <span className={ASIDE}>{children}</span>,
    onSome: (where) => (
      <a href={where} className={ASIDE}>
        {children}
      </a>
    )
  })

/**
 * Everything about a repository that is neither its files nor its README.
 *
 * Reads itself, from a request nothing else waits on, and draws nothing until
 * that lands. A card that grows by one row a quarter of a second after the page
 * settles is the cost of not holding the file list back for it, and it is the
 * cheaper of the two.
 *
 * Every part disappears where the repository has none of it. A private
 * repository with one author is a language bar, one face and nothing else,
 * rather than six headings saying "no releases", "no packages", "no deployments".
 */
export const useStanding = (load?: () => Effect.Effect<Stands, unknown>): Stands | undefined => {
  const [stands, setStands] = useState<Stands | undefined>(undefined)

  useEffect(() => {
    if (load === undefined) return
    let watching = true

    void Effect.runPromise(
      load().pipe(
        Effect.map((read) => {
          if (watching) setStands(read)
        }),
        // A card that could not be read is a card that is not drawn. Nothing
        // else on this page depends on it, and there is nothing here worth
        // spending an error message on.
        Effect.catch(() => Effect.void)
      )
    )

    return () => {
      watching = false
    }
  }, [load])

  return stands
}

export const Standing = ({ stands }: StandingProps) => {
  if (stands === undefined) return null

  const shipped = Option.getOrUndefined(stands.shipped)
  const landings = stands.landings.length
  const nothing =
    stands.hands.length === 0 &&
    shipped === undefined &&
    landings === 0 &&
    Option.isNone(stands.leaning) &&
    Option.isNone(stands.parcels)

  if (nothing) return null

  /*
   * One line, and it gives way from the right as the window narrows.
   *
   * Everything here is worth showing and not all of it is worth a second row.
   * The order is what a reader loses last: the people who wrote it stay at every
   * width, what shipped goes at 1024, and the three counts go at 1280. Nothing
   * wraps, so the row is one line on a phone and one line on a monitor.
   */
  return (
    <div aria-label="Standing" className="flex min-w-0 shrink items-center gap-3 overflow-hidden">
      <Hands hands={stands.hands} many={stands.handCount} url={stands.handsUrl} />
      {shipped === undefined ? null : (
        <span className="hidden shrink-0 lg:inline">
          <Fact url={stands.shippedUrl}>{shipped.name}</Fact>
        </span>
      )}
      <span className="hidden shrink-0 items-center gap-3 xl:flex">
        {landings === 0 ? null : (
          <Fact url={stands.landingsUrl}>
            {landings.toLocaleString()} {landings === 1 ? "environment" : "environments"}
          </Fact>
        )}
        {Option.match(stands.leaning, {
          onNone: () => null,
          onSome: (many) => <Fact url={stands.leaningUrl}>{many.toLocaleString()} using this</Fact>
        })}
        {Option.match(stands.parcels, {
          onNone: () => null,
          onSome: (many) => (
            <Fact url={stands.parcelsUrl}>
              {many.toLocaleString()} {many === 1 ? "package" : "packages"}
            </Fact>
          )
        })}
      </span>
    </div>
  )
}
