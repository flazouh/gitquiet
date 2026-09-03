import * as Bubble from "@radix-ui/react-hover-card"
import { Effect, Option } from "effect"
import { useEffect, useState } from "react"
import type { Portrait } from "../domain/portrait"
import { FLOAT, HERE } from "./dress"
import { OVER_ID, outsideHost } from "./outside"
import { type Count, type Look, usePortraits } from "./portraits"

export type { Count, Look } from "./portraits"

/**
 * Where GitHub keeps a face for a login.
 *
 * Their redirect takes a login and answers with the avatar, which saves asking
 * an API for something a row already knows. Apps are written `name[bot]` in
 * commit data and that spelling 404s, so the suffix comes off — enough for the
 * older bots, and the ones it misses fall back to their initial.
 */
export const faceOf = (login: string, size = 40): string =>
  `https://github.com/${encodeURIComponent(login.replace(/\[bot\]$/, ""))}.png?size=${size}`

const many = new Intl.NumberFormat("en-US")

/**
 * A year of somebody's work in the words GitHub uses for it.
 *
 * Their own phrasing rather than a bare number, because a number on its own beside
 * a location and a bio reads as something to work out rather than something to
 * know.
 */
const yearRead = (total: number): string =>
  total === 0
    ? "No contributions in the last year"
    : `${many.format(total)} contribution${total === 1 ? "" : "s"} in the last year`

/**
 * A line of the card, drawn only if GitHub had one to give.
 *
 * Every field of a portrait is optional, and an empty row is worse than a shorter
 * card: it reads as something that failed to load rather than something nobody
 * filled in.
 *
 * A span made to behave like a block, rather than the paragraph this obviously
 * is. A tooltip is portalled to the end of the document, so it stands outside
 * `#gitquiet-root` and none of the reset that makes this interface's typography
 * ours reaches it — and GitHub styles `p` on their pages: ten pixels of margin
 * under every line, and a font size that quietly beat `text-sm` on the name. A
 * span is a tag they have no opinion about.
 */
const Line = ({
  said,
  className
}: {
  readonly said: Option.Option<string>
  readonly className: string
}) =>
  Option.match(said, {
    onNone: () => null,
    onSome: (words) => <span className={`block ${className}`}>{words}</span>
  })

const Card = ({
  login,
  portrait,
  year
}: {
  readonly login: string
  readonly portrait: Option.Option<Portrait>
  readonly year: Option.Option<number>
}) => {
  const known = Option.getOrUndefined(portrait)

  return (
    <div className="flex w-64 flex-col gap-1.5">
      {/*
       * The face and the name lead to the profile, which is where a reader who
       * opened this card was heading anyway.
       *
       * A link works here and would not have in what this used to be: a tooltip
       * closes the moment the pointer leaves the thing it describes, so anything
       * inside one can be read and never reached. This is a hover card, which is
       * the primitive for a preview of something behind a link — it stays while
       * the pointer travels into it.
       */}
      <a
        href={`https://github.com/${encodeURIComponent(login)}`}
        className="flex items-center gap-2 no-underline hover:underline"
      >
        <img
          alt=""
          src={
            known === undefined
              ? faceOf(login, 48)
              : Option.getOrElse(known.faceUrl, () => faceOf(login, 48))
          }
          width={32}
          height={32}
          className="shrink-0 rounded-full"
        />
        <span className="flex min-w-0 flex-col">
          {/*
           * The name leads where there is one, because that is what a colleague is
           * known by; the login follows, because that is what the row says.
           *
           * `text-base` rather than `text-sm`, which sounds like a size up and is
           * not: this interface maps Tailwind's scale onto Primer's, where small
           * body text and a caption are both twelve pixels and differ only in
           * leading. Bold at the same size as the bio under it made the name read
           * as another line of the bio.
           */}
          {known === undefined ? null : (
            <Line said={known.name} className="truncate text-base font-semibold text-ink" />
          )}
          <span className="flex items-baseline gap-1">
            <span className="truncate text-xs text-ink-muted">{login}</span>
            {known === undefined ? null : (
              <Line said={known.pronouns} className="shrink-0 text-xs text-ink-muted" />
            )}
          </span>
        </span>
      </a>

      {known === undefined ? null : (
        <>
          <Line said={known.bio} className="text-xs text-ink" />
          <Line said={known.location} className="text-xs text-ink-muted" />
          <Line said={known.note} className="text-xs text-ink-muted" />
          {/*
           * Last, and it arrives last: the page it is read off is a quarter of a
           * megabyte, so the rest of the card is already up by the time this line
           * appears under it.
           */}
          <Line said={Option.map(year, yearRead)} className="text-xs text-ink-muted" />

          {known.sponsorable || known.followedByViewer ? (
            <span className="flex items-center gap-1.5 pt-0.5">
              {known.followedByViewer ? (
                <span className={`rounded-full ${HERE} px-2 py-0.5 text-[10px]`}>Following</span>
              ) : null}
              {known.sponsorable ? (
                <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] text-ink-muted">
                  Sponsorable
                </span>
              ) : null}
            </span>
          ) : null}
        </>
      )}
    </div>
  )
}

/**
 * Who did it, as a face rather than a name.
 *
 * A column of logins is a column of ragged text competing with the thing worth
 * reading, which is what changed. A face is scanned without being read, and the
 * rest of the person is one hover away for when it matters.
 *
 * The hover waits a beat before it asks. The face is the first column of every
 * row now, so a cursor travelling down the list crosses all of them — and behind
 * this hover is a request, so firing on the way past would be a read of GitHub
 * per row the reader never meant to look at.
 */
export const Who = ({
  login,
  src,
  size = 16,
  look,
  count
}: {
  readonly login: string
  /** GitHub's own URL for the face, when the payload carried one. */
  readonly src?: string
  readonly size?: number
  /** Both default to however this screen was told to look somebody up. */
  readonly look?: Look
  readonly count?: Count
}) => {
  const reads = usePortraits()
  const ask = look ?? reads.look
  const tally = count ?? reads.count

  const [broken, setBroken] = useState(false)
  const [asked, setAsked] = useState(false)
  const [portrait, setPortrait] = useState<Option.Option<Portrait>>(Option.none())
  const [year, setYear] = useState<Option.Option<number>>(Option.none())

  useEffect(() => {
    if (!asked) return

    // Both at once and drawn as each lands, rather than one card that waits for
    // the slower of them.
    const looking = Effect.runFork(Effect.map(ask(login), setPortrait))
    const tallying = Effect.runFork(Effect.map(tally(login), setYear))

    return () => {
      looking.interruptUnsafe()
      tallying.interruptUnsafe()
    }
  }, [asked, login, ask, tally])

  return (
    // `closeDelay` is what makes the link in the card reachable: the pointer has to
    // cross the gap between a sixteen-pixel face and the card above it, and Radix's
    // grace area covers the path but not a reader who pauses on the way.
    <Bubble.Root openDelay={80} closeDelay={160} onOpenChange={(open) => open && setAsked(true)}>
      <Bubble.Trigger asChild>
        <span
          aria-label={login}
          role="img"
          className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface text-[9px] font-semibold uppercase text-ink-muted"
          style={{ width: size, height: size }}
        >
          {broken ? (
            login.slice(0, 1)
          ) : (
            <img
              alt=""
              src={src ?? faceOf(login, size * 2)}
              width={size}
              height={size}
              onError={() => setBroken(true)}
            />
          )}
        </span>
      </Bubble.Trigger>
      {/*
        Into a host of ours rather than the end of the document.

        Radix portals to `document.body`, which is outside `#gitquiet-root` — and the tokens are
        inline custom properties on that root, so a card portalled there resolved the light
        defaults and painted white on a dark page. `outside.ts` keeps one marked host that the
        theme paints and the stylesheet resets.
      */}
      <Bubble.Portal container={outsideHost(document, OVER_ID)}>
        <Bubble.Content
          side="top"
          align="start"
          sideOffset={6}
          collisionPadding={8}
          // Raised and shadowed rather than outlined: it is over the row it belongs
          // to, and the shadow is what says so on GitHub's page and in the window.
          className={`t-card z-50 px-3 py-2 text-ink ${FLOAT}`}
        >
          <Card login={login} portrait={portrait} year={year} />
        </Bubble.Content>
      </Bubble.Portal>
    </Bubble.Root>
  )
}
