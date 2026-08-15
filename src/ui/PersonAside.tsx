import { Option } from "effect"
import type { Person, Way } from "../domain/person"
import { type ArtName, useArt } from "./art"
import { ASIDE, GHOST, PRESSABLE } from "./dress"
import { painted } from "./Section"

/**
 * Who this is, down the left of their page.
 *
 * Drawn rather than left as GitHub drew it, which is the correction this page needed
 * most: their column beside a list of ours was one page in two type scales and two
 * colour systems, and a reader sees that as a broken page rather than as an interface.
 * Everything in it is read out of the document they served — see
 * `personIn` — so nothing on the screen is a request this page did not already pay for.
 *
 * It answers one question, and only one: is this the right person. So it holds the
 * face, the name, the words they wrote and the ways they asked to be reached, in that
 * order, and it holds no counts of anything a reader came to the list for. Their own
 * column also carries achievements, organisations, a contribution calendar and a
 * "block or report" menu; those are five more answers to questions nobody asked while
 * looking for a repository, and `docs/spec/profile.md` says so.
 */
export type PersonAsideProps = {
  readonly who: Person
  /**
   * Hands the page back, for the two acts this interface deliberately cannot do.
   *
   * Following somebody and reporting them are writes, and every write on these pages
   * belongs to GitHub's own form. Rather than draw a button that pretends, the column
   * offers their page — where the button is, three lines from where the reader pressed.
   */
  readonly onStepAside: () => void
}

/**
 * One of the ways they asked to be reached, in the words they wrote for it.
 *
 * A glyph in front, because a column of four bare strings — a domain, two handles and an
 * address — is four things a reader has to read to find out what kind of thing each one
 * is. The same glyph on all four: what they have in common is that they lead away from
 * here, and the label says the rest.
 */
const Line = ({ way }: { readonly way: Way }) => {
  const Link = useArt().link

  return (
    <a
      href={way.href}
      rel="nofollow me noreferrer"
      className={`flex min-w-0 items-center gap-2 no-underline hover:underline ${ASIDE}`}
    >
      <Link size={12} aria-hidden="true" className="shrink-0 opacity-70" />
      <span className="min-w-0 truncate text-ink">{way.label}</span>
    </a>
  )
}

/**
 * A fact of theirs, where they set one.
 *
 * Nothing at all where they did not, rather than a label with an empty line beside it:
 * half of these are unset on most accounts, and a column of headings over nothing is a
 * column that has to be read to find out it says nothing.
 */
const Fact = ({
  said,
  art,
  what
}: {
  readonly said: Option.Option<string>
  /** The glyph in front, which says what kind of fact this is before it is read. */
  readonly art: ArtName
  /** What the number counts, where the fact is a number. Absent where it speaks for itself. */
  readonly what?: string
}) => {
  const Mark = useArt()[art]

  return Option.match(said, {
    onNone: () => null,
    onSome: (found) => (
      <p className={`flex min-w-0 items-center gap-2 ${ASIDE}`}>
        <Mark size={12} aria-hidden="true" className="shrink-0 opacity-70" />
        <span className="min-w-0 truncate">
          <span className="text-ink tabular-nums">{found}</span>
          {what === undefined ? null : ` ${what}`}
        </span>
      </p>
    )
  })
}

export const PersonAside = ({ who, onStepAside }: PersonAsideProps) => {
  const paint = painted("plain")
  const name = Option.getOrUndefined(who.name)

  return (
    /*
     * Sticky at the width where there is a column to be sticky in, the way a repository's
     * front page keeps its own side column in view. A reader scrolling forty repositories is
     * still reading them as this person's, and a face that scrolls away takes the sentence
     * with it.
     */
    <aside
      aria-label={`About ${who.login}`}
      className={`t-panel-fade shrink-0 overflow-hidden rounded-md border bg-canvas lg:sticky lg:top-3 lg:w-72 ${paint.edge}`}
    >
      <div className="flex min-w-0 flex-col gap-3 p-3">
        <div className="flex min-w-0 items-center gap-3">
          {/*
           * A circle, which is GitHub's own distinction between a person and a place, and
           * their big file rather than the thumbnail their sticky bar carries. Decoration
           * beside the name and never instead of it: `alt=""`, because the name is the next
           * element and a reader being read to does not need it twice.
           */}
          {Option.match(who.faceUrl, {
            onNone: () => null,
            onSome: (src) => (
              <img
                alt=""
                src={src}
                width={56}
                height={56}
                className="size-14 shrink-0 rounded-full bg-surface"
              />
            )
          })}
          <div className="flex min-w-0 flex-col">
            {/*
             * The name leads and the login follows it, which is the order a reader recognises
             * somebody in. Where there is no name the login takes the line rather than leaving
             * an empty one above itself.
             */}
            <h1 className="min-w-0 truncate font-medium text-base text-ink leading-6">
              {name ?? who.login}
            </h1>
            {name === undefined ? null : (
              <p className={`min-w-0 truncate ${ASIDE}`}>{who.login}</p>
            )}
          </div>
        </div>

        {/*
         * Their own words, and their line breaks with them. A run of blank lines is not a
         * line break they meant, though: GitHub's box keeps every return somebody pressed,
         * so a bio typed with a gap in it reads here as a name, then an inch of nothing,
         * then a sentence. One paragraph per run, and the run itself is dropped.
         */}
        {Option.match(who.bio, {
          onNone: () => null,
          onSome: (said) => (
            <div className="flex min-w-0 flex-col gap-1.5">
              {said
                .split(/\n\s*\n+/)
                .map((line) => line.trim())
                .filter((line) => line !== "")
                .map((line) => (
                  <p key={line} className="min-w-0 whitespace-pre-line text-ink text-sm leading-5">
                    {line}
                  </p>
                ))}
            </div>
          )
        })}

        <div className="flex min-w-0 flex-col gap-1">
          <Fact said={who.followers} art="person" what="followers" />
          <Fact said={who.following} art="eye" what="following" />
          <Fact said={who.company} art="work" />
          <Fact said={who.location} art="home" />
        </div>

        {Option.isSome(who.site) || who.ways.length > 0 ? (
          <div className="flex min-w-0 flex-col gap-1">
            {Option.match(who.site, {
              onNone: () => null,
              onSome: (way) => <Line way={way} />
            })}
            {who.ways.map((way) => (
              <Line key={way.href} way={way} />
            ))}
          </div>
        ) : null}

        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {/*
           * Following is a write and writes are GitHub's here, so this is their page rather
           * than a button of ours that would have to post a form and hold a token. Said as
           * what it does — it puts their page back — because a control that quietly navigates
           * is a control a reader presses once and then distrusts.
           */}
          <button
            type="button"
            onClick={onStepAside}
            className={`${PRESSABLE} px-2 py-1 text-ink text-xs hover:bg-active`}
          >
            Follow, on GitHub's page
          </button>
          {Option.match(who.sponsorAt, {
            onNone: () => null,
            onSome: (where) => (
              <a
                href={where}
                className={`${GHOST} px-2 py-1 text-ink-muted text-xs no-underline hover:bg-hover hover:text-ink`}
              >
                Sponsor
              </a>
            )
          })}
        </div>
      </div>
    </aside>
  )
}
